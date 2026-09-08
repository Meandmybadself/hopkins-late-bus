import { Env } from "../types";
import { sendConfirmationEmail } from "../email";
import { normalizeBusRoute } from "../utils";
import { isKnownSchool, schoolLabel } from "../schools";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handleSubscribe(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json<{ email?: string; busRoute?: string; school?: string }>();
  const email = body.email?.trim().toLowerCase();
  const rawRoute = body.busRoute?.trim();
  const school = body.school?.trim();

  if (!email || !isValidEmail(email)) {
    return Response.json(
      { error: "Please provide a valid email address." },
      { status: 400 }
    );
  }

  if (!rawRoute) {
    return Response.json(
      { error: "Please provide a bus route number." },
      { status: 400 }
    );
  }

  // Rejected rather than stored as typed. An unknown school id can never match a
  // delay — resolveSchools only ever produces ids from this list — so accepting
  // one would create a subscription that is silently guaranteed to notify
  // nobody, which is worse than a visible error at sign-up.
  if (!school || !isKnownSchool(school)) {
    return Response.json(
      { error: "Please choose your school from the list." },
      { status: 400 }
    );
  }

  const busRoute = normalizeBusRoute(rawRoute);

  // Check for existing confirmed subscription
  const existing = await env.DB.prepare(
    "SELECT id, confirmed FROM subscribers WHERE email = ? AND school = ? AND bus_route = ?"
  )
    .bind(email, school, busRoute)
    .first<{ id: string; confirmed: number }>();

  if (existing?.confirmed) {
    return Response.json(
      { error: "You are already subscribed to this route." },
      { status: 409 }
    );
  }

  // Delete any existing unconfirmed record (re-subscription flow)
  if (existing) {
    await env.DB.prepare("DELETE FROM subscribers WHERE id = ?")
      .bind(existing.id)
      .run();
  }

  const id = crypto.randomUUID();
  const confirmationToken = crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO subscribers (id, email, school, bus_route, confirmed, confirmation_token, confirmation_token_expires_at, unsubscribe_token)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
    )
      .bind(id, email, school, busRoute, confirmationToken, expiresAt, unsubscribeToken)
      .run();
  } catch {
    // Race condition: another request inserted the same email+route
    return Response.json(
      { error: "A subscription for this route is already pending. Check your email." },
      { status: 409 }
    );
  }

  await sendConfirmationEmail(env, email, busRoute, schoolLabel(school), confirmationToken);

  return Response.json({
    message: "Check your email to confirm your subscription.",
  });
}
