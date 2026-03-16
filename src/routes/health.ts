import { Env } from "../types";

export async function handleHealth(
  _request: Request,
  env: Env
): Promise<Response> {
  const result: {
    status: string;
    subscribers?: number;
    routes?: number;
    email?: string;
    error?: string;
  } = { status: "ok" };

  try {
    // Verify D1 is reachable
    const stats = await env.DB.prepare(
      "SELECT COUNT(*) as total, COUNT(DISTINCT bus_route) as routes FROM subscribers WHERE confirmed = 1"
    ).first<{ total: number; routes: number }>();

    result.subscribers = stats?.total ?? 0;
    result.routes = stats?.routes ?? 0;

    // Send a test email to verify Resend pipeline
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: env.FROM_EMAIL,
        subject: "Bus Alerts Health Check",
        html: `<p>Health check passed. D1 reachable: ${result.subscribers} subscriber(s) across ${result.routes} route(s).</p>`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }

    result.email = "sent";
  } catch (err) {
    result.status = "error";
    result.error = err instanceof Error ? err.message : String(err);
    return Response.json(result, { status: 500 });
  }

  return Response.json(result);
}
