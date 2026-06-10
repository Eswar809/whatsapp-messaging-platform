# Deploying wa-edu-bot to Production

This bot is an **always-on Node.js process**. It does two things at once:

1. Runs an Express webhook server on `PORT` (default `3000`) at `/webhook`
   (plus a `/health` endpoint).
2. Runs **node-cron** jobs inside the same process:
   - Daily MCQ at 7 AM (`DAILY_MCQ_CRON=0 7 * * *`)
   - Weekly leaderboard Mondays 8 AM (`WEEKLY_LEADERBOARD_CRON=0 8 * * 1`)
   - Re-engagement at 10 AM (`REENGAGE_CRON=0 10 * * *`)

   All schedules run in `TIMEZONE` (default `Asia/Kolkata`).

> **Why an always-on host is required:** the cron jobs only fire while the
> process is running. Serverless / scale-to-zero / "function" platforms will
> kill the process between requests and your 7 AM MCQ blast, weekly
> leaderboard, and re-engagement nudges will simply never run. Use a host that
> keeps a long-lived process alive (Railway, Render Web Service, or a VPS with
> PM2 / Docker `restart: unless-stopped`).

The app is run with `tsx` directly (`npm start` -> `tsx src/index.ts`); there is
**no build/compile step** (tsconfig is `noEmit`). `devDependencies` (tsx,
prisma, typescript types) are therefore needed at runtime.

---

## 0. Prerequisites

- Node.js 22 (package.json requires `>=20`).
- A real WhatsApp Cloud API setup (Meta app, phone number id, access token,
  app secret, verify token).
- A Gemini API key.
- A **stable public HTTPS URL** (see section 2). This replaces any ephemeral
  cloudflare/ngrok quick-tunnel you used locally.

Copy `.env.production.example` to `.env` and fill in real values (or set them as
platform secrets / variables).

### package.json scripts you'll use

| Script            | Command               | Purpose                              |
| ----------------- | --------------------- | ------------------------------------ |
| `npm start`       | `tsx src/index.ts`    | Run the bot (server + cron)          |
| `npm run db:push` | `prisma db push`      | Create/update DB schema (no migration files) |
| `npm run db:seed` | `tsx prisma/seed.ts`  | Seed courses/MCQs/mentors etc.       |
| `npm run db:generate` | `prisma generate` | Regenerate Prisma client             |
| `npm run typecheck`   | `tsc --noEmit`    | Optional: validate types before deploy |

---

## 1. Deployment options

### Option A — Railway

1. Push this repo to GitHub.
2. In Railway: **New Project -> Deploy from GitHub repo** and pick the repo.
3. **Add a Postgres plugin** (New -> Database -> PostgreSQL). Railway exposes a
   `DATABASE_URL` variable you can reference.
4. In the service **Variables** tab, set every var from
   `.env.production.example`:
   - Reference the Postgres URL: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - Set `NODE_ENV=production`, all `WA_*`, `GEMINI_*`, `TPL_*`, cron, and
     (optionally) Razorpay/Calendar vars.
   - Leave `PUBLIC_BASE_URL` empty for now; fill it after step 6.
5. **Start command:** Railway auto-detects `npm start`. Confirm it is
   `npm start` (Settings -> Deploy). A build step is not strictly required, but
   if Railway runs `npm ci`, Prisma's client is generated via the same flow you
   run below in step 7.
6. **Generate a domain:** Settings -> Networking -> **Generate Domain**. You get
   something like `https://pratham-bot.up.railway.app`. Set
   `PUBLIC_BASE_URL` to this value (or your custom domain) and redeploy.
7. **Run schema + seed once** (Railway shell, or one-off command):
   ```
   npm run db:push
   npm run db:seed
   ```
   (Switch the Prisma provider to `postgresql` first — see section 3.)

### Option B — Render

1. Push to GitHub.
2. **New -> Web Service** (NOT a Background Worker or Cron Job — you need the
   HTTP server AND a long-lived process for cron).
3. Settings:
   - **Environment:** Node
   - **Build Command:** `npm ci && npx prisma generate`
   - **Start Command:** `npm start`
4. **Add a Render PostgreSQL** instance and copy its **Internal Database URL**
   into the service's `DATABASE_URL` env var.
5. Add all other env vars from `.env.production.example`.
6. Render gives you a stable URL like `https://pratham-bot.onrender.com`. Set
   `PUBLIC_BASE_URL` to it (or attach a custom domain under Settings -> Custom
   Domains).
7. Run schema + seed once via the Render **Shell** tab:
   ```
   npm run db:push
   npm run db:seed
   ```

> Note: Render free-tier web services spin down after inactivity, which will
> stop your cron jobs. Use a paid (always-on) instance for reliable scheduled
> sends.

### Option C — Generic VPS with PM2

On a Linux VPS (Ubuntu/Debian) with Node 22 installed:

```bash
git clone <your-repo> /opt/pratham-bot
cd /opt/pratham-bot
npm ci
cp .env.production.example .env   # then edit .env with real values
npx prisma generate

# Set up the database (see section 3 for Postgres provider change)
npm run db:push
npm run db:seed

# Install PM2 and run the bot as a managed, always-on process
npm i -g pm2
pm2 start "npm start" --name pratham-bot
pm2 save
pm2 startup    # follow the printed command so it survives reboots
```

Useful PM2 commands:

```bash
pm2 logs pratham-bot      # tail logs
pm2 restart pratham-bot   # restart after a deploy (git pull && npm ci)
pm2 status                # process health
```

#### Public HTTPS on a VPS

The app serves plain HTTP on `PORT`. Put a reverse proxy in front for HTTPS:

- Install **nginx** (or Caddy) and point a domain (e.g. `api.yourdomain.com`)
  at the VPS.
- Proxy `https://api.yourdomain.com` -> `http://127.0.0.1:3000`.
- Get a free TLS cert via **certbot** (`certbot --nginx`) or use Caddy's
  automatic HTTPS.
- Set `PUBLIC_BASE_URL=https://api.yourdomain.com` in `.env` and restart.

### Option D — Docker / docker-compose (any host)

A `Dockerfile` and `docker-compose.yml` are included.

```bash
cp .env.production.example .env   # fill in values
docker compose up -d --build
```

- SQLite (default): the `./prisma` volume persists `dev.db` on the host.
- Postgres: uncomment the `postgres` service and `depends_on` block in
  `docker-compose.yml`, set `DATABASE_URL=postgresql://wabot:wabot@postgres:5432/wabot`,
  switch the Prisma provider (section 3), then:
  ```bash
  docker compose run --rm app npm run db:push
  docker compose run --rm app npm run db:seed
  docker compose up -d --build
  ```

The container `restart: unless-stopped` policy keeps the always-on process
(and its cron jobs) alive across crashes and host reboots.

---

## 2. Getting a stable public HTTPS URL & updating the Meta webhook

During local development you likely used a cloudflare quick-tunnel or ngrok URL
that **changes every restart**. In production you need a **stable** URL:

- **Railway:** Settings -> Networking -> Generate Domain
  (`*.up.railway.app`), or add a custom domain.
- **Render:** the service URL (`*.onrender.com`), or a custom domain.
- **VPS:** your own domain pointed at the box, fronted by nginx/Caddy + TLS.

Once you have the stable URL, set `PUBLIC_BASE_URL` to it and redeploy. Then
**update the Meta webhook**:

1. Meta App Dashboard -> **WhatsApp -> Configuration** (Webhooks).
2. **Callback URL:** `https://<your-stable-domain>/webhook`
3. **Verify token:** the exact value of `WA_VERIFY_TOKEN` from your env.
4. Click **Verify and save** — Meta sends a `GET /webhook` challenge that the
   server answers using `WA_VERIFY_TOKEN`.
5. Subscribe the app to the **messages** field (and any others you use).
6. If you use Razorpay webhooks, set that callback to
   `https://<your-stable-domain>/...` and configure `RAZORPAY_WEBHOOK_SECRET`
   to match the Razorpay dashboard.

You can sanity-check the deployment with `GET https://<your-stable-domain>/health`.

---

## 3. Switching from SQLite to Postgres

No application code changes are needed — only the datasource and env.

1. Edit `prisma/schema.prisma` and change the provider:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
   (The schema already uses `String` columns instead of enums, which is
   compatible with both engines — see the note at the top of `schema.prisma`.)

2. Set a Postgres `DATABASE_URL`, e.g.:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/db
   ```

3. Regenerate the client and create the schema in the new database:
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. Seed reference data (courses, MCQs, mentors, etc.):
   ```bash
   npm run db:seed
   ```

That's it — the bot uses `env("DATABASE_URL")` and Prisma's generated client, so
no `src/` changes are required.

---

## 4. Running migrations / seed in production

This project uses **`prisma db push`** (schema sync), not versioned migration
files — there is no `prisma/migrations/` directory and no `migrate deploy`
script in package.json.

- **Apply schema:** run `npm run db:push` once per environment (and again after
  any `schema.prisma` change). It is safe to re-run; it converges the DB to the
  schema.
- **Seed data:** run `npm run db:seed` (defined as `tsx prisma/seed.ts`, also
  wired as Prisma's seed script).
- **Where to run them:**
  - Railway/Render: the platform Shell, or a one-off job/command.
  - VPS: directly on the box before/after `pm2 restart`.
  - Docker: `docker compose run --rm app npm run db:push` and
    `... npm run db:seed`.

> Run `db:push`/`db:seed` as explicit one-off steps rather than on every boot,
> so a restart of the always-on process doesn't re-seed or interfere with live
> data.

---

## Quick checklist

- [ ] Host is always-on (not serverless / scale-to-zero) so cron jobs run.
- [ ] All env vars from `.env.production.example` set (real WA + Gemini creds).
- [ ] `prisma/schema.prisma` provider set to `postgresql` (if using Postgres).
- [ ] `DATABASE_URL` points at the production database.
- [ ] `npm run db:push` then `npm run db:seed` run once.
- [ ] Stable `PUBLIC_BASE_URL` set (platform or custom domain, HTTPS).
- [ ] Meta webhook Callback URL = `https://<domain>/webhook`, verify token matches.
- [ ] `GET /health` returns OK on the public URL.
