export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  OPERATOR_EMAIL: string;
  SITE_URL: string;
  SHEET_URL: string;
  TIMEZONE: string;
}

export interface Subscriber {
  id: string;
  email: string;
  bus_route: string;
  confirmed: number;
  confirmation_token: string | null;
  confirmation_token_expires_at: string | null;
  unsubscribe_token: string;
  created_at: string;
}

export interface DelayRow {
  busRoute: string;
  school: string;
  minutesLate: number;
}
