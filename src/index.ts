import { env } from "./config/env";
import { createBot, describeMode } from "./core/bot";
import { createServer } from "./server/app";
import { startScheduler } from "./jobs/scheduler";
import { prisma } from "./db/client";
import { createLogger } from "./util/logger";

const log = createLogger("main");

async function main() {
  const bot = createBot();
  const modes = describeMode(bot);

  log.info(`Starting ${env.INSTITUTE_NAME} WhatsApp bot…`);
  log.info(
    `Integration modes — WhatsApp: ${modes.whatsapp.toUpperCase()} | Gemini: ${modes.gemini.toUpperCase()} | Calendar: ${modes.calendar.toUpperCase()} | Razorpay: ${modes.razorpay.toUpperCase()}`,
  );
  if (modes.whatsapp === "stub") {
    log.warn("WhatsApp is in STUB mode — outbound messages are only logged. Set WA_* env vars to go live.");
  }

  const app = createServer(bot);
  const server = app.listen(env.PORT, () =>
    log.info(`HTTP listening on :${env.PORT}  (webhook: GET/POST /webhook · health: /health)`),
  );

  const scheduler = startScheduler(bot);

  const shutdown = (sig: string) => {
    log.info(`${sig} received — shutting down`);
    scheduler.stop();
    server.close();
    void prisma.$disconnect();
    setTimeout(() => process.exit(0), 200);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  log.error("fatal startup error", String(e));
  process.exit(1);
});
