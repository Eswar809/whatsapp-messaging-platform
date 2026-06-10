import type { McqQuestion } from "@prisma/client";
import type { Ctx } from "../core/bot";
import type { Action } from "../util/ids";
import type { OutboundMessage } from "../whatsapp/types";
import { encodeAction } from "../util/ids";
import { msg } from "../whatsapp/msg";
import { D, DeliveryStatus, POINTS } from "../config/constants";
import { mcq } from "../db/repo";
import { isoYearWeek } from "../util/time";

function parseOptions(json: string): string[] {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}
const letter = (i: number) => String.fromCharCode(65 + i);

export function buildMcqMessage(q: McqQuestion): OutboundMessage {
  const opts = parseOptions(q.options);
  return msg.list(`🧠 *Daily MCQ* — ${q.subject}\n\n${q.question}`, "Answer", [
    {
      title: "Choose one",
      rows: opts.slice(0, 4).map((o, i) => ({ id: encodeAction(D.MCQ, "answer", q.id, i), title: `${letter(i)}) ${o}` })),
    },
  ]);
}

export async function sendToday(ctx: Ctx) {
  const q = await mcq.nextUnseen(ctx.student.id);
  if (!q) return ctx.reply(msg.text("🎉 You've answered all available MCQs! New ones arrive daily at 7 AM. Type *menu*."));
  await mcq.recordDelivery(ctx.student.id, q.id, DeliveryStatus.SENT);
  return ctx.reply(buildMcqMessage(q));
}

async function grade(ctx: Ctx, q: McqQuestion, deliveryId: string, chosenIndex: number) {
  if (await mcq.attemptByDelivery(deliveryId)) {
    return ctx.reply(msg.text("You've already answered this one. ✅ Come back tomorrow at 7 AM for a new MCQ!"));
  }
  const correct = chosenIndex === q.correctIndex;
  const points = correct ? (POINTS[q.difficulty as keyof typeof POINTS] ?? POINTS.MEDIUM) : 0;
  await mcq.recordAttempt({
    deliveryId,
    studentId: ctx.student.id,
    questionId: q.id,
    chosenIndex,
    correct,
    points,
    isoYearWeek: isoYearWeek(),
  });

  const opts = parseOptions(q.options);
  const correctText = `${letter(q.correctIndex)}) ${opts[q.correctIndex] ?? ""}`;
  const head = correct ? `✅ *Correct!* +${points} points 🎉` : `❌ Not quite. Correct answer: *${correctText}*`;
  return ctx.reply(
    msg.buttons(`${head}\n\n💡 ${q.explanation}`, [
      { id: encodeAction(D.BOARD, "show"), title: "🏆 My rank" },
      { id: encodeAction(D.MCQ, "today"), title: "➡️ Next MCQ" },
      { id: encodeAction(D.MENU, "open"), title: "📋 Menu" },
    ]),
  );
}

export async function onAnswer(ctx: Ctx, action: Action) {
  const qid = action.args[0];
  const idx = Number(action.args[1]);
  if (!qid || Number.isNaN(idx)) return ctx.reply(msg.text("Hmm, I couldn't read that answer. Type *menu*."));
  const q = await mcq.questionById(qid);
  if (!q) return ctx.reply(msg.text("That question is no longer available. Type *menu*."));
  const delivery = (await mcq.getDelivery(ctx.student.id, qid)) ?? (await mcq.recordDelivery(ctx.student.id, qid, DeliveryStatus.SENT));
  return grade(ctx, q, delivery.id, idx);
}

/** Handle a plain "A"/"B"/"C"/"D" reply to a proactively-sent (template) MCQ. */
export async function tryAnswerByLetter(ctx: Ctx, text: string): Promise<boolean> {
  const idx = text.trim().toUpperCase().charCodeAt(0) - 65; // A -> 0
  const pending = await mcq.pendingDelivery(ctx.student.id);
  if (!pending) return false;
  const opts = parseOptions(pending.question.options);
  if (idx < 0 || idx >= Math.min(opts.length, 4)) return false;
  await grade(ctx, pending.question, pending.id, idx);
  return true;
}
