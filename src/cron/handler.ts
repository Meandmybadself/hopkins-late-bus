import { Env } from "../types";
import { fetchDelayRows } from "./sheet";
import { notifySubscribers } from "./notify";
import { handleWeeklyDigest } from "./digest";

function isWithinWindow(tz: string): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = parseInt(
    parts.find((p) => p.type === "hour")!.value,
    10
  );
  const minute = parseInt(
    parts.find((p) => p.type === "minute")!.value,
    10
  );
  const totalMinutes = hour * 60 + minute;

  const WINDOW_START = 6 * 60 + 30; // 6:30am
  const WINDOW_END = 8 * 60; // 8:00am

  return totalMinutes >= WINDOW_START && totalMinutes < WINDOW_END;
}

function getTodayLocal(tz: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;

  return `${year}-${month}-${day}`;
}

export async function handleScheduled(env: Env): Promise<void> {
  const tz = env.TIMEZONE || "America/Chicago";

  // Weekly digest runs on its own schedule (Monday 6am local)
  await handleWeeklyDigest(env);

  if (!isWithinWindow(tz)) {
    return;
  }

  // Clean up expired unconfirmed subscribers
  await env.DB.prepare(
    "DELETE FROM subscribers WHERE confirmed = 0 AND confirmation_token_expires_at < datetime('now')"
  ).run();

  // Fetch and parse delay data
  const delays = await fetchDelayRows(env.SHEET_URL);
  console.log(`Found ${delays.length} delay entries in sheet.`);

  if (delays.length === 0) return;

  const today = getTodayLocal(tz);
  await notifySubscribers(env, delays, today);

  console.log("Notification dispatch complete.");
}
