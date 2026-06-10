import type { Ctx } from "../core/bot";
import type { OutboundMessage } from "../whatsapp/types";
import { msg } from "../whatsapp/msg";
import { encodeAction } from "../util/ids";
import { D } from "../config/constants";
import { env } from "../config/env";
import { students } from "../db/repo";

export function mainMenu(): OutboundMessage {
  return msg.list(
    `Hi! 👋 I'm the *${env.INSTITUTE_NAME}* assistant. How can I help you today?`,
    "Menu",
    [
      {
        title: "Options",
        rows: [
          { id: encodeAction(D.FAQ, "ask"), title: "❓ Ask a question", description: "Fees, batches, faculty, timings" },
          { id: encodeAction(D.BROCHURE, "list"), title: "📄 Get a brochure", description: "Course details + price list" },
          { id: encodeAction(D.BOOK, "start", "DEMO"), title: "🎬 Book a demo class", description: "Free trial / counselling" },
          { id: encodeAction(D.ENROL, "list"), title: "✅ Enrol / Pay", description: "Secure your seat online" },
          { id: encodeAction(D.MCQ, "today"), title: "🧠 Today's MCQ", description: "Daily practice question" },
          { id: encodeAction(D.BOARD, "show"), title: "🏆 My rank", description: "Weekly leaderboard" },
          { id: encodeAction(D.MENTOR, "request"), title: "👤 Talk to a mentor", description: "Connect with faculty" },
        ],
      },
    ],
  );
}

export const handleMenu = (ctx: Ctx) => ctx.reply(mainMenu());

export function handleGreeting(ctx: Ctx) {
  return ctx.reply(
    msg.buttons(
      `Namaste! 🙏 Welcome to *${env.INSTITUTE_NAME}*.\nI can answer your questions, send brochures, book a free demo, or help you enrol.`,
      [
        { id: encodeAction(D.MENU, "open"), title: "📋 Menu" },
        { id: encodeAction(D.BROCHURE, "list"), title: "📄 Brochure" },
        { id: encodeAction(D.BOOK, "start", "DEMO"), title: "🎬 Book demo" },
      ],
    ),
  );
}

export async function handleStop(ctx: Ctx) {
  await students.setOptIn(ctx.student.id, false);
  return ctx.reply(msg.text("You've been unsubscribed from daily messages. 👋 Reply *start* anytime to opt back in."));
}

export async function handleStart(ctx: Ctx) {
  await students.setOptIn(ctx.student.id, true);
  return ctx.reply(msg.text("Welcome back! ✅ You'll now receive daily MCQs and updates. Type *menu* to explore."));
}
