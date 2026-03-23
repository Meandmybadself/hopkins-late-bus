# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev              # Start local dev server (wrangler dev)
pnpm run deploy           # Deploy to Cloudflare
pnpm run typecheck        # TypeScript type checking
pnpm run db:migrate       # Run schema migrations on production D1
pnpm run db:migrate:local # Run schema migrations locally
pnpm run secret:setup     # Interactively set Cloudflare secrets
```

No test or lint commands are configured.

## Architecture

**Late Bus Alert** is a Cloudflare Workers app that emails parents when school buses run late. It has no build step — Wrangler handles bundling directly from `src/index.ts`.

### Stack
- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite), bound as `DB`
- **Email**: Resend API
- **Data source**: Google Sheets published as HTML, fetched and parsed at runtime
- **Frontend**: Static HTML/CSS in `frontend/`, served by the Worker via the `assets` binding

### Request flow

`src/index.ts` is the single entry point. It handles routing for `/api/*` paths and falls through to static asset serving for everything else.

Routes live in `src/routes/`:
- `subscribe.ts` — validates email + route, creates unconfirmed subscriber, sends confirmation email
- `confirm.ts` — verifies token, marks subscriber confirmed
- `unsubscribe.ts` — handles both one-click token-based and form-based unsubscription
- `health.ts` — uptime check endpoint

### Cron flow

Two cron triggers defined in `wrangler.toml`:
- **Every 2 minutes, 11 AM–3 PM UTC weekdays** — notification job (maps to 6:30–8:00 AM Central)
- **Mondays 12 PM UTC** — weekly operator digest

`src/cron/handler.ts` orchestrates: checks the time window, calls `sheet.ts` to fetch + parse the Google Sheet, then `notify.ts` to match delays to confirmed subscribers and dispatch emails. Deduplication is handled via the `daily_notifications` D1 table (one notification per route per day).

`src/cron/sheet.ts` uses Cloudflare's streaming `HTMLRewriter` API to parse the published Google Sheet HTML table.

### Database schema

Two tables in `schema.sql`:
- `subscribers` — email, bus_route, confirmed, confirmation/unsubscribe tokens
- `daily_notifications` — route + date deduplication for sent alerts

### Local development

Requires a `.dev.vars` file (git-ignored) with:
```
RESEND_API_KEY=re_...
CRON_SECRET=...
DIGEST_EMAIL=...
```

The `SHEET_URL` and `TIMEZONE` env vars are set in `wrangler.toml` directly.
