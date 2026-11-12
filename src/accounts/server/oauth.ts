/**
 * The sign-in dance for every account (OAuth 2 authorization code + PKCE), token refresh, and the
 * encrypted per-account cookie. Server only. No database: each account lives in its own cookie.
 */
import { providerConfig, type AccountId, type Env, type ProviderConfig } from "./config";
import { challenge, randomToken, seal, unseal } from "./seal";

export interface Session {
  account: string;
  refresh?: string;
  access?: string;
  /** ms since epoch when `access` expires. */
  exp?: number;
}

const COOKIE = (id: AccountId) => `acct_${id.replace(/-/g, "_")}`;
const STATE_COOKIE = (id: AccountId) => `oauth_${id.replace(/-/g, "_")}`;
const THIRTY_DAYS = 30 * 24 * 3600;
/** Browsers cap a cookie at about 4 KB; very long access tokens are fetched again instead of kept. */
const MAX_COOKIE = 3800;

export type Fetch = typeof fetch;

// ---------- cookies ----------

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}

export function cookieHeader(name: string, value: string, secure: boolean, maxAge: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

const isSecure = (request: Request) => new URL(request.url).protocol === "https:";

export function readSession(request: Request, id: AccountId, env: Env): Session | null {
  return unseal<Session>(readCookie(request, COOKIE(id)), env.ACCOUNTS_SECRET ?? "");
}

export function sessionCookie(request: Request, id: AccountId, session: Session | null, env: Env): string {
  if (!session) return cookieHeader(COOKIE(id), "", isSecure(request), 0);
  let value = seal(session, env.ACCOUNTS_SECRET ?? "");
  if (value.length > MAX_COOKIE) value = seal({ account: session.account, refresh: session.refresh }, env.ACCOUNTS_SECRET ?? "");
  return cookieHeader(COOKIE(id), value, isSecure(request), THIRTY_DAYS);
}

// ---------- sign-in ----------

export function redirectUri(request: Request, id: AccountId): string {
  // Behind Vercel's proxy, request.url already has the public https origin.
  return new URL(`/api/accounts/${id}/callback`, request.url).toString();
}

/** Start sign-in: where to send the person, and the short-lived cookie that proves it was us. */
export function startSignIn(request: Request, id: AccountId, env: Env): { url: string; cookie: string } {
  const c = providerConfig(id, env);
  const state = randomToken(18);
  const verifier = randomToken(48);
  const url = new URL(c.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: c.clientId ?? "",
    response_type: "code",
    redirect_uri: redirectUri(request, id),
    scope: c.scopes.join(" "),
    state,
    code_challenge: challenge(verifier),
    code_challenge_method: "S256",
    ...(c.extraAuthParams ?? {}),
  }).toString();
  const cookie = cookieHeader(STATE_COOKIE(id), seal({ state, verifier }, env.ACCOUNTS_SECRET ?? ""), isSecure(request), 600);
  return { url: url.toString(), cookie };
}

async function tokenRequest(c: ProviderConfig, body: Record<string, string>, fetchImpl: Fetch) {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  const form = new URLSearchParams(body);
  if (c.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`;
  else {
    form.set("client_id", c.clientId ?? "");
    form.set("client_secret", c.clientSecret ?? "");
  }
  const res = await fetchImpl(c.tokenUrl, { method: "POST", headers, body: form });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`token ${res.status} ${data.error ?? ""}`.trim());
  return data;
}

/** Who signed in, as shown in Settings ("anna@gmail.com"). */
async function whoAmI(c: ProviderConfig, access: string, fetchImpl: Fetch): Promise<string> {
  const url =
    c.family === "google"
      ? "https://openidconnect.googleapis.com/v1/userinfo"
      : c.family === "microsoft"
        ? "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName"
        : "https://api.spotify.com/v1/me";
  try {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${access}` } });
    const d = (await res.json()) as { email?: string; mail?: string; userPrincipalName?: string; display_name?: string; displayName?: string };
    return (d.email || d.mail || d.userPrincipalName || d.display_name || d.displayName || "your account").slice(0, 120);
  } catch {
    return "your account";
  }
}

export type FinishResult = { ok: true; session: Session; clearState: string } | { ok: false; reason: "cancelled" | "state" | "failed"; clearState: string };

/** Finish sign-in: check it's the same sign-in we started, swap the code for tokens. */
export async function finishSignIn(request: Request, id: AccountId, env: Env, fetchImpl: Fetch = fetch): Promise<FinishResult> {
  const url = new URL(request.url);
  const clearState = cookieHeader(STATE_COOKIE(id), "", isSecure(request), 0);
  if (url.searchParams.get("error")) return { ok: false, reason: "cancelled", clearState };
  const saved = unseal<{ state: string; verifier: string }>(readCookie(request, STATE_COOKIE(id)), env.ACCOUNTS_SECRET ?? "");
  const code = url.searchParams.get("code");
  if (!saved || !code || saved.state !== url.searchParams.get("state")) return { ok: false, reason: "state", clearState };
  const c = providerConfig(id, env);
  try {
    const t = await tokenRequest(
      c,
      { grant_type: "authorization_code", code, redirect_uri: redirectUri(request, id), code_verifier: saved.verifier },
      fetchImpl,
    );
    const account = await whoAmI(c, t.access_token!, fetchImpl);
    return {
      ok: true,
      clearState,
      session: { account, refresh: t.refresh_token, access: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000 },
    };
  } catch (err) {
    console.error(`[accounts] ${id} sign-in failed:`, err instanceof Error ? err.message : "unknown");
    return { ok: false, reason: "failed", clearState };
  }
}

/**
 * A working access token, refreshing it if needed. `updated` is set when the cookie must be
 * re-written (new token, or Microsoft's rotating refresh token).
 */
export async function accessToken(
  id: AccountId,
  session: Session,
  env: Env,
  fetchImpl: Fetch = fetch,
): Promise<{ token: string; updated?: Session } | null> {
  if (session.access && session.exp && session.exp - 60_000 > Date.now()) return { token: session.access };
  if (!session.refresh) return null;
  try {
    const t = await tokenRequest(providerConfig(id, env), { grant_type: "refresh_token", refresh_token: session.refresh }, fetchImpl);
    const updated: Session = {
      account: session.account,
      refresh: t.refresh_token ?? session.refresh,
      access: t.access_token,
      exp: Date.now() + (t.expires_in ?? 3600) * 1000,
    };
    return { token: t.access_token!, updated };
  } catch {
    return null; // revoked or expired: the person needs to sign in again
  }
}

/** Best effort: tell Google to forget the permission when someone disconnects. */
export async function revoke(id: AccountId, session: Session, fetchImpl: Fetch = fetch): Promise<void> {
  const token = session.refresh ?? session.access;
  if (!token || providerConfig(id).family !== "google") return;
  await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});
}
