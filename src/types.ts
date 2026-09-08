export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  OPERATOR_EMAIL: string;
  SITE_URL: string;
  SHEET_URL: string;
  TIMEZONE: string;
  CRON_SECRET: string;
  /** Gate on /api/admin/*. Absent means the admin API refuses every request
   *  rather than allowing them — see routes/admin.ts. */
  ADMIN_SECRET: string;
}

export interface Subscriber {
  id: string;
  email: string;
  /** Canonical school id (src/schools.ts), never raw form text. */
  school: string;
  bus_route: string;
  confirmed: number;
  confirmation_token: string | null;
  confirmation_token_expires_at: string | null;
  unsubscribe_token: string;
  created_at: string;
}

export interface DelayRow {
  busRoute: string;
  /** Exactly what the sheet said — for display and for logging a value that
   *  resolved to nothing. */
  school: string;
  /** Canonical school ids the raw value refers to. Usually one; "HHS/NMS/WMS"
   *  is three, and junk is none. Matching uses this, never `school`. */
  schools: string[];
  minutesLate: number;
}
