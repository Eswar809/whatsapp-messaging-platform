import cron from "node-cron";
import { env } from "../config/env";
import type { Bot } from "../core/bot";
import type { Logger } from "../util/logger";
import type { OutboundMessage } from "../whatsapp/types";
import { sendTo } from "../core/outbound";
import { leaderboard, mcq, students } from "../db/repo";
import { buildMcqMessage } from "../features/mcq";
import { reengageStale } from "../features/reengage";
import { DeliveryStatus } from "../config/constants";
import { previousIsoYearWeek } from "../util/time";

const running = new Set<string>();
async function guard(log: Logger, name: string, fn: () => Promise<unknown>) {
  if (running.has(name)) {
    log.warn(`job ${name} still running — skipping this tick`);
    return;
  }
  running.add(name);
  try {
    await fn();
  } catch (e) {
    log.error(`job ${name} failed`, String(e));
  } finally {
    running.delete(name);
  }
}

export function startScheduler(bot: Bot) {
  const log = bot.log.child("cron");
  const tz = env.TIMEZONE;
  const tasks = [
    cron.schedule(env.DAILY_MCQ_CRON, () => guard(log, "daily-mcq", () => runDailyMcq(bot)), { timezone: tz }),
    cron.schedule(env.WEEKLY_LEADERBOARD_CRON, () => guard(log, "weekly-leaderboard", () => runWeeklyLeaderboard(bot)), { timezone: tz }),
    cron.schedule(env.REENGAGE_CRON, () => guard(log, "reengage", () => reengageStale(bot)), { timezone: tz }),
  ];
  log.info(
    `scheduled — mcq:"${env.DAILY_MCQ_CRON}" leaderboard:"${env.WEEKLY_LEADERBOARD_CRON}" reengage:"${env.REENGAGE_CRON}" tz:${tz}`,
  );
  return { stop: () => tasks.forEach((t) => t.stop()) };
}

export async function runDailyMcq(bot: Bot) {
  const audience = await students.listActiveOptedIn();
  let sent = 0;
  let skipped = 0;
  let exhausted = 0;
  for (const s of audience) {
    const q = await mcq.nextUnseen(s.id);
    if (!q) {
      exhausted++;
      continue;
    }
    // Interactive when the student's window is open; otherwise falls back to the approved template.
    const message = {
      ...buildMcqMessage(q),
      template: { name: env.TPL_DAILY_MCQ, lang: env.TPL_LANG, bodyParams: [q.subject, q.question] },
    } as OutboundMessage;
    const res = await sendTo(bot, s, message);
    await mcq.recordDelivery(s.id, q.id, res.ok ? DeliveryStatus.SENT : DeliveryStatus.SKIPPED);
    if (res.ok) sent++;
    else skipped++;
  }
  bot.log.info(`daily MCQ: sent=${sent} skipped=${skipped} exhausted=${exhausted} (audience=${audience.length})`);
  return { sent, skipped, exhausted };
}

export async function runWeeklyLeaderboard(bot: Bot) {
  const week = previousIsoYearWeek();
  const standings = await leaderboard.standings(week);
  if (standings.length) await leaderboard.snapshotWeek(week, standings);
  bot.log.info(`weekly leaderboard snapshot for ${week}: ${standings.length} students`);
  return { week, count: standings.length };
}
