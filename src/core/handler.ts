import type { Bot, Ctx } from "./bot";
import type { ParsedInbound } from "../whatsapp/types";
import { conversation, students } from "../db/repo";
import { MessageDirection } from "../config/constants";
import { sendTo } from "./outbound";
import { route } from "./router";
import { msg } from "../whatsapp/msg";

/** Entry point for one inbound message: dedupe, persist, build context, route. */
export async function processInbound(bot: Bot, inbound: ParsedInbound) {
  // Idempotency: Meta retries on non-200 and can redeliver.
  if (await conversation.seenMessage(inbound.messageId)) {
    bot.log.debug(`duplicate message ${inbound.messageId} — ignored`);
    return;
  }

  const student = await students.upsertByWaId(inbound.waId, { name: inbound.name });
  student.lastInboundAt = inbound.timestamp; // in-memory: makes the 24h window open for replies
  await students.touchInbound(student.id, inbound.timestamp);
  await conversation.append({
    studentId: student.id,
    direction: MessageDirection.INBOUND,
    type: inbound.kind === "interactive" ? "interactive" : inbound.kind,
    body: inbound.text ?? inbound.replyId ?? "",
    waMessageId: inbound.messageId,
  });
  bot.wa.markRead(inbound.messageId).catch(() => {});

  const ctx: Ctx = {
    bot,
    student,
    inbound,
    log: bot.log.child(inbound.waId),
    reply: (m) => sendTo(bot, student, m),
  };

  try {
    await route(ctx);
  } catch (e) {
    ctx.log.error("route failed", String(e));
    await ctx.reply(msg.text("Sorry, something went wrong on our side 😞. Please try again, or type *menu*.")).catch(() => {});
  }
}
