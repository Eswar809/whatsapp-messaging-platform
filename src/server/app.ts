import express, { type NextFunction, type Request, type Response } from "express";
import type { Bot } from "../core/bot";
import { createLogger } from "../util/logger";
import { whatsappRouter } from "./webhook";
import { razorpayRouter } from "./razorpay-webhook";

const log = createLogger("http");

export function createServer(bot: Bot) {
  const app = express();

  // Preserve the raw body so webhook signatures (Meta + Razorpay) can be verified.
  app.use(express.json({ verify: (req, _res, buf) => ((req as Request & { rawBody?: Buffer }).rawBody = buf) }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      institute: process.env.INSTITUTE_NAME ?? "wa-edu-bot",
      modes: { wa: bot.wa.mode, ai: bot.ai.mode, calendar: bot.calendar.mode, razorpay: bot.payments.mode },
    });
  });

  app.use("/webhook", whatsappRouter(bot));
  app.use("/razorpay", razorpayRouter(bot));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error("unhandled error", String(err));
    res.status(500).json({ error: "internal" });
  });

  return app;
}
