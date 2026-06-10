import type { Ctx } from "../core/bot";
import { brochures, courses, students } from "../db/repo";
import { msg } from "../whatsapp/msg";
import { encodeAction } from "../util/ids";
import { D } from "../config/constants";
import { formatINR } from "../util/money";

export async function listForBrochure(ctx: Ctx) {
  const list = await courses.listActive();
  if (!list.length) return ctx.reply(msg.text("Brochures will be available soon. Type *menu* for other options."));
  return ctx.reply(
    msg.list("Which course brochure would you like? 📄", "Courses", [
      {
        title: "Courses",
        rows: list.map((c) => ({ id: encodeAction(D.BROCHURE, "send", c.slug), title: c.name, description: formatINR(c.feeInPaise) })),
      },
    ]),
  );
}

export async function sendBrochure(ctx: Ctx, slug?: string) {
  if (!slug) return listForBrochure(ctx);
  const course = await courses.bySlug(slug);
  if (!course) return ctx.reply(msg.text("Sorry, I couldn't find that course. Type *menu* to see options."));

  await students.setCourseInterest(ctx.student.id, slug);
  const b = await brochures.forCourse(course.id);

  const caption =
    `📄 *${course.name}*\n${course.description ?? ""}\n\n*Fee:* ${formatINR(course.feeInPaise)}` +
    (course.batchInfo ? `\n*Batch:* ${course.batchInfo}` : "") +
    (course.facultyName ? `\n*Faculty:* ${course.facultyName}` : "");

  if (b && (b.link || b.mediaId)) {
    await ctx.reply(
      msg.document({ link: b.link ?? undefined, mediaId: b.mediaId ?? undefined, filename: `${course.slug}.pdf`, caption }),
    );
  } else {
    await ctx.reply(msg.text(caption + "\n\n_(Brochure PDF not configured yet — our team will share it.)_"));
  }
  if (b?.priceList) await ctx.reply(msg.text(b.priceList));

  return ctx.reply(
    msg.buttons("Anything else? 😊", [
      { id: encodeAction(D.BOOK, "start", "DEMO"), title: "🎬 Book demo" },
      { id: encodeAction(D.ENROL, "course", slug), title: "✅ Enrol now" },
      { id: encodeAction(D.MENTOR, "request"), title: "👤 Mentor" },
    ]),
  );
}
