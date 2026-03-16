import { Env } from "../types";

export async function handleWeeklyDigest(env: Env): Promise<void> {
  const tz = env.TIMEZONE || "America/Chicago";

  // Check if it's ~6am local on a Monday
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);

  if (weekday !== "Mon" || hour !== 6) {
    return;
  }

  // Gather stats
  const subStats = await env.DB.prepare(
    "SELECT COUNT(*) as total, COUNT(DISTINCT bus_route) as routes FROM subscribers WHERE confirmed = 1"
  ).first<{ total: number; routes: number }>();

  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const notifStats = await env.DB.prepare(
    "SELECT COUNT(*) as total FROM daily_notifications WHERE created_at >= ?"
  )
    .bind(sevenDaysAgo)
    .first<{ total: number }>();

  const subscribers = subStats?.total ?? 0;
  const routes = subStats?.routes ?? 0;
  const notifications = notifStats?.total ?? 0;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Late Bus Alert <${env.FROM_EMAIL}>`,
      to: env.OPERATOR_EMAIL,
      subject: "Bus Alerts Weekly Report",
      html: `
<p>Weekly report for Bus Delay Alerts:</p>
<ul>
  <li><strong>${subscribers}</strong> confirmed subscriber(s) across <strong>${routes}</strong> route(s)</li>
  <li><strong>${notifications}</strong> delay notification(s) sent in the last 7 days</li>
</ul>
<p>System is operational.</p>
      `.trim(),
    }),
  });

  console.log(
    `Weekly digest sent: ${subscribers} subscribers, ${routes} routes, ${notifications} notifications`
  );
}
