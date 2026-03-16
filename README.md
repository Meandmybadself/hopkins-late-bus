# Late Bus Alert

Email notifications for parents when school buses are running late. Polls a publicly maintained Google Sheet for delay entries and sends targeted emails to subscribers.

**Stack:** Cloudflare Workers, D1 (SQLite), Resend, static HTML frontend

## How It Works

1. Parents subscribe with their email and bus route number
2. A confirmation email verifies the address (double opt-in)
3. A cron job polls a Google Sheet every 2 minutes on weekday mornings (6:30–8:00am local)
4. When a bus delay appears, all confirmed subscribers for that route get an email
5. Each route is only notified once per day (deduplication)

## Project Structure

```
src/
├── index.ts              # Worker entry — routing + CORS
├── types.ts              # TypeScript interfaces
├── utils.ts              # Shared utilities (route normalization)
├── email.ts              # Resend API wrapper + email templates
├── routes/
│   ├── subscribe.ts      # POST /api/subscribe
│   ├── confirm.ts        # GET /api/confirm?token=
│   ├── unsubscribe.ts    # POST + GET /api/unsubscribe
│   └── health.ts         # GET /api/health
└── cron/
    ├── handler.ts         # Scheduled entry — time gate + orchestration
    ├── sheet.ts           # Google Sheets HTML parser
    ├── notify.ts          # Subscriber matching + email dispatch
    └── digest.ts          # Weekly operator digest
frontend/
├── index.html            # Subscribe form
├── confirm.html          # Email confirmation landing
├── unsubscribe.html      # Unsubscribe by email
├── unsubscribed.html     # One-click opt-out landing
└── style.css
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- A [Cloudflare](https://cloudflare.com/) account
- A [Resend](https://resend.com/) account with a verified sending domain

### 1. Install dependencies

```bash
pnpm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 3. Create the D1 database

```bash
pnpm run db:create
```

Copy the printed `database_id` into `wrangler.toml`.

### 4. Run the migration

```bash
pnpm run db:migrate
```

### 5. Set secrets

```bash
pnpm run secret:setup
```

You'll be prompted for:

| Secret | Description |
|--------|-------------|
| `RESEND_API_KEY` | Your Resend API key |
| `FROM_EMAIL` | Verified sender address (e.g. `alerts@yourdomain.com`) |
| `OPERATOR_EMAIL` | Your inbox for health checks and weekly digests |
| `SITE_URL` | Frontend URL (e.g. `https://latebus.meandmybadself.com`) |

### 6. Deploy

```bash
pnpm run deploy
```

### 7. Deploy the frontend

Push the `frontend/` directory to a hosting provider (Cloudflare Pages, GitHub Pages, etc.). If using Cloudflare Pages on the same domain, the frontend's relative `/api/...` paths will route to the Worker automatically.

## Local Development

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your real values

pnpm run db:migrate:local
pnpm run dev
```

The Worker runs at `http://localhost:8787`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/subscribe` | Subscribe an email + route |
| `GET` | `/api/confirm?token=` | Confirm a subscription |
| `POST` | `/api/unsubscribe` | Unsubscribe by email (all routes) |
| `GET` | `/api/unsubscribe?token=` | Unsubscribe a single route |
| `GET` | `/api/health` | Health check — verifies D1 + sends test email |

## Monitoring

- **Weekly digest**: Sent Monday ~6am local time to `OPERATOR_EMAIL` with subscriber count and notification stats
- **Health check**: `GET /api/health` — returns JSON status, can be wired into uptime monitors
- **Logs**: Visible in the Cloudflare Workers dashboard

## Configuration

Environment variables in `wrangler.toml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMEZONE` | `America/Chicago` | IANA timezone for the notification window |
| `SHEET_URL` | — | Google Sheets published HTML URL |
