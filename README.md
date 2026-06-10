# Pratham WA Bot — Event-Driven WhatsApp Messaging Platform

A 24/7 WhatsApp automation platform for coaching institutes, built on the **official WhatsApp Cloud API** with **Google Gemini** as the AI layer. It runs an institute's admissions desk end-to-end — FAQ answers, brochure delivery, demo-class booking (Google Calendar + Meet), Razorpay payments, doubt triage to faculty, a daily MCQ engine with a weekly leaderboard, and automatic re-engagement of quiet students.

Built and maintained by [Deevi Eswar](https://github.com/Eswar809) at **Pratham AI Labs**.

---

## ⚙️ Engineering highlights

The interesting parts live in how messages get in and out reliably:

| Concern | How it's handled | Where |
|---|---|---|
| **Webhook security** | Every inbound POST verified with HMAC-SHA256 (`X-Hub-Signature-256`) using a **constant-time comparison** | `src/whatsapp/verify.ts` |
| **Fast ACK + async processing** | Webhook is ACKed within Meta's timeout, then each message is processed asynchronously | `src/server/webhook.ts` |
| **Idempotency** | Meta redelivers webhooks on non-200 — inbound messages are deduped by `waMessageId` (DB unique constraint), so redeliveries are absorbed silently | `src/core/handler.ts`, `prisma/schema.prisma` |
| **Retries** | All WhatsApp sends go through a generic retry helper: **exponential backoff + full jitter** (3 attempts, 500 ms base, 8 s cap) with transient-vs-permanent error classification — 429/5xx/network retried, auth errors fail fast | `src/util/retry.ts`, `src/whatsapp/client.ts` |
| **Policy choke point** | WhatsApp's 24-hour customer-service window is enforced at a **single outbound choke point**: free-form messages auto-degrade to pre-approved templates, or are skipped with a persisted audit record — policy limits never crash the service | `src/core/outbound.ts` |
| **Deterministic-first routing** | Button/list taps carry a `domain:action:args` id and route by switch; 12 regex intent rules catch common text; **only unmatched free text reaches Gemini** — cutting per-message AI cost | `src/core/router.ts`, `src/core/intents.ts`, `src/util/ids.ts` |
| **AI resilience** | Gemini calls return schema-constrained JSON with typed fallbacks; any AI failure degrades to safe defaults or human handoff — the bot never crashes on an AI outage | `src/ai/client.ts`, `src/ai/triage.ts` |
| **Scheduled jobs** | 3 timezone-aware cron jobs (daily MCQ, weekly ISO-week leaderboard, 7-day re-engagement) with overlap guards, per-job error isolation, and opt-out filtering | `src/jobs/scheduler.ts` |
| **State machine** | Multi-step flows (demo booking) keep state in a TTL'd `Session` table (30-min expiry, lazy cleanup) | `src/db/repo.ts`, `src/features/booking.ts` |
| **Config & DI** | One Zod schema validates ~25 env vars (fail-fast on bad config); credential presence switches each integration between **live and stub** implementations behind interfaces | `src/config/env.ts`, `src/core/bot.ts` |
| **Payments** | Razorpay payment links + HMAC-verified webhook that idempotently marks payments paid and confirms enrolment on WhatsApp | `src/integrations/razorpay.ts`, `src/server/razorpay-webhook.ts` |
| **Logging** | Zero-dependency leveled logger with hierarchical scopes and **secret redaction** (bearer tokens, API keys never reach logs) | `src/util/logger.ts` |

**Data model:** 16 Prisma/PostgreSQL entities (students, courses, mentors, conversations, sessions, doubt tickets, MCQs, deliveries, attempts, leaderboard snapshots, bookings, payments, broadcasts, re-engagement logs) with DB-level idempotency constraints throughout.

---

## ✨ Features

| # | Feature | What it does |
|---|---------|--------------|
| 1 | **Instant admission FAQ** | Gemini answers fees / batches / faculty / timings, grounded on `src/data/faq.json` + live course data |
| 2 | **Brochure auto-send** | Sends the course PDF + price list |
| 3 | **Demo / 1:1 booking** | Multi-step slot picker → Google Calendar event (+ Meet link) |
| 4 | **Payment links** | One-tap Razorpay payment link; webhook marks it paid + enrols the student |
| 5 | **Doubt triage** | Gemini classifies subject + difficulty (structured JSON) and routes to the right mentor |
| 6 | **Mentor routing** | Forwards the student's context + recent chat to a human mentor |
| 7 | **Daily MCQ engine** | 7 AM cron pushes one MCQ/student; instant feedback + explanation; never repeats a question (DB constraint) |
| 8 | **Leaderboard** | Weekly points (ISO-week buckets), top-5 + your rank on demand |
| 9 | **Result-day blast** | Personalised felicitation broadcast (template) to opted-in students |
| 10 | **Re-engagement** | Cron finds students quiet for 7 days and sends a template nudge (opt-outs respected) |

---

## 🚀 Quick start — runs with ZERO credentials

```bash
npm install
npm run db:push      # create DB + Prisma client
npm run db:seed      # sample courses, mentors, MCQs
npm run dev          # hot-reload via tsx watch
```

With no credentials configured, every integration runs in **STUB mode** — the bot executes full logic and logs what it *would* send:

```
Integration modes — WhatsApp: STUB | Gemini: STUB | Calendar: STUB | Razorpay: STUB
HTTP listening on :3000  (webhook: GET/POST /webhook · health: /health)
```

Simulate an inbound WhatsApp message (PowerShell):

```powershell
$body = '{"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"phone_number_id":"PNID"},"contacts":[{"profile":{"name":"Aarav"},"wa_id":"919812345678"}],"messages":[{"from":"919812345678","id":"wamid.T1","timestamp":"' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '","type":"text","text":{"body":"Hi"}}]}}]}]}'
Invoke-WebRequest http://localhost:3000/webhook -Method Post -ContentType application/json -Body $body
```

Watch the terminal for the reply the bot would send. Inspect data with `npm run db:studio`.

---

## 🧱 Tech stack

- **Node.js 22 + TypeScript** (ESM, run via `tsx` — no build step; `tsc --noEmit` typecheck)
- **Express 5** webhook server · **WhatsApp Cloud API** (Meta Graph, official)
- **Google Gemini** via `@google/genai` (structured-output JSON classification)
- **Prisma 6 + PostgreSQL** (SQLite-switchable for local dev)
- **node-cron** (timezone-aware scheduling) · **Razorpay** · **Google Calendar** (`googleapis`)
- **Docker** / docker-compose / Railway deploy config

---

## 🗂️ Project structure

```
src/
  index.ts              # entry: build bot, start server + cron, graceful shutdown
  config/               # zod env validation (all creds optional) + constants
  util/                 # logger (secret-redacting), retry (backoff+jitter), ids codec, time
  db/                   # Prisma client + repo.ts (all data access)
  whatsapp/             # inbound parser, outbound builders, live/stub client, HMAC verify
  ai/                   # Gemini live/stub client, prompts + schemas, FAQ grounding, triage
  core/                 # bot (DI), outbound 24h-window choke point, router, inbound handler
  features/             # menu, faq, brochure, booking, payment, doubt, mentor, mcq, leaderboard, broadcast, reengage
  integrations/         # google-calendar, razorpay (each live/stub)
  jobs/                 # scheduler.ts — daily MCQ, weekly leaderboard, re-engagement
  server/               # express app + whatsapp/razorpay webhook routes
  data/                 # faq.json, courses.json, mentors.json, mcq.seed.json (demo data)
prisma/
  schema.prisma         # 16-entity data model
  seed.ts               # loads data/*.json
```

---

## 🔌 Going live

Each integration switches from stub to live automatically once its keys are present in `.env` (see `.env.example`). Full production runbooks:

- [`docs/DEPLOY.md`](docs/DEPLOY.md) — deployment guide
- [`docs/LAUNCH.md`](docs/LAUNCH.md) — step-by-step launch checklist (Railway + Meta webhook)
- [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md) — pre-launch verification
- [`docs/whatsapp-templates.md`](docs/whatsapp-templates.md) — approved-template setup for proactive sends

> **Note on the 24-hour window:** WhatsApp only allows free-form replies within 24 h of the user's last message; outside it, only pre-approved templates may be sent. `src/core/outbound.ts` enforces this in one place — proactive jobs degrade to templates or log a skipped-send audit record.

---

## 📜 npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Hot-reload dev server (`tsx watch`) |
| `npm start` | Run once (production) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Sync schema → DB + generate client |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Prisma Studio (visual DB browser) |
