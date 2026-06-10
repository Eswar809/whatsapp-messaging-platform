import type { Mentor } from "@prisma/client";
import type { Ctx } from "../core/bot";
import { conversation, mentors } from "../db/repo";
import { MessageDirection } from "../config/constants";
import { msg } from "../whatsapp/msg";

/**
 * Forward a student's context to a human mentor. Sent directly to the mentor's number
 * (not a Student record). NOTE: outside the mentor's own 24h window this needs an
 * approved template in production; here it's best-effort and logs on failure.
 */
export async function notifyMentor(ctx: Ctx, mentor: Mentor, headline: string, studentMessage: string) {
  const recent = await conversation.recent(ctx.student.id, 8);
  const transcript = recent
    .map((r) => `${r.direction === MessageDirection.INBOUND ? "Student" : "Bot"}: ${r.body}`)
    .join("\n")
    .slice(0, 1200);

  const body =
    `🔔 ${headline}\n\n` +
    `*Student:* ${ctx.student.name ?? "Unknown"} (+${ctx.student.waId})\n` +
    `*Course interest:* ${ctx.student.courseInterest ?? "n/a"}\n\n` +
    `*Message:*\n"${studentMessage}"\n\n` +
    `--- recent chat ---\n${transcript}`;

  const res = await ctx.bot.wa.send(mentor.waNumber, msg.text(body));
  if (!res.ok) {
    ctx.log.warn(`mentor notify to ${mentor.waNumber} failed (likely outside 24h window — needs a template): ${res.error ?? ""}`);
  }
  return res;
}

export async function requestHuman(ctx: Ctx, reason: string) {
  const mentor = (await mentors.listActive())[0] ?? null;
  if (mentor) await notifyMentor(ctx, mentor, "Student requested a mentor", reason);
  return ctx.reply(
    msg.text(
      `👤 Connecting you with our team${mentor ? ` (*${mentor.name}*)` : ""}. They'll message you here shortly!\n\n` +
        `Meanwhile, type *menu* for other options.`,
    ),
  );
}
