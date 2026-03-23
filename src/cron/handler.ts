import { Env } from "../types";
import { fetchDelayRows } from "./sheet";
import { notifySubscribers } from "./notify";
import { handleWeeklyDigest } from "./digest";

function getLocalDateParts(tz: string): { today: string; isWeekend: boolean; totalMinutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)!.value;

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  const weekday = get("weekday"); // "Sun", "Mon", ..., "Sat"

  return {
    today: `${year}-${month}-${day}`,
    isWeekend: weekday === "Sun" || weekday === "Sat",
    totalMinutes: hour * 60 + minute,
  };
}

export async function handleScheduled(env: Env): Promise<void> {
  const tz = env.TIMEZONE || "America/Chicago";

  // Weekly digest runs on its own schedule (Monday 6am local)
  await handleWeeklyDigest(env);

  const { today, isWeekend, totalMinutes } = getLocalDateParts(tz);

  const WINDOW_START = 6 * 60 + 30; // 6:30am
  const WINDOW_END = 8 * 60; // 8:00am
  const withinWindow = totalMinutes >= WINDOW_START && totalMinutes < WINDOW_END;

  if (isWeekend || !withinWindow) {
    return;
  }

  // Clean up expired unconfirmed subscribers
  await env.DB.prepare(
    "DELETE FROM subscribers WHERE confirmed = 0 AND confirmation_token_expires_at < datetime('now')"
  ).run();

  // Fetch and parse delay data — filtered to today only
  const delays = await fetchDelayRows(env.SHEET_URL, today);
  console.log(`Found ${delays.length} delay entries in sheet.`);

  if (delays.length === 0) return;

  await notifySubscribers(env, delays, today, env.SHEET_URL);

  console.log("Notification dispatch complete.");
}
