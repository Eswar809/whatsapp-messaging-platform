import type { Ctx } from "../core/bot";
import { leaderboard, students } from "../db/repo";
import { msg } from "../whatsapp/msg";
import { encodeAction } from "../util/ids";
import { D } from "../config/constants";
import { isoYearWeek } from "../util/time";

const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`);

export async function showMyRank(ctx: Ctx) {
  const week = isoYearWeek();
  const standings = await leaderboard.standings(week);
  if (!standings.length) {
    return ctx.reply(msg.text("No scores yet this week. Answer today's MCQ to get on the board! 🧠 Type *menu* → Today's MCQ."));
  }

  const names = await students.manyByIds(standings.map((s) => s.studentId));
  const top = standings
    .slice(0, 5)
    .map((s) => `${medal(s.rank)} ${names.get(s.studentId) ?? "Student"} — ${s.points} pts`)
    .join("\n");

  const mine = standings.find((s) => s.studentId === ctx.student.id);
  const youLine = mine
    ? `\n\n👉 *You*: #${mine.rank} (${mine.points} pts)`
    : "\n\nYou're not on the board yet — answer today's MCQ! 🧠";

  return ctx.reply(
    msg.buttons(`🏆 *Weekly Leaderboard* — ${week}\n\n${top}${youLine}`, [
      { id: encodeAction(D.MCQ, "today"), title: "🧠 Today's MCQ" },
      { id: encodeAction(D.MENU, "open"), title: "📋 Menu" },
    ]),
  );
}
