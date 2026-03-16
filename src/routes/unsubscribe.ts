import { Env } from "../types";

export async function handleUnsubscribeByEmail(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json<{ email?: string }>();
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return Response.json(
      { error: "Please provide an email address." },
      { status: 400 }
    );
  }

  await env.DB.prepare("DELETE FROM subscribers WHERE email = ?")
    .bind(email)
    .run();

  return Response.json({
    message: "You have been unsubscribed from all bus notifications.",
  });
}

export async function handleUnsubscribeByToken(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json(
      { error: "Missing unsubscribe token." },
      { status: 400 }
    );
  }

  await env.DB.prepare(
    "DELETE FROM subscribers WHERE unsubscribe_token = ?"
  )
    .bind(token)
    .run();

  return Response.json({
    message: "You've been successfully unsubscribed.",
  });
}
