-- Desired schema. Safe to re-run: every statement is IF NOT EXISTS, so this
-- file creates a database and never destroys one. Destructive changes live in
-- migrations/ and are run deliberately, once.

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  -- Canonical school id from src/schools.ts — never the raw text a form
  -- produced. The sheet's own School column is free text and arrives in half a
  -- dozen spellings; resolving to an id on the way in is what lets a delay be
  -- matched to a subscription at all.
  school TEXT NOT NULL,
  bus_route TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirmation_token TEXT,
  confirmation_token_expires_at TEXT,
  unsubscribe_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One subscription per person per bus PER SCHOOL. School is part of the key
-- because route numbers repeat across schools: bus 110 serves both Alice Smith
-- and Eisenhower, and they are different buses on different runs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email_school_route
  ON subscribers(email, school, bus_route);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_confirmation_token
  ON subscribers(confirmation_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token
  ON subscribers(unsubscribe_token);

CREATE TABLE IF NOT EXISTS daily_notifications (
  id TEXT PRIMARY KEY,
  school TEXT NOT NULL,
  bus_route TEXT NOT NULL,
  notified_date TEXT NOT NULL,
  minutes_late INTEGER,
  -- What the sheet actually said, kept for the admin view and for spotting a
  -- school that resolves to nothing.
  school_raw TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The dedup key, and the reason school had to reach this table too. Keyed on
-- (bus_route, notified_date) alone, bus 110 running late at Alice Smith would
-- record a row that suppressed the alert for bus 110 at Eisenhower for the rest
-- of the day — a silent non-delivery, indistinguishable from no delay.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_notifications_school_route_date
  ON daily_notifications(school, bus_route, notified_date);
