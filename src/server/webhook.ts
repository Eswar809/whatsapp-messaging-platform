import { Router, type Request } from "express";
import type { Bot } from "../core/bot";
import type { WAWebhookBody } from "../whatsapp/types";
import { isValidSignature, verifyChallenge } from "../whatsapp/verify";
import { parseWebhook } from "../whatsapp/inbound";
import { processInbound } from "../core/handler";
import { createLogger } from "../util/logger";

const log = createLogger("http:wa");
type RawReq = Request & { rawBody?: Buffer };

export function whatsappRouter(bot: Bot) {
  const r = Router();

  // Meta webhook verification handshake.
  r.get("/", (req, res) => {
    const challenge = verifyChallenge(req.query as Record<string, unknown>);
    if (challenge) {
      res.status(200).send(challenge);
      return;
    }
    res.sendStatus(403);
  });

  // Inbound messages + delivery statuses.
  r.post("/", (req, res) => {
    const raw = (req as RawReq).rawBody;
    if (!isValidSignature(raw, req.get("x-hub-signature-256"))) {
      log.warn("invalid webhook signature — rejected");
      res.sendStatus(401);
      return;
    }
    res.sendStatus(200); // ack within Meta's timeout, then process asynchronously
    const { inbound } = parseWebhook(req.body as WAWebhookBody);
    for (const m of inbound) {
      processInbound(bot, m).catch((e) => log.error("processInbound failed", String(e)));
    }
  });

  return r;
}
