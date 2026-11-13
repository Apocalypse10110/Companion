/**
 * Shared request checks for the AI routes: only this app's own pages, a per-caller rate limit,
 * and a body size cap. Server-only. Error answers never include keys or request details.
 */

export const json = (status: number, data: unknown) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Only Companion's own pages may use the AI key. Requests with no Origin (same-origin GETs, tests) pass. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function callerOf(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** A simple in-memory limit per caller per minute (per server instance; fine for a demo). */
export function rateLimiter(perMinute: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5_000) hits.clear();
    return recent.length > perMinute;
  };
}

/** Read and parse a JSON body no larger than `max` characters. Null if it isn't usable. */
export async function readJson(request: Request, max: number): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  const raw = await request.text().catch(() => "");
  if (raw.length > max) return { ok: false, status: 413 };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400 };
  }
}
