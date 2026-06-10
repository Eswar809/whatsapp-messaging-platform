import type { Bot } from "../core/bot";
import { broadcasts, students } from "../db/repo";
import { DeliveryStatus } from "../config/constants";
import { env } from "../config/env";
import { msg } from "../whatsapp/msg";
import { sendTo } from "../core/outbound";

/**
 * Result-day blast: personalised felicitation to every opted-in student.
 * Proactive => template send. `bodyParams` maps a student to the template's body params.
 */
export async function resultBlast(
  bot: Bot,
  opts: { templateName?: string; note?: string; bodyParams?: (s: { name: string }) => string[] } = {},
) {
  const templateName = opts.templateName ?? env.TPL_RESULT;
  const job = await broadcasts.createJob({ type: "RESULT_BLAST", templateName, note: opts.note });
  const audience = await students.listActiveOptedIn();

  let sent = 0;
  let skipped = 0;
  for (const s of audience) {
    const params = opts.bodyParams ? opts.bodyParams({ name: s.name ?? "Student" }) : [s.name ?? "Student"];
    const res = await sendTo(bot, s, msg.template({ name: templateName, lang: env.TPL_LANG, bodyParams: params }));
    const status = res.ok ? DeliveryStatus.SENT : DeliveryStatus.SKIPPED;
    await broadcasts.addRecipient({ jobId: job.id, studentId: s.id, status, error: res.error });
    if (res.ok) sent++;
    else skipped++;
  }

  bot.log.info(`resultBlast "${templateName}": sent=${sent} skipped=${skipped} (audience=${audience.length})`);
  return { jobId: job.id, sent, skipped };
}
