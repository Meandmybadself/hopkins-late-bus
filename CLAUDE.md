# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev              # Start local dev server (wrangler dev)
pnpm run deploy           # Deploy to Cloudflare
pnpm run typecheck        # TypeScript type checking
pnpm run db:migrate       # Apply schema.sql to production D1 (idempotent)
pnpm run db:migrate:local # Same, locally
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
- `options.ts` — `GET /api/options`, the school list + bus-number suggestions the
  subscribe form populates itself from
- `admin.ts` — `GET /api/admin/subscribers`, gated by `ADMIN_SECRET`

### Cron flow

Two cron triggers defined in `wrangler.toml`:
- **Every 2 minutes, 11 AM–3 PM UTC weekdays** — notification job (maps to 6:30–8:00 AM Central)
- **Mondays 12 PM UTC** — weekly operator digest

`src/cron/handler.ts` orchestrates: checks the time window, calls `sheet.ts` to fetch + parse the Google Sheet, then `notify.ts` to match delays to confirmed subscribers and dispatch emails. Deduplication is handled via the `daily_notifications` D1 table (one notification per route per day).

`src/cron/sheet.ts` uses Cloudflare's streaming `HTMLRewriter` API to parse the published Google Sheet HTML table.

### Schools

`src/schools.ts` is the single definition of which schools exist. It matters more
than it looks: the Google Form behind the sheet has an "Other" free-text escape,
so the School column arrives in many spellings for the same place ("hhs", "HHs",
"HHS/", "Hopkins High", "Hopkins High School" are all Hopkins High). Subscribers
choose from a fixed list, so every sheet value is resolved to canonical ids by
`resolveSchools()` and matching happens on ids alone — comparing raw text would
deliver nothing while looking healthy.

One value can resolve to SEVERAL schools: "HHS/NMS/WMS" is one bus serving three
buildings, and each is deduped separately. A value that resolves to NONE is
logged and skipped, never broadcast to the route — that log line is the only
place a missing school will surface, so adding one means editing `SCHOOLS` and
`ALIASES` together.

### Database schema

Two tables in `schema.sql`, both keyed on school:
- `subscribers` — email, **school**, bus_route, confirmed, confirmation/unsubscribe tokens
- `daily_notifications` — **school** + route + date deduplication, plus `school_raw`
  (what the sheet literally said)

School is part of both unique keys because route numbers repeat across schools.
Without it, bus 110 running late at Alice Smith suppressed the alert for bus 110
at Eisenhower for the rest of the day.

`schema.sql` is idempotent (`IF NOT EXISTS` throughout) and safe to re-run.
Destructive changes live in `migrations/` and are run by hand, once.

### Admin

`/admin` lists subscribers and recent detected delays. It authenticates with a
shared secret sent as `Authorization: Bearer <ADMIN_SECRET>` and held in
localStorage. An **unset** `ADMIN_SECRET` refuses every request rather than
allowing them.

### Local development

Requires a `.dev.vars` file (git-ignored) with:
```
RESEND_API_KEY=re_...
CRON_SECRET=...
ADMIN_SECRET=...
DIGEST_EMAIL=...
```

Note that Resend rejects `@example.com` recipients; use `delivered@resend.dev`
to exercise the subscribe flow locally without emailing anyone.

The `SHEET_URL` and `TIMEZONE` env vars are set in `wrangler.toml` directly.
