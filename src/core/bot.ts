import type { Student } from "@prisma/client";
import { makeWhatsAppClient, type WhatsAppClient } from "../whatsapp/client";
import { makeGeminiClient, type GeminiClient } from "../ai/client";
import { makeCalendar, type CalendarPort } from "../integrations/calendar";
import { makePayments, type PaymentPort } from "../integrations/razorpay";
import { createLogger, type Logger } from "../util/logger";
import type { OutboundMessage, ParsedInbound, SendResult } from "../whatsapp/types";

/** Long-lived dependency bundle, built once at startup. */
export interface Bot {
  wa: WhatsAppClient;
  ai: GeminiClient;
  calendar: CalendarPort;
  payments: PaymentPort;
  log: Logger;
}

/** Per-inbound-message handler context passed to features. */
export interface Ctx {
  bot: Bot;
  student: Student;
  inbound: ParsedInbound;
  log: Logger;
  /** Send a message to THIS student (applies the 24h-window rules). */
  reply: (m: OutboundMessage) => Promise<SendResult>;
}

export function createBot(): Bot {
  const log = createLogger("bot");
  return {
    wa: makeWhatsAppClient(log.child("wa")),
    ai: makeGeminiClient(log.child("ai")),
    calendar: makeCalendar(log.child("cal")),
    payments: makePayments(log.child("pay")),
    log,
  };
}

export const describeMode = (bot: Bot) => ({
  whatsapp: bot.wa.mode,
  gemini: bot.ai.mode,
  calendar: bot.calendar.mode,
  razorpay: bot.payments.mode,
});
