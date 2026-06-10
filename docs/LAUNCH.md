# Production Launch — Pratham AI Labs WhatsApp Bot

This is the single, ordered playbook to take the bot from **test mode** (only allowed test recipients can chat with it) → **live production** (any opted-in customer in India can message the live business number and get replies).

Work top-to-bottom. Sections marked **(YOU)** are user-gated actions on Meta / Razorpay / GitHub dashboards. Sections marked **(CODE)** are local CLI commands.

---

## 0. Snapshot — what's already done

- ✅ Bot code complete: webhook server, AI, brochure, booking, payments, MCQ, leaderboard, re-engagement
- ✅ Webhook signature verification (`X-Hub-Signature-256` HMAC) in `src/whatsapp/verify.ts`
- ✅ Permanent System User access token live in `.env`
- ✅ Dockerfile, `.env.production.example`, `docs/DEPLOY.md` ready
- ✅ Git repo initialised, `.env` + `dev.db` + `cloudflared.exe` are gitignored

## What's left (the launch path)

1. Push code to GitHub
2. Deploy to Railway (Postgres + always-on + stable HTTPS URL)
3. Meta business verification + register real business number + payment + Live mode
4. Submit and approve 3 message templates
5. Update Meta webhook to the Railway URL
6. Smoke test from a real customer number

---

## 1. (YOU + CODE) Push to GitHub

The repo is already commit-ready. Two ways:

### A. With `gh` CLI (if installed)
```powershell
gh auth login                                  # browser flow, GitHub.com → HTTPS → login
gh repo create pratham-wa-bot --private --source=. --remote=origin --push
```

### B. Manual (no `gh`)
1. Go to https://github.com/new → create empty private repo named `pratham-wa-bot` (no README/.gitignore/license)
2. Copy the repo URL (e.g. `https://github.com/<you>/pratham-wa-bot.git`)
3. Run:
```powershell
git remote add origin https://github.com/<you>/pratham-wa-bot.git
git branch -M main
git push -u origin main
```

**Verify:** `git log --oneline` shows the `init:` commit; the repo on github.com shows all files except `.env` / `dev.db` / `cloudflared.exe`.

---

## 2. (CODE) Switch Prisma provider to Postgres

Railway will host a free Postgres. SQLite is fine locally; for prod swap once:

Edit `prisma/schema.prisma`, line 8:
```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Commit:
```powershell
git add prisma/schema.prisma
git commit -m "chore(db): switch Prisma provider to postgresql for production"
git push
```

(You can leave it on `postgresql` even for local dev — just point `DATABASE_URL` at a Docker Postgres locally, or revert briefly if you need SQLite testing.)

---

## 3. (YOU) Deploy to Railway

Railway gives you free $5/mo credit, always-on Node, built-in Postgres, stable HTTPS URL.

### 3.1 Create the project
1. Go to https://railway.app → **Sign in with GitHub** → authorise.
2. Click **New Project** → **Deploy from GitHub repo** → pick `pratham-wa-bot`.
3. Railway auto-detects the Dockerfile and starts the first build (it'll **fail** until env vars + Postgres are set — that's expected).

### 3.2 Add Postgres
1. In the project, **New** → **Database** → **Add PostgreSQL**.
2. Wait ~30s for it to provision. Railway adds a `DATABASE_URL` to the project automatically.
3. Open your **bot service** → **Variables** tab → click **Add Reference** → pick `Postgres.DATABASE_URL`. The variable shows up as `DATABASE_URL` referencing the Postgres instance.

### 3.3 Set the rest of the env vars
Bot service → **Variables** → **Raw Editor** → paste (replace placeholders with real values from your local `.env`):

```env
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://placeholder-update-after-step-3.5.up.railway.app

INSTITUTE_NAME=Pratham AI Labs
TIMEZONE=Asia/Kolkata

GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=<your-gemini-api-key>

WA_PHONE_NUMBER_ID=<your-phone-number-id>
WA_BUSINESS_ACCOUNT_ID=<your-waba-id>
WA_GRAPH_VERSION=v23.0
WA_VERIFY_TOKEN=<your-verify-token>
WA_ACCESS_TOKEN=<paste your permanent System User token here>
WA_APP_SECRET=<get from Meta App Dashboard → Settings → Basic → App Secret>

DAILY_MCQ_CRON=0 7 * * *
WEEKLY_LEADERBOARD_CRON=0 8 * * 1
REENGAGE_CRON=0 10 * * *
REENGAGE_AFTER_DAYS=7

TPL_DAILY_MCQ=daily_mcq
TPL_REENGAGE=reengage_v1
TPL_RESULT=result_felicitation
TPL_LANG=en

LOG_LEVEL=info
```

Save. Railway redeploys automatically.

### 3.4 Get the public domain
Bot service → **Settings** → **Networking** → **Generate Domain**. You get something like `https://pratham-wa-bot-production.up.railway.app`.

Update `PUBLIC_BASE_URL` in **Variables** to this exact URL. Save → redeploy.

### 3.5 Run schema + seed once
Bot service → top-right **⋯** → **Open in Shell** (or use `railway run` locally if you install the CLI). Run:
```bash
npm run db:push     # creates all tables in Postgres
npm run db:seed     # loads courses, mentors, FAQ, MCQs
```

### 3.6 Verify deployment
- Open `https://<your-railway-domain>/health` in browser → should respond OK.
- Check Railway **Deployments → Logs** — should show `whatsapp bot listening on :3000` and cron registrations.

---

## 4. (YOU) Update Meta webhook to point at Railway

1. Meta App Dashboard → your app → **WhatsApp → Configuration**.
2. **Webhook → Edit**:
   - Callback URL: `https://<your-railway-domain>/webhook`
   - Verify token: `<your-verify-token>` (must match `WA_VERIFY_TOKEN`)
3. Click **Verify and save** — Meta sends a `GET /webhook` challenge. Should succeed (Railway logs will show the GET).
4. In **Webhook fields**, ensure **messages** is **Subscribed**.

Send a "Hi" from your already-allowed test number. The bot now replies **from Railway**, not your laptop. You can stop the local `npm start` and shut down cloudflared.

---

## 5. (YOU) Get `WA_APP_SECRET` (webhook signature validation)

Currently the bot accepts any POST to `/webhook` because `WA_APP_SECRET` is empty — a security risk in prod.

1. Meta App Dashboard → your app → **Settings → Basic**.
2. Find **App Secret** → click **Show** → enter your Facebook password.
3. Copy the value → paste into Railway **Variables** as `WA_APP_SECRET`. Save.

Now every inbound is HMAC-verified against Meta's signature.

---

## 6. (YOU) Business Verification — **start this NOW, takes 2–5 days**

Until verified, the app cannot go Live and you stay capped at ~250 unique recipients/24 h.

1. Go to **Business Settings → Security Center** at https://business.facebook.com/settings/security
2. Click **Start Verification** for **Pratham AI Labs**.
3. Upload:
   - Certificate of Incorporation / Partnership deed / **GST registration** (any one)
   - Business **PAN**
   - Utility bill or bank statement showing business name + address
4. Make sure the **exact business name + address** in Business Settings matches the documents (mismatches = #1 rejection reason).
5. Submit. Wait. You'll get an email when approved/rejected.

> You can do every other step below in parallel — verification just needs to be done before you flip to Live.

---

## 7. (YOU) Add a real business phone number

The Meta-issued test number never works for real customers — you must register your own.

1. Pick a phone number that is **NOT** currently active on WhatsApp / WhatsApp Business app. (If it is, delete the WhatsApp account from the phone first: Settings → Account → Delete my account.)
2. Meta Business Manager → **WhatsApp Manager → Phone numbers → Add phone number**.
3. Enter the number, choose SMS/voice OTP → verify.
4. Set a **2FA PIN** when prompted — **store it safely** (you'll need it to re-register).
5. Once added:
   - Copy the new **Phone Number ID** → update `WA_PHONE_NUMBER_ID` in Railway Variables.
   - The permanent access token still works (it's scoped at the WABA level).

### Display name
1. WhatsApp Manager → your WABA → Phone numbers → click the number → **Display name** → set to **Pratham AI Labs**.
2. Submit for review. Usually approved in minutes to a couple of days.
3. Fill the **Business Profile** (logo, about, category = Education, description, email, website, address). This is what customers see when they tap the chat header.

---

## 8. (YOU) Add a payment method

Without this, business-initiated template sends fail past the free tier.

1. Business Settings → **WhatsApp Accounts → (your WABA) → Payment settings**.
2. Add a credit/debit card. Currency = INR.
3. Pricing recap (India, Nov 2025):
   - **Service** convs (user-initiated, 24 h window) — free tier each month, then ~paise per message
   - **Utility** templates (daily MCQ, re-engage) — billed per message
   - **Marketing** templates (result felicitation, promos) — billed per message
   - Live rates: https://developers.facebook.com/docs/whatsapp/pricing

---

## 9. (YOU) Submit the 3 message templates

These power proactive sends (outside 24 h window).

1. WhatsApp Manager → **Message templates → Create Template**.
2. Submit each of these exactly (full text + variables in `docs/whatsapp-templates.md`):

| Name | Category | Variables |
|---|---|---|
| `daily_mcq` | **Utility** | `{{1}}` student name, `{{2}}` subject |
| `reengage_v1` | **Marketing** | `{{1}}` student name |
| `result_felicitation` | **Marketing** | `{{1}}` student name |

Each template is **approved separately** (usually minutes to 24 h). Until then, the cron jobs that send them will fail silently (logged as `template not approved`).

---

## 10. (YOU) Flip the app to **Live** mode

Once business verification is **Approved** and at least one template is approved:

1. Meta App Dashboard → app top bar → **App mode** toggle → switch **Development → Live**.
2. Required before Live:
   - ✅ Privacy Policy URL (Settings → Basic). Use https://prathamailabs.com/privacy or similar.
   - ✅ App Icon + Category set.
   - ✅ Webhook verified.
3. After flipping: real customer messages now reach your webhook. The 250/24 h tier 0 cap is active until messaging quality bumps you to Tier 1 (1k/24 h) automatically.

---

## 11. (YOU) Smoke test from a real customer number

Final validation that "anni nums ki work avtundi":

1. Borrow a friend's phone (a number that is NOT in the test allow list).
2. Have them save your live business number and send "Hi".
3. Watch Railway logs — you should see the inbound + the bot's reply.
4. Have them tap through Brochure → a course → Enrol now → they should get a Razorpay payment link.
5. Wait until 7 AM next day (`Asia/Kolkata`) — they should receive the `daily_mcq` template send (assumes they have `optedIn=true` in the DB).

---

## 12. (Optional) Razorpay live mode

The bot currently uses Razorpay stub keys. To accept real payments:

1. Razorpay Dashboard → Settings → API Keys → generate **Live mode** keys.
2. Add to Railway Variables:
   ```
   RAZORPAY_KEY_ID=rzp_live_xxx
   RAZORPAY_KEY_SECRET=xxx
   RAZORPAY_WEBHOOK_SECRET=xxx
   ```
3. Razorpay → Settings → Webhooks → add `https://<railway-domain>/razorpay/webhook` with events `payment_link.paid`, `payment.captured`. Use the same secret as above.

---

## Order of operations summary

| # | Step | Who | Time | Blocked by |
|---|---|---|---|---|
| 1 | Push to GitHub | YOU | 5 min | — |
| 2 | Switch Prisma → Postgres | CODE | 1 min | 1 |
| 3 | Railway deploy + Postgres + env + URL | YOU | 20 min | 1, 2 |
| 4 | Update Meta webhook → Railway URL | YOU | 5 min | 3 |
| 5 | Add WA_APP_SECRET | YOU | 5 min | 3 |
| 6 | **Business verification** | YOU | 2–5 days | — *(start NOW)* |
| 7 | Real number + display name | YOU | 1–2 hr active | — |
| 8 | Payment method | YOU | 10 min | — |
| 9 | Submit 3 templates | YOU | 30 min | 7 |
| 10 | Flip to Live mode | YOU | 1 min | 6, 7, 8 |
| 11 | Smoke test | YOU | 15 min | 10 |
| 12 | Razorpay live | YOU | 30 min | optional |

**Critical path:** 6 (verification) is the wall-clock bottleneck. Do 1–5 today; submit 6 today; do 7–9 while waiting; flip to Live as soon as 6 lands.
