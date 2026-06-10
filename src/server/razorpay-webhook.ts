import { Router, type Request } from "express";
import type { Bot } from "../core/bot";
import { payments, students } from "../db/repo";
import { sendTo } from "../core/outbound";
import { msg } from "../whatsapp/msg";
import { createLogger } from "../util/logger";

const log = createLogger("http:rzp");
type RawReq = Request & { rawBody?: Buffer };

export function razorpayRouter(bot: Bot) {
  const r = Router();

  r.post("/webhook", async (req, res) => {
    const raw = (req as RawReq).rawBody;
    if (!bot.payments.verifyWebhook(raw, req.get("x-razorpay-signature"))) {
      res.sendStatus(400);
      return;
    }
    res.sendStatus(200); // ack fast

    try {
      const body = req.body as {
        event?: string;
        payload?: { payment_link?: { entity?: { id?: string } } };
      };
      if (body.event === "payment_link.paid" || body.event === "payment.captured") {
        const linkId = body.payload?.payment_link?.entity?.id;
        if (linkId) {
          await payments.updateStatusByLinkId(linkId, "PAID", new Date());
          const pay = await payments.byLinkId(linkId);
          const student = pay ? await students.byId(pay.studentId) : null;
          if (pay && student) {
            if (pay.courseId) await students.setEnrolled(student.id, pay.courseId);
            await sendTo(
              bot,
              student,
              msg.text("🎉 Payment received — welcome aboard! Your enrolment is confirmed. Our team will reach out with next steps."),
            );
          }
        }
      }
    } catch (e) {
      log.error("razorpay handler failed", String(e));
    }
  });

  return r;
}
