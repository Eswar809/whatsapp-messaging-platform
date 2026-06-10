import type { Bot } from "../core/bot";
import { reengagement, students } from "../db/repo";
import { DeliveryStatus } from "../config/constants";
import { env } from "../config/env";
import { msg } from "../whatsapp/msg";
import { sendTo } from "../core/outbound";

/** Re-engage students who've gone quiet for REENGAGE_AFTER_DAYS (proactive => template). */
export async function reengageStale(bot: Bot) {
  const stale = await students.findStaleForReengage(env.REENGAGE_AFTER_DAYS);

  let sent = 0;
  let skipped = 0;
  for (const s of stale) {
    const res = await sendTo(bot, s, msg.template({ name: env.TPL_REENGAGE, lang: env.TPL_LANG, bodyParams: [s.name ?? "there"] }));
    const status = res.ok ? DeliveryStatus.SENT : DeliveryStatus.SKIPPED;
    await reengagement.log(s.id, status);
    if (res.ok) sent++;
    else skipped++;
  }

  bot.log.info(`reengage: candidates=${stale.length} sent=${sent} skipped=${skipped}`);
  return { candidates: stale.length, sent, skipped };
}
