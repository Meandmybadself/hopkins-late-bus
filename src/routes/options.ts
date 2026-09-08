import { Env } from "../types";
import { SCHOOLS } from "../schools";
import { fetchKnownBusRoutes } from "../cron/sheet";

/** GET /api/options — what the subscribe form's two inputs offer.
 *
 *  Served from here rather than hardcoded in index.html so the school list has
 *  ONE definition: the same SCHOOLS array the subscribe route validates against
 *  and the matcher resolves to. A copy in the HTML would drift, and the failure
 *  it produced would be a subscription that silently matches nothing.
 *
 *  Bus numbers are scraped from the sheet, which costs a fetch, so the response
 *  is cached for an hour. A sheet that is slow or down degrades to schools-only
 *  rather than failing the page: the bus field takes free text anyway, so
 *  missing suggestions cost a little convenience and nothing else.
 */
export async function handleOptions(request: Request, env: Env): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/options", request.url).toString(), {
    method: "GET",
  });

  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let busRoutes: string[] = [];
  try {
    busRoutes = await fetchKnownBusRoutes(env.SHEET_URL);
  } catch (err) {
    console.error("Failed to read bus numbers from sheet:", err);
  }

  const response = Response.json(
    { schools: SCHOOLS, busRoutes },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );

  await cache.put(cacheKey, response.clone());
  return response;
}
