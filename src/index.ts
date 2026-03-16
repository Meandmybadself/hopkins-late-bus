import { Env } from "./types";
import { handleSubscribe } from "./routes/subscribe";
import { handleConfirm } from "./routes/confirm";
import {
  handleUnsubscribeByEmail,
  handleUnsubscribeByToken,
} from "./routes/unsubscribe";
import { handleScheduled } from "./cron/handler";
import { handleHealth } from "./routes/health";

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.SITE_URL,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function withCors(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(env))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // Non-API routes — serve static assets
    if (!pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    let response: Response;

    try {
      switch (true) {
        case pathname === "/api/subscribe" && request.method === "POST":
          response = await handleSubscribe(request, env);
          break;

        case pathname === "/api/confirm" && request.method === "GET":
          response = await handleConfirm(request, env);
          break;

        case pathname === "/api/unsubscribe" && request.method === "POST":
          response = await handleUnsubscribeByEmail(request, env);
          break;

        case pathname === "/api/unsubscribe" && request.method === "GET":
          response = await handleUnsubscribeByToken(request, env);
          break;

        case pathname === "/api/health" && request.method === "GET":
          response = await handleHealth(request, env);
          break;

        default:
          response = Response.json(
            { error: "Not found" },
            { status: 404 }
          );
      }
    } catch (err) {
      console.error("Unhandled error:", err);
      response = Response.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return withCors(response, env);
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
} satisfies ExportedHandler<Env>;
