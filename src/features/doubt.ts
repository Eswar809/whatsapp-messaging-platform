import type { Ctx } from "../core/bot";
import { classifyDoubt } from "../ai/triage";
import { mentors, tickets } from "../db/repo";
import { D, TicketStatus } from "../config/constants";
import { msg } from "../whatsapp/msg";
import { encodeAction } from "../util/ids";
import { notifyMentor } from "./mentor";

export async function handleDoubt(ctx: Ctx, text: string) {
  const cls = await classifyDoubt(ctx.bot.ai, text);
  const mentor = await mentors.forSubject(cls.subject);

  await tickets.create({
    studentId: ctx.student.id,
    subject: cls.subject,
    difficulty: cls.difficulty,
    question: text,
    mentorId: mentor?.id,
    status: mentor ? TicketStatus.ASSIGNED : TicketStatus.OPEN,
  });

  if (mentor) {
    await notifyMentor(ctx, mentor, `New ${cls.difficulty} doubt in *${cls.subject}*${cls.isComplex ? " (complex)" : ""}`, text);
  }

  const who = mentor ? `*${mentor.name}*` : "our faculty";
  return ctx.reply(
    msg.buttons(
      `Got it! 📚 I've logged your *${cls.subject}* doubt and routed it to ${who}. They'll reply here soon.\n\n_${cls.summary}_`,
      [
        { id: encodeAction(D.MENTOR, "request"), title: "👤 Talk now" },
        { id: encodeAction(D.MENU, "open"), title: "📋 Menu" },
      ],
    ),
  );
}
