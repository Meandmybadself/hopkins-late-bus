-- One-off, DESTRUCTIVE. Run once against a database, by hand.
--
-- Two things at once, because they are the same change:
--
--   1. `subscribers` gains `school`, and both unique indexes are re-keyed on it
--      (see schema.sql for why). SQLite cannot add a column to a UNIQUE index
--      in place, so the tables are rebuilt rather than altered.
--
--   2. Both tables are emptied for the 2026-27 school year. This was authorised
--      explicitly. At the time it was run the database held exactly one
--      subscriber — the operator's own test address on route 711, a number that
--      appears nowhere in the sheet — and 358 daily_notifications rows dating to
--      2026-03-16. No real subscription was destroyed, because there had never
--      been one.
--
-- Re-running this is not idempotent in the way schema.sql is: it drops data. If
-- you need the schema without the wipe, run schema.sql against a fresh database.

DROP TABLE IF EXISTS subscribers;
DROP TABLE IF EXISTS daily_notifications;

CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  school TEXT NOT NULL,
  bus_route TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirmation_token TEXT,
  confirmation_token_expires_at TEXT,
  unsubscribe_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_subscribers_email_school_route
  ON subscribers(email, school, bus_route);
CREATE UNIQUE INDEX idx_subscribers_confirmation_token
  ON subscribers(confirmation_token);
CREATE UNIQUE INDEX idx_subscribers_unsubscribe_token
  ON subscribers(unsubscribe_token);

CREATE TABLE daily_notifications (
  id TEXT PRIMARY KEY,
  school TEXT NOT NULL,
  bus_route TEXT NOT NULL,
  notified_date TEXT NOT NULL,
  minutes_late INTEGER,
  school_raw TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_daily_notifications_school_route_date
  ON daily_notifications(school, bus_route, notified_date);
