CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  bus_route TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirmation_token TEXT,
  confirmation_token_expires_at TEXT,
  unsubscribe_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_subscribers_email_route
  ON subscribers(email, bus_route);

CREATE UNIQUE INDEX idx_subscribers_confirmation_token
  ON subscribers(confirmation_token);

CREATE UNIQUE INDEX idx_subscribers_unsubscribe_token
  ON subscribers(unsubscribe_token);

CREATE TABLE daily_notifications (
  id TEXT PRIMARY KEY,
  bus_route TEXT NOT NULL,
  notified_date TEXT NOT NULL,
  minutes_late INTEGER,
  school TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_daily_notifications_route_date
  ON daily_notifications(bus_route, notified_date);
