import type { Ctx } from "../core/bot";
import type { ChatTurn } from "../ai/client";
import { answerFaq } from "../ai/faq";
import { conversation } from "../db/repo";
import { msg } from "../whatsapp/msg";
import { encodeAction } from "../util/ids";
import { D, MessageDirection } from "../config/constants";
import { requestHuman } from "./mentor";

export async function handleFaq(ctx: Ctx, question: string) {
  // Build short multi-turn history from recent *text* messages only (keeps it clean).
  const recent = await conversation.recent(ctx.student.id, 8);
  const history: ChatTurn[] = recent
    .filter((r) => r.type === "text")
    .slice(-6)
    .map((r) => ({ role: r.direction === MessageDirection.INBOUND ? "user" : "model", text: r.body }));

  const { answer, needsHuman } = await answerFaq(ctx.bot.ai, question, history);
  if (needsHuman) return requestHuman(ctx, `Question I couldn't answer from our info: "${question}"`);

  return ctx.reply(
    msg.buttons(answer, [
      { id: encodeAction(D.BROCHURE, "list"), title: "📄 Brochure" },
      { id: encodeAction(D.BOOK, "start", "DEMO"), title: "🎬 Book demo" },
      { id: encodeAction(D.MENTOR, "request"), title: "👤 Mentor" },
    ]),
  );
}
