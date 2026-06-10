# Production GO-LIVE Checklist — Pratham AI Labs WhatsApp Bot

This checklist takes the WhatsApp Cloud API app from **Test / Development** mode (which can only message a short list of pre-verified test recipients) to **Live / Production** mode (which can message **any** customer who has opted in).

Work through the sections **in order** — later steps depend on earlier ones (e.g. you cannot raise messaging limits before business verification, and webhooks for real users will not arrive until the app is in Live mode).

> Throughout: "Meta Business Manager" = https://business.facebook.com · "App Dashboard" = https://developers.facebook.com/apps · "WhatsApp Manager" = https://business.facebook.com/wa/manage

---

## 0. Where you are today (Test/Development)

- [ ] Confirm the current setup uses a **test phone number** issued by Meta (App Dashboard → WhatsApp → API Setup). This number can only message **recipients you add manually** to the allowed test list.
- [ ] Confirm the app is currently in **Development** mode (App Dashboard top bar shows a toggle: *Development / Live*).
- [ ] Note your IDs from `.env`: `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `PUBLIC_BASE_URL`. You will need to update the phone-number ID and access token after registering the real number.

---

## 1. Business Verification (KYC) — do this first, it takes the longest

Meta requires your business to be verified before you can scale messaging or use a real number at volume.

- [ ] Go to **Business Settings → Security Center** (https://business.facebook.com/settings/security).
- [ ] Click **Start Verification** for "Pratham AI Labs".
- [ ] Submit the required documents proving the **legal business name + address**. For an Indian business, typical accepted documents:
  - [ ] Certificate of Incorporation / Partnership deed / GST registration certificate
  - [ ] PAN of the business
  - [ ] A utility bill / bank statement showing business name + address (for address proof)
  - [ ] A business phone number and/or business email on the same domain (for the verification call/email)
- [ ] Make sure the business **name and address in Business Settings exactly match the documents** (mismatches are the #1 rejection reason).
- [ ] Submit and wait. **Typical timeline: a few business days** (commonly 2–5; can be longer if documents are re-requested). You will get a notification when approved/rejected.
- [ ] If rejected, read the reason, fix the document mismatch, and resubmit.

> You can keep building/testing while verification is pending — but you cannot go fully Live or raise messaging tiers until it is **Verified**.

---

## 2. Display Name + WhatsApp Business Profile

- [ ] In **WhatsApp Manager → WhatsApp Accounts → (your WABA) → Phone numbers**, set the **Display Name** (this is what customers see, e.g. "Pratham AI Labs").
- [ ] Ensure the display name follows Meta's [display name guidelines](https://developers.facebook.com/docs/whatsapp/overview/display-name) — it should match the business, no prohibited words, no all-caps gimmicks, no URLs.
- [ ] Submit the display name for review (it is **approved separately** from business verification). **Timeline: usually minutes to a couple of days.**
- [ ] Complete the **Business Profile**: profile photo/logo, About text, business category, description, business email, website, address.
- [ ] Confirm display name status shows **Approved** before going live.

---

## 3. Register a REAL business phone number into the WABA

The Meta-issued test number will **never** message real customers. You must add a genuine number you control.

- [ ] Choose a phone number that **is NOT currently registered/active on the regular WhatsApp app or the WhatsApp Business app**. If it is, **delete that WhatsApp account from the phone first** (Settings → Account → Delete my account) — otherwise registration will fail.
  - A fresh SIM / dedicated business line is strongly recommended so staff are not tempted to use it in the consumer app.
- [ ] The number must be able to receive an **SMS or voice OTP** during registration.
- [ ] In **WhatsApp Manager → Phone numbers → Add phone number**, enter the business number and verify it via the OTP.
- [ ] Set a **two-step verification (2FA) PIN** for the number when prompted, and **store this PIN safely** — you will need it to re-register the number later and the API can require it.
- [ ] After it is added, copy the **new Phone Number ID** and update the app's `WA_PHONE_NUMBER_ID`.
- [ ] Generate/refresh a **permanent System User access token** (Business Settings → Users → System Users → generate token with `whatsapp_business_messaging` + `whatsapp_business_management` scopes) and update `WA_ACCESS_TOKEN`. (The token shown in API Setup is temporary — do not ship it.)

> Difference recap: **test number** = works only with manually-added test recipients, no business profile/cost; **real registered number** = your live identity, can message any opted-in customer once the app is Live and verified.

---

## 4. Add a payment method + understand pricing

- [ ] Go to **Business Settings → WhatsApp Accounts → (your WABA) → Payment settings** (or **WhatsApp Manager → Settings → Payment methods**).
- [ ] Add a valid **credit/debit card** (or other supported method for India) as the billing method for the WABA.
- [ ] Confirm the billing account/currency is correct.

**Pricing basics (conversation/message-based):**
- [ ] Understand that WhatsApp bills **per conversation category**: *Utility*, *Authentication*, *Marketing* (and *Service*). Our proactive sends are **Utility** (daily MCQ, re-engage) and **Marketing** (result felicitation) — see `docs/whatsapp-templates.md`.
- [ ] **Service conversations** (i.e. user-initiated, replying within the 24-hour customer service window) have a **free tier** each month; **business-initiated** template messages (Utility/Marketing/Auth) are charged per message/conversation per Meta's India rate card.
- [ ] Note that Meta has been moving to **per-message pricing for templates**; check the current [WhatsApp pricing page](https://developers.facebook.com/docs/whatsapp/pricing) for the live India rates before forecasting cost.
- [ ] Without a valid payment method, **template/business-initiated sends will fail** once you exceed free allowances.

---

## 5. Switch App Mode: Development → LIVE

Until the app is Live, webhooks only fire for test recipients/admins — **real customer inbound messages and status callbacks will silently not arrive**.

- [ ] In the **App Dashboard**, ensure all required items are complete (valid Privacy Policy URL under Settings → Basic; App Icon; Category).
- [ ] Confirm the **webhook** is configured and subscribed: callback URL = `${PUBLIC_BASE_URL}` + your webhook path, verify token = `WA_VERIFY_TOKEN`, and the `messages` field is **subscribed** under WhatsApp → Configuration.
- [ ] Ensure `PUBLIC_BASE_URL` points to your **production HTTPS domain** (not an ngrok URL).
- [ ] Toggle the app mode switch at the top of the App Dashboard from **Development** to **Live**.
- [ ] Re-verify the webhook shows a green/verified status after going Live.

---

## 6. Messaging Limit Tiers + Quality Rating

New numbers start capped and scale up automatically as you send good-quality traffic.

- [ ] Understand the tiers (business-initiated conversations per rolling 24 h, per number):
  - **Tier 0 / unverified:** 250 unique customers/24 h.
  - **Tier 1:** 1,000 unique customers/24 h.
  - **Tier 2:** 10,000 unique customers/24 h.
  - **Tier 3:** 100,000 unique customers/24 h.
  - **Tier 4:** Unlimited.
- [ ] Know that **business verification** + good usage is what unlocks 1K and above; tiers increase automatically when you send to a sufficient number of users at acceptable quality.
- [ ] Monitor **Quality Rating** (Green = High, Yellow = Medium, Red = Low) in WhatsApp Manager → Phone numbers. Low quality (from blocks/"not useful" reports) can **freeze or downgrade** your tier and even restrict the number.
- [ ] Keep our audience to **opted-in, active students** (the bot already targets `listActiveOptedIn`) to protect quality.

---

## 7. Opt-in requirement (policy/legal) — MANDATORY before proactive sends

WhatsApp policy **requires** explicit opt-in before you send any template/proactive message.

- [ ] Confirm every recipient of `daily_mcq`, `reengage_v1`, and `result_felicitation` has given **clear opt-in** to receive WhatsApp messages from Pratham AI Labs.
- [ ] Record **when, where, and how** consent was captured (web form, in-person enrolment, reply keyword, etc.) — keep an auditable record per student.
- [ ] State the business name and the **type/frequency** of messages at the point of opt-in.
- [ ] Provide an easy **opt-out** (e.g. "Reply STOP") and honour it — stop sending to students who opt out.
- [ ] Do not message numbers obtained from purchased/scraped lists.

---

## 8. Final smoke test from a NON-test number

- [ ] Pick a real phone number that is **NOT** on the test-recipient allow list and has **opted in**.
- [ ] Have that number send "Hi" to the live business number → confirm the webhook fires and the bot replies (validates Live mode + webhook + real number).
- [ ] Trigger a proactive **template** send to that number (e.g. run the daily MCQ job or a one-off `reengage_v1`) and confirm it is **delivered** (not just accepted) — check delivery status in logs / WhatsApp Manager.
- [ ] Verify message **cost** appears against your payment method.
- [ ] Confirm the **Quality Rating** stays Green after the first batch.

> Once all boxes above are checked, the bot can message any opted-in customer in production.

---

## Quick reference — what to update in `.env` after go-live

| Variable | Change |
| --- | --- |
| `WA_PHONE_NUMBER_ID` | New ID of the **registered real number** |
| `WA_ACCESS_TOKEN` | **Permanent** System User token |
| `PUBLIC_BASE_URL` | Production HTTPS domain |
| `NODE_ENV` | `production` |
| `TPL_DAILY_MCQ` / `TPL_REENGAGE` / `TPL_RESULT` | Must match the **approved** template names |

See `docs/whatsapp-templates.md` for the three templates that must be approved before any proactive send works.
