import { Env } from "../types";
import { fetchDelayRows } from "./sheet";
import { notifySubscribers } from "./notify";
import { handleWeeklyDigest } from "./digest";

function getLocalDateParts(tz: string): { today: string; isWeekend: boolean; totalMinutes: number } {
  const now = new Date();

  // Use en-CA for date parts — YYYY-MM-DD format is unambiguous and reliable across V8/ICU versions
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const getDate = (type: string) => dateParts.find((p) => p.type === type)!.value;
  const today = `${getDate("year")}-${getDate("month")}-${getDate("day")}`;

  // Use en-US for time and weekday parts
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);

  const getTime = (type: string) => timeParts.find((p) => p.type === type)!.value;
  const hour = parseInt(getTime("hour"), 10);
  const minute = parseInt(getTime("minute"), 10);
  const weekday = getTime("weekday"); // "Sun", "Mon", ..., "Sat"

  return {
    today,
    isWeekend: weekday === "Sun" || weekday === "Sat",
    totalMinutes: hour * 60 + minute,
  };
}

export async function handleScheduled(env: Env): Promise<void> {
  const tz = env.TIMEZONE || "America/Chicago";
  console.log(`handleScheduled invoked at UTC ${new Date().toISOString()}, tz=${tz}`);

  // Weekly digest runs on its own schedule (Monday 6am local)
  await handleWeeklyDigest(env);

  const { today, isWeekend, totalMinutes } = getLocalDateParts(tz);
  console.log(`Local time: today=${today}, totalMinutes=${totalMinutes}, isWeekend=${isWeekend}`);

  const WINDOW_START = 6 * 60 + 30; // 6:30am
  const WINDOW_END = 8 * 60; // 8:00am
  const withinWindow = totalMinutes >= WINDOW_START && totalMinutes < WINDOW_END;

  if (isWeekend || !withinWindow) {
    console.log(`Skipping: isWeekend=${isWeekend}, withinWindow=${withinWindow} (window ${WINDOW_START}–${WINDOW_END})`);
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
