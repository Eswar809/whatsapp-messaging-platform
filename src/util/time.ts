import { env } from "../config/env";
import { SESSION_WINDOW_MS } from "../config/constants";

export const now = () => new Date();

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export const minutesFromNow = (n: number) => new Date(Date.now() + n * 60_000);

/** True if the student's last inbound message was within the 24h customer-service window. */
export function isWithinSessionWindow(lastInboundAt?: Date | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < SESSION_WINDOW_MS;
}

/** Human-readable timestamp in the institute's timezone. */
export function formatIST(d: Date): string {
  return d.toLocaleString("en-IN", { timeZone: env.TIMEZONE, hour12: true });
}

export function formatSlot(start: Date, end: Date): string {
  const date = start.toLocaleDateString("en-IN", {
    timeZone: env.TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const t = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: env.TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${t(start)}-${t(end)}`;
}

/** Compact slot label suitable for a button title (e.g. "Tue 27, 5:00 PM"). */
export function formatSlotShort(start: Date): string {
  const day = start.toLocaleDateString("en-IN", { timeZone: env.TIMEZONE, weekday: "short", day: "numeric" });
  const t = start.toLocaleTimeString("en-IN", { timeZone: env.TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}, ${t}`;
}

/** Extract Y/M/D as seen in the institute timezone. */
function ymdInTz(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** ISO-8601 year-week bucket (e.g. "2026-W21") computed in the institute timezone. */
export function isoYearWeek(date: Date = new Date()): string {
  const { y, m, d } = ymdInTz(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3); // move to Thursday of this week
  const isoYear = dt.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** ISO week of the previous week (for the Monday leaderboard job). */
export function previousIsoYearWeek(date: Date = new Date()): string {
  return isoYearWeek(new Date(date.getTime() - 7 * 86_400_000));
}
