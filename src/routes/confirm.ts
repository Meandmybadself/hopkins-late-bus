import { Env } from "../types";

export async function handleConfirm(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json(
      { error: "Missing confirmation token." },
      { status: 400 }
    );
  }

  const subscriber = await env.DB.prepare(
    "SELECT id, bus_route, confirmation_token_expires_at FROM subscribers WHERE confirmation_token = ?"
  )
    .bind(token)
    .first<{
      id: string;
      bus_route: string;
      confirmation_token_expires_at: string;
    }>();

  if (!subscriber) {
    return Response.json(
      { error: "Invalid or expired confirmation link." },
      { status: 404 }
    );
  }

  if (new Date(subscriber.confirmation_token_expires_at) < new Date()) {
    return Response.json(
      { error: "This confirmation link has expired. Please subscribe again." },
      { status: 404 }
    );
  }

  await env.DB.prepare(
    "UPDATE subscribers SET confirmed = 1, confirmation_token = NULL, confirmation_token_expires_at = NULL WHERE id = ?"
  )
    .bind(subscriber.id)
    .run();

  return Response.json({
    message: `Your subscription is confirmed. We'll email you if bus ${subscriber.bus_route} is running late.`,
    busRoute: subscriber.bus_route,
  });
}
