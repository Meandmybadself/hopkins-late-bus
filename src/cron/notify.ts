import { Env, DelayRow, Subscriber } from "../types";
import { sendDelayNotificationEmail } from "../email";

export async function notifySubscribers(
  env: Env,
  delays: DelayRow[],
  today: string,
  sheetUrl: string
): Promise<void> {
  for (const delay of delays) {
    // Check if we already notified for this route today
    const existing = await env.DB.prepare(
      "SELECT id FROM daily_notifications WHERE bus_route = ? AND notified_date = ?"
    )
      .bind(delay.busRoute, today)
      .first();

    if (existing) continue;

    // Find confirmed subscribers for this route
    const { results: subscribers } = await env.DB.prepare(
      "SELECT id, email, unsubscribe_token FROM subscribers WHERE bus_route = ? AND confirmed = 1"
    )
      .bind(delay.busRoute)
      .all<Pick<Subscriber, "id" | "email" | "unsubscribe_token">>();

    // Send emails concurrently, tolerating individual failures
    const results = await Promise.allSettled(
      subscribers.map((sub) =>
        sendDelayNotificationEmail(
          env,
          sub.email,
          delay.busRoute,
          delay.minutesLate,
          delay.school,
          sub.unsubscribe_token,
          sheetUrl
        )
      )
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(
        `Failed to send ${failures.length}/${subscribers.length} emails for route ${delay.busRoute}`
      );
    }

    // Always record the notification to prevent duplicate sends on retry
    await env.DB.prepare(
      "INSERT INTO daily_notifications (id, bus_route, notified_date, minutes_late, school) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(
        crypto.randomUUID(),
        delay.busRoute,
        today,
        delay.minutesLate,
        delay.school
      )
      .run();
  }
}
