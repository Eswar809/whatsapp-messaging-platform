import { env, flags } from "../config/env";
import { createLogger, type Logger } from "../util/logger";
import { retry } from "../util/retry";
import { describeOutbound, toGraphPayload } from "./builders";
import type { OutboundMessage, SendResult } from "./types";

// Graph error codes that are PERMANENT — never worth retrying.
const PERMANENT_GRAPH_CODES = new Set<number>([
  190, // invalid/expired access token (auth)
  131030, // recipient phone number not in allowed list
]);

/** Transient if: network throw, HTTP 429, or HTTP 5xx. Otherwise permanent. */
function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export interface WhatsAppClient {
  readonly mode: "live" | "stub";
  send(to: string, msg: OutboundMessage): Promise<SendResult>;
  markRead(messageId: string): Promise<void>;
}

export function makeWhatsAppClient(log: Logger = createLogger("wa")): WhatsAppClient {
  return flags.hasWhatsApp ? liveClient(log) : stubClient(log);
}

function liveClient(log: Logger): WhatsAppClient {
  const url = `https://graph.facebook.com/${env.WA_GRAPH_VERSION}/${env.WA_PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${env.WA_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };

  return {
    mode: "live",
    async send(to, msg) {
      const payload = toGraphPayload(to, msg);
      const body = JSON.stringify(payload);

      return retry<SendResult>(
        async () => {
          try {
            const res = await fetch(url, { method: "POST", headers, body });
            const json = (await res.json().catch(() => ({}))) as {
              messages?: { id?: string }[];
              error?: { message?: string; code?: number };
            };
            if (!res.ok) {
              const error = json?.error?.message ?? `HTTP ${res.status}`;
              const code = json?.error?.code;
              const permanent = (code !== undefined && PERMANENT_GRAPH_CODES.has(code)) || !isTransientStatus(res.status);
              if (permanent) {
                log.error(`send failed to ${to}: ${error}`, json);
                return { kind: "stop", value: { ok: false, error } };
              }
              // Transient HTTP failure (429 / 5xx): surface for retry.
              return { kind: "retry", error };
            }
            const messageId = json?.messages?.[0]?.id;
            log.debug(`sent ${msg.kind} to ${to}`, messageId);
            return { kind: "ok", value: { ok: true, messageId } };
          } catch (e) {
            // Network/fetch throw — transient, retry.
            return { kind: "retry", error: String(e) };
          }
        },
        (error) => {
          // Attempts exhausted on a transient failure.
          const err = String(error);
          log.error(`send failed to ${to}: ${err}`);
          return { ok: false, error: err };
        },
        {
          attempts: 3,
          baseMs: 500,
          onRetry: ({ attempt, attempts, delayMs, error }) =>
            log.warn(`send to ${to} transient failure (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms`, String(error)),
        },
      );
    },

    async markRead(messageId) {
      // Best-effort: one light retry on a network throw, then give up quietly.
      const body = JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await fetch(url, { method: "POST", headers, body });
          return;
        } catch (e) {
          if (attempt === 1) log.debug(`markRead failed`, String(e));
        }
      }
    },
  };
}

function stubClient(log: Logger): WhatsAppClient {
  return {
    mode: "stub",
    async send(to, msg) {
      log.info(`[STUB -> ${to}] ${describeOutbound(msg)}`);
      return { ok: true, messageId: `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
    },
    async markRead() {
      /* no-op in stub mode */
    },
  };
}
