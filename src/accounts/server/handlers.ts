/**
 * Everything behind /api/accounts/*, kept out of src/app so it can be tested.
 *   GET  /api/accounts                 every account, connected or not (never the tokens)
 *   GET  /api/accounts/:id/connect     go to the sign-in page
 *   GET  /api/accounts/:id/callback    back from sign-in
 *   POST /api/accounts/:id/disconnect  forget the account
 *   GET  /api/accounts/email           latest emails (Gmail and/or Outlook)
 *   GET  /api/accounts/calendar        events between ?from= and ?to= (Google and/or Outlook)
 *   POST /api/accounts/music           find (and, with Spotify Premium, play) music
 */
import { ACCOUNT_IDS, isAccountId, isConfigured, providerConfig, type AccountId, type Env } from "./config";
import {
  gmailLatest,
  googleEvents,
  outlookEvents,
  outlookLatest,
  spotifyAppToken,
  spotifyPlay,
  spotifySearch,
  spotifySearchUrl,
  type CalendarEvent,
  type EmailItem,
  type MusicResult,
} from "./data";
import { accessToken, finishSignIn, readSession, revoke, sessionCookie, startSignIn, type Fetch, type Session } from "./oauth";

export interface AccountInfo {
  id: AccountId;
  name: string;
  state: "connected" | "disconnected" | "needs-attention" | "unavailable";
  account?: string;
  message?: string;
  worksWithoutSignIn?: boolean;
}

function json(status: number, data: unknown, cookies: string[] = []): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  cookies.forEach((c) => headers.append("Set-Cookie", c));
  return new Response(JSON.stringify(data), { status, headers });
}

function redirect(to: string, request: Request, cookies: string[] = []): Response {
  const headers = new Headers({ Location: new URL(to, request.url).toString(), "Cache-Control": "no-store" });
  cookies.forEach((c) => headers.append("Set-Cookie", c));
  return new Response(null, { status: 303, headers });
}

/** Only this app's own pages may use these (same check as /api/assistant). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function listAccounts(request: Request, env: Env): Response {
  const list: AccountInfo[] = ACCOUNT_IDS.map((id) => {
    const name = providerConfig(id, env).name;
    if (!isConfigured(id, env)) {
      if (id === "spotify") {
        return {
          id,
          name,
          state: "unavailable",
          worksWithoutSignIn: true,
          message: "Works without signing in: say \"play\" and a song or singer, and I'll open it in Spotify.",
        };
      }
      return { id, name, state: "unavailable", message: "This hasn't been set up on Companion's server yet." };
    }
    const s = readSession(request, id, env);
    if (!s) return { id, name, state: "disconnected" };
    if (!s.refresh && (!s.exp || s.exp < Date.now())) return { id, name, state: "needs-attention", account: s.account };
    return { id, name, state: "connected", account: s.account };
  });
  return json(200, list);
}

export function connect(request: Request, id: string, env: Env): Response {
  if (!isAccountId(id)) return json(404, { error: "unknown-account" });
  if (!isConfigured(id, env)) return redirect(`/settings/connections?error=${id}:unavailable`, request);
  const { url, cookie } = startSignIn(request, id, env);
  return new Response(null, { status: 303, headers: { Location: url, "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}

export async function callback(request: Request, id: string, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  if (!isAccountId(id) || !isConfigured(id, env)) return redirect("/settings/connections?error=unknown", request);
  const r = await finishSignIn(request, id, env, fetchImpl);
  if (!r.ok) return redirect(`/settings/connections?error=${id}:${r.reason}`, request, [r.clearState]);
  return redirect(`/settings/connections?connected=${id}`, request, [r.clearState, sessionCookie(request, id, r.session, env)]);
}

export async function disconnect(request: Request, id: string, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  if (!isAccountId(id)) return json(404, { error: "unknown-account" });
  const s = readSession(request, id, env);
  if (s) await revoke(id, s, fetchImpl);
  return json(200, { ok: true }, [sessionCookie(request, id, null, env)]);
}

/** A token for an account, plus any cookie to re-write. Null when not connected or signed out. */
async function tokenFor(request: Request, id: AccountId, env: Env, fetchImpl: Fetch, cookies: string[]): Promise<string | null> {
  if (!isConfigured(id, env)) return null;
  const s: Session | null = readSession(request, id, env);
  if (!s) return null;
  const t = await accessToken(id, s, env, fetchImpl);
  if (!t) return null;
  if (t.updated) cookies.push(sessionCookie(request, id, t.updated, env));
  return t.token;
}

export async function email(request: Request, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const cookies: string[] = [];
  const [g, o] = await Promise.all([tokenFor(request, "gmail", env, fetchImpl, cookies), tokenFor(request, "outlook", env, fetchImpl, cookies)]);
  if (!g && !o) return json(409, { error: "not-connected" }, cookies);
  const results = await Promise.allSettled([g ? gmailLatest(g, fetchImpl) : null, o ? outlookLatest(o, fetchImpl) : null]);
  const ok = results.filter((r): r is PromiseFulfilledResult<{ unread: number; items: EmailItem[] } | null> => r.status === "fulfilled").map((r) => r.value).filter(Boolean) as Array<{ unread: number; items: EmailItem[] }>;
  if (!ok.length) return json(502, { error: "provider-failed" }, cookies);
  const items = ok.flatMap((x) => x.items).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 5);
  return json(200, { unread: ok.reduce((n, x) => n + x.unread, 0), items, sources: [g && "Gmail", o && "Outlook"].filter(Boolean) }, cookies);
}

export async function calendar(request: Request, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || Date.parse(to) - Date.parse(from) > 40 * 864e5) {
    return json(400, { error: "bad-range" });
  }
  const cookies: string[] = [];
  const [g, o] = await Promise.all([tokenFor(request, "google-calendar", env, fetchImpl, cookies), tokenFor(request, "outlook", env, fetchImpl, cookies)]);
  if (!g && !o) return json(409, { error: "not-connected" }, cookies);
  const f = new Date(from).toISOString();
  const t = new Date(to).toISOString();
  const results = await Promise.allSettled([g ? googleEvents(g, f, t, fetchImpl) : [], o ? outlookEvents(o, f, t, fetchImpl) : []]);
  const ok = results.filter((r): r is PromiseFulfilledResult<CalendarEvent[]> => r.status === "fulfilled");
  if (!ok.length) return json(502, { error: "provider-failed" }, cookies);
  const events = ok.flatMap((r) => r.value).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(0, 15);
  return json(200, { events, sources: [g && "Google Calendar", o && "Outlook"].filter(Boolean) }, cookies);
}

export async function music(request: Request, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.replace(/\s+/g, " ").trim().slice(0, 100) : "";
  if (!query) return json(400, { error: "bad-request" });

  // No Spotify keys at all: Spotify's own search page still works for everyone.
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    const r: MusicResult = { url: spotifySearchUrl(query), title: query, played: false, note: "search-only" };
    return json(200, r);
  }
  const cookies: string[] = [];
  try {
    const userToken = await tokenFor(request, "spotify", env, fetchImpl, cookies);
    const searchToken = userToken ?? (await spotifyAppToken(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET, fetchImpl));
    const found = await spotifySearch(query, searchToken, fetchImpl);
    if (!found) return json(200, { url: spotifySearchUrl(query), title: query, played: false, note: "search-only" } satisfies MusicResult, cookies);
    let played: true | "no-device" | "premium" | "failed" | "not-connected" = "not-connected";
    if (userToken) played = await spotifyPlay(userToken, found, fetchImpl).catch(() => "failed" as const);
    const r: MusicResult = {
      url: found.url || spotifySearchUrl(query),
      title: found.title,
      played: played === true,
      ...(played === true ? {} : { note: played === "failed" ? "no-device" : played }),
    };
    return json(200, r, cookies);
  } catch (err) {
    console.error("[accounts] spotify failed:", err instanceof Error ? err.message : "unknown");
    return json(200, { url: spotifySearchUrl(query), title: query, played: false, note: "search-only" } satisfies MusicResult, cookies);
  }
}
