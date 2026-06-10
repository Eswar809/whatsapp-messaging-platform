import "dotenv/config";
import { z } from "zod";

// A boolean parsed from an env string: only "true"/"1" are true; default applies when unset.
const boolStr = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : ["true", "1", "yes"].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().optional(),

  // WhatsApp Cloud API
  WA_PHONE_NUMBER_ID: z.string().optional(),
  WA_ACCESS_TOKEN: z.string().optional(),
  WA_VERIFY_TOKEN: z.string().default("change-me-verify-token"),
  WA_APP_SECRET: z.string().optional(),
  WA_GRAPH_VERSION: z.string().default("v23.0"),
  WA_BUSINESS_ACCOUNT_ID: z.string().optional(),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),

  // Database
  DATABASE_URL: z.string().default("file:./dev.db"),

  // Institute
  INSTITUTE_NAME: z.string().default("Pratham Academy"),
  TIMEZONE: z.string().default("Asia/Kolkata"),
  DAILY_MCQ_CRON: z.string().default("0 7 * * *"),
  WEEKLY_LEADERBOARD_CRON: z.string().default("0 8 * * 1"),
  REENGAGE_CRON: z.string().default("0 10 * * *"),
  REENGAGE_AFTER_DAYS: z.coerce.number().default(7),

  // Approved template names (for proactive sends outside the 24h window)
  TPL_DAILY_MCQ: z.string().default("daily_mcq"),
  TPL_REENGAGE: z.string().default("reengage_v1"),
  TPL_RESULT: z.string().default("result_felicitation"),
  TPL_LANG: z.string().default("en"),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Google Calendar
  GCAL_CALENDAR_ID: z.string().default("primary"),
  GCAL_SA_EMAIL: z.string().optional(),
  GCAL_SA_PRIVATE_KEY: z.string().optional(),
  GCAL_SEND_MEET_LINK: boolStr(true),

  LOG_LEVEL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Only malformed REQUIRED app config lands here (e.g. non-numeric PORT).
  console.error("[env] Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

// Feature flags derived from presence of credentials. Drive live-vs-stub selection.
export const flags = {
  hasWhatsApp: Boolean(env.WA_PHONE_NUMBER_ID && env.WA_ACCESS_TOKEN),
  hasWebhookSignature: Boolean(env.WA_APP_SECRET),
  hasGemini: Boolean(env.GEMINI_API_KEY),
  hasRazorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  hasGoogleCalendar: Boolean(env.GCAL_SA_EMAIL && env.GCAL_SA_PRIVATE_KEY),
} as const;

export const isProd = env.NODE_ENV === "production";
