import type { Ctx } from "../core/bot";
import { courses, payments, students } from "../db/repo";
import { msg } from "../whatsapp/msg";
import { encodeAction } from "../util/ids";
import { D } from "../config/constants";
import { formatINR } from "../util/money";

export async function listForEnrol(ctx: Ctx) {
  const list = await courses.listActive();
  if (!list.length) return ctx.reply(msg.text("Enrolment is opening soon! Type *menu* for other options."));
  return ctx.reply(
    msg.list("Which course would you like to enrol in? ✅", "Courses", [
      {
        title: "Courses",
        rows: list.map((c) => ({ id: encodeAction(D.ENROL, "course", c.slug), title: c.name, description: formatINR(c.feeInPaise) })),
      },
    ]),
  );
}

export async function createEnrolLink(ctx: Ctx, slug?: string) {
  if (!slug) return listForEnrol(ctx);
  const course = await courses.bySlug(slug);
  if (!course) return ctx.reply(msg.text("Course not found. Type *menu* to see options."));

  const link = await ctx.bot.payments.createLink({
    amountInPaise: course.feeInPaise,
    description: `Enrolment: ${course.name}`,
    name: ctx.student.name ?? undefined,
    contact: ctx.student.waId,
    referenceId: `enrol_${Date.now()}`,
    notes: { courseSlug: course.slug, studentId: ctx.student.id },
  });

  if (!link) return ctx.reply(msg.text("Sorry, I couldn't create the payment link right now. Please try again in a bit. 🙏"));

  await payments.create({
    studentId: ctx.student.id,
    courseId: course.id,
    amountInPaise: course.feeInPaise,
    razorpayLinkId: link.id,
    shortUrl: link.shortUrl,
  });
  await students.setCourseInterest(ctx.student.id, slug);

  return ctx.reply(
    msg.text(
      `✅ *${course.name}* — Fee ${formatINR(course.feeInPaise)}\n\n` +
        `Complete your enrolment securely here 👇\n${link.shortUrl}\n\n` +
        `Once paid, you'll get an instant confirmation here. 🎉`,
    ),
  );
}
