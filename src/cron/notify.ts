import { Env, DelayRow, Subscriber } from "../types";
import { sendDelayNotificationEmail } from "../email";
import { schoolLabel } from "../schools";

export async function notifySubscribers(
  env: Env,
  delays: DelayRow[],
  today: string,
  sheetUrl: string
): Promise<void> {
  for (const delay of delays) {
    // A raw value that resolves to no known school is reported and skipped. It
    // is never a reason to notify everyone on the route: matching a delay to
    // subscribers at OTHER schools is exactly the bug the school column exists
    // to fix. The log line is the only place a missing school will surface —
    // see SCHOOLS in src/schools.ts.
    if (delay.schools.length === 0) {
      console.warn(
        `Unrecognised school ${JSON.stringify(delay.school)} on bus ${delay.busRoute}; ` +
          `no subscribers notified. Add it to SCHOOLS/ALIASES if it is real.`
      );
      continue;
    }

    // One sheet row can name several schools ("HHS/NMS/WMS" is a bus shared by
    // the high school and both middle schools), and each is deduped separately:
    // the same bus really is late for all three, and a parent at one of them
    // should not have their alert suppressed by a row written for another.
    for (const school of delay.schools) {
      const existing = await env.DB.prepare(
        "SELECT id FROM daily_notifications WHERE school = ? AND bus_route = ? AND notified_date = ?"
      )
        .bind(school, delay.busRoute, today)
        .first();

      if (existing) continue;

      const { results: subscribers } = await env.DB.prepare(
        "SELECT id, email, unsubscribe_token FROM subscribers WHERE school = ? AND bus_route = ? AND confirmed = 1"
      )
        .bind(school, delay.busRoute)
        .all<Pick<Subscriber, "id" | "email" | "unsubscribe_token">>();

      // Send emails concurrently, tolerating individual failures
      const results = await Promise.allSettled(
        subscribers.map((sub) =>
          sendDelayNotificationEmail(
            env,
            sub.email,
            delay.busRoute,
            delay.minutesLate,
            schoolLabel(school),
            sub.unsubscribe_token,
            sheetUrl
          )
        )
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(
          `Failed to send ${failures.length}/${subscribers.length} emails for ${school} bus ${delay.busRoute}`
        );
      }

      // Always record the notification to prevent duplicate sends on retry.
      // `school_raw` keeps what the sheet actually said, so the admin view can
      // show the source text next to the school it was resolved to.
      await env.DB.prepare(
        "INSERT INTO daily_notifications (id, school, bus_route, notified_date, minutes_late, school_raw) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          crypto.randomUUID(),
          school,
          delay.busRoute,
          today,
          delay.minutesLate,
          delay.school
        )
        .run();
    }
  }
}
