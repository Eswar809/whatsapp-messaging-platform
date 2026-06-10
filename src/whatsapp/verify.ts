import crypto from "node:crypto";
import { env, flags } from "../config/env";
import { createLogger } from "../util/logger";

const log = createLogger("wa:verify");

/** Webhook GET verification: echo hub.challenge when mode + verify_token match. */
export function verifyChallenge(query: Record<string, unknown>): string | null {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && token === env.WA_VERIFY_TOKEN && typeof challenge === "string") {
    return challenge;
  }
  return null;
}

/** Validate X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app secret). */
export function isValidSignature(rawBody: Buffer | undefined, signatureHeader?: string): boolean {
  if (!flags.hasWebhookSignature) {
    // No app secret configured (dev/stub) -> can't verify; allow but warn.
    log.debug("WA_APP_SECRET not set — skipping webhook signature check");
    return true;
  }
  if (!rawBody || !signatureHeader) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", env.WA_APP_SECRET as string).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
