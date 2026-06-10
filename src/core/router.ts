import type { Ctx } from "./bot";
import { parseAction, type Action } from "../util/ids";
import { keywordIntent, type Intent } from "./intents";
import { classifyIntent } from "../ai/triage";
import { sessions } from "../db/repo";
import { D, FlowName } from "../config/constants";
import { msg } from "../whatsapp/msg";
import { handleGreeting, handleMenu, handleStart, handleStop } from "../features/menu";
import { handleFaq } from "../features/faq";
import { listForBrochure, sendBrochure } from "../features/brochure";
import { onBookingAction, onBookingText, startBooking } from "../features/booking";
import { createEnrolLink, listForEnrol } from "../features/payment";
import { handleDoubt } from "../features/doubt";
import { requestHuman } from "../features/mentor";
import { onAnswer, sendToday, tryAnswerByLetter } from "../features/mcq";
import { showMyRank } from "../features/leaderboard";

export async function route(ctx: Ctx) {
  const { inbound } = ctx;
  if (inbound.kind === "interactive" && inbound.replyId) return dispatchAction(ctx, parseAction(inbound.replyId));
  if (inbound.kind === "text" && inbound.text && inbound.text.trim()) return routeText(ctx, inbound.text.trim());
  if (inbound.kind === "media")
    return ctx.reply(msg.text("Thanks, I've received that 📎. A mentor will take a look. Type *menu* for options."));
  return handleMenu(ctx);
}

async function routeText(ctx: Ctx, text: string) {
  const kw = keywordIntent(text);

  // Opt-out / opt-in must always work, even mid-flow.
  if (kw === "STOP") return handleStop(ctx);
  if (kw === "START") return handleStart(ctx);

  // Single-letter answer to a proactively-sent MCQ.
  if (/^[a-d]$/i.test(text) && (await tryAnswerByLetter(ctx, text))) return;

  // Mid-flow? route to the active flow (with an escape hatch).
  const session = await sessions.getActive(ctx.student.id);
  if (session) {
    if (kw === "MENU" || /^(cancel|exit|quit)$/i.test(text)) {
      await sessions.clear(ctx.student.id);
      return handleMenu(ctx);
    }
    if (session.flow === FlowName.BOOKING) return onBookingText(ctx, session);
    await sessions.clear(ctx.student.id); // unknown flow -> reset
  }

  if (kw === "MENU") return handleMenu(ctx);
  if (kw === "GREETING") return handleGreeting(ctx);
  if (kw) return dispatchIntent(ctx, kw, text);

  // Free-form text with no keyword match -> let the AI classify.
  const { intent } = await classifyIntent(ctx.bot.ai, text);
  return dispatchIntent(ctx, intent, text);
}

function dispatchIntent(ctx: Ctx, intent: Intent, text: string) {
  switch (intent) {
    case "FAQ":
      return handleFaq(ctx, text);
    case "BROCHURE":
      return listForBrochure(ctx);
    case "BOOK_DEMO":
      return startBooking(ctx);
    case "ENROL":
      return listForEnrol(ctx);
    case "DOUBT":
      return handleDoubt(ctx, text);
    case "MENTOR":
      return requestHuman(ctx, `User message: "${text}"`);
    case "MCQ_INFO":
      return sendToday(ctx);
    case "LEADERBOARD":
      return showMyRank(ctx);
    case "GREETING":
      return handleGreeting(ctx);
    case "MENU":
      return handleMenu(ctx);
    default:
      return handleFaq(ctx, text); // UNKNOWN -> try to answer as FAQ
  }
}

function dispatchAction(ctx: Ctx, a: Action) {
  switch (a.domain) {
    case D.MENU:
      return handleMenu(ctx);
    case D.FAQ:
      return ctx.reply(msg.text("Sure! Ask me anything — fees, batches, faculty, schedule, syllabus… 📝"));
    case D.BROCHURE:
      return a.action === "send" ? sendBrochure(ctx, a.args[0]) : listForBrochure(ctx);
    case D.BOOK:
      return onBookingAction(ctx, a);
    case D.ENROL:
      return a.action === "course" ? createEnrolLink(ctx, a.args[0]) : listForEnrol(ctx);
    case D.MCQ:
      return a.action === "answer" ? onAnswer(ctx, a) : sendToday(ctx);
    case D.MENTOR:
      return requestHuman(ctx, "User tapped 'Talk to a mentor'");
    case D.BOARD:
      return showMyRank(ctx);
    default:
      return handleMenu(ctx);
  }
}
