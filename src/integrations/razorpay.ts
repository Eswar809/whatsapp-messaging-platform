import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env, flags } from "../config/env";
import type { Logger } from "../util/logger";

export interface PaymentLink {
  id: string;
  shortUrl: string;
}

export interface PaymentPort {
  readonly mode: "live" | "stub";
  createLink(opts: {
    amountInPaise: number;
    description: string;
    name?: string;
    contact?: string;
    email?: string;
    referenceId?: string;
    notes?: Record<string, string>;
  }): Promise<PaymentLink | null>;
  verifyWebhook(rawBody: Buffer | undefined, signature?: string): boolean;
}

export function makePayments(log: Logger): PaymentPort {
  if (!flags.hasRazorpay) {
    log.warn("Razorpay creds missing — STUB mode (fake payment links)");
    return stub(log);
  }
  return live(log);
}

function live(log: Logger): PaymentPort {
  const rzp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID as string, key_secret: env.RAZORPAY_KEY_SECRET as string });

  return {
    mode: "live",
    async createLink(o) {
      try {
        const params = {
          amount: o.amountInPaise,
          currency: "INR",
          accept_partial: false,
          description: o.description,
          reference_id: o.referenceId ?? `enrol_${Date.now()}`,
          customer: { name: o.name ?? "Student", contact: o.contact, email: o.email },
          notify: { sms: false, email: Boolean(o.email) },
          reminder_enable: true,
          notes: o.notes ?? {},
          ...(env.PUBLIC_BASE_URL ? { callback_url: `${env.PUBLIC_BASE_URL}/payment/callback`, callback_method: "get" } : {}),
        };
        const link = (await rzp.paymentLink.create(params as never)) as { id: string; short_url: string };
        return { id: link.id, shortUrl: link.short_url };
      } catch (e) {
        log.error("createLink failed", String(e));
        return null;
      }
    },
    verifyWebhook(rawBody, signature) {
      if (!env.RAZORPAY_WEBHOOK_SECRET || !rawBody || !signature) return false;
      const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },
  };
}

function stub(log: Logger): PaymentPort {
  return {
    mode: "stub",
    async createLink(o) {
      const id = `plink_stub_${Date.now()}`;
      log.info(`[STUB razorpay] link ${id} for ${o.amountInPaise} paise — ${o.description}`);
      return { id, shortUrl: `https://rzp.io/i/stub-${id}` };
    },
    verifyWebhook() {
      return false;
    },
  };
}
