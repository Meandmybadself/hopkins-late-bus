import { Env, Subscriber } from "../types";
import { schoolLabel } from "../schools";

/** Constant-time-ish comparison. Not a hard guarantee in a JS runtime, but it
 *  removes the trivial early-exit that makes a secret guessable byte by byte. */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Every /api/admin/* request passes through here first.
 *
 *  An UNSET ADMIN_SECRET refuses everything rather than allowing it. The
 *  opposite default — no secret configured, no check performed — is how a
 *  subscriber list ends up on the open internet after a deploy to a new
 *  environment where the secret was forgotten. */
function authorize(request: Request, env: Env): Response | null {
  if (!env.ADMIN_SECRET) {
    console.error("ADMIN_SECRET is not set; refusing admin request.");
    return Response.json({ error: "Admin API is not configured." }, { status: 503 });
  }

  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || !secretMatches(token, env.ADMIN_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/** GET /api/admin/subscribers — the whole list, plus a small summary.
 *
 *  This is the one place in the app that serves subscriber email addresses, so
 *  it is deliberately the only thing behind the gate that does. It is also
 *  no-store: a subscriber list has no business in a shared cache, and the
 *  browser's back button should not be able to render one after sign-out.
 */
export async function handleAdminSubscribers(request: Request, env: Env): Promise<Response> {
  const denied = authorize(request, env);
  if (denied) return denied;

  const { results } = await env.DB.prepare(
    `SELECT id, email, school, bus_route, confirmed, created_at
       FROM subscribers
      ORDER BY confirmed DESC, school, CAST(bus_route AS INTEGER), email`
  ).all<Pick<Subscriber, "id" | "email" | "school" | "bus_route" | "confirmed" | "created_at">>();

  const subscribers = results.map((row) => ({
    ...row,
    schoolLabel: schoolLabel(row.school),
  }));

  // Recent delivery activity, so the screen can answer "is this thing running?"
  // as well as "who is signed up" — the two questions an operator actually has.
  const { results: recent } = await env.DB.prepare(
    `SELECT notified_date, school, bus_route, minutes_late, school_raw
       FROM daily_notifications
      ORDER BY notified_date DESC, created_at DESC
      LIMIT 25`
  ).all<{
    notified_date: string;
    school: string;
    bus_route: string;
    minutes_late: number | null;
    school_raw: string | null;
  }>();

  return Response.json(
    {
      summary: {
        total: subscribers.length,
        confirmed: subscribers.filter((s) => s.confirmed === 1).length,
        pending: subscribers.filter((s) => s.confirmed !== 1).length,
      },
      subscribers,
      recentNotifications: recent.map((r) => ({ ...r, schoolLabel: schoolLabel(r.school) })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
