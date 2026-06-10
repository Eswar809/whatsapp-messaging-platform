import type { Student } from "@prisma/client";
import type { Bot } from "./bot";
import { describeOutbound } from "../whatsapp/builders";
import type { OutboundMessage, SendResult } from "../whatsapp/types";
import { MessageChannel, MessageDirection } from "../config/constants";
import { conversation, students } from "../db/repo";
import { isWithinSessionWindow } from "../util/time";

/**
 * The single outbound choke point. Encodes the WhatsApp Cloud API rule:
 *   - inside the 24h customer-service window  -> any free-form message allowed
 *   - outside the window                      -> only an approved template
 * Free-form messages may carry a `template` fallback used when the window is closed.
 * Every send is logged to the conversation for mentor context + audit.
 */
export async function sendTo(bot: Bot, student: Student, message: OutboundMessage): Promise<SendResult> {
  const open = isWithinSessionWindow(student.lastInboundAt);
  let toSend = message;
  let channel: MessageChannel = MessageChannel.SESSION;

  if (message.kind === "template") {
    channel = MessageChannel.TEMPLATE;
  } else if (open) {
    channel = MessageChannel.SESSION;
  } else if (message.template) {
    toSend = { kind: "template", template: message.template };
    channel = MessageChannel.TEMPLATE;
  } else {
    bot.log.warn(`outbound to ${student.waId}: 24h window closed & no template -> SKIPPED`);
    await conversation
      .append({
        studentId: student.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.TEMPLATE,
        type: "skipped",
        body: describeOutbound(message),
      })
      .catch(() => {});
    return { ok: false, skipped: true };
  }

  const res = await bot.wa.send(student.waId, toSend);
  const body = toSend.kind === "text" ? toSend.body : describeOutbound(toSend);
  await conversation
    .append({ studentId: student.id, direction: MessageDirection.OUTBOUND, channel, type: toSend.kind, body })
    .catch(() => {});
  if (res.ok) await students.touchOutbound(student.id, new Date()).catch(() => {});
  return res;
}
