import { describe, expect, it, vi } from "vitest";
import { classify } from "@/ai/intents/rules";
import { validateIntent } from "@/ai/intents/schema";
import { checkCalendar, playMusic, readEmail } from "@/actions/accounts";
import { signInOutcome } from "./client";
import { isConfigured } from "./server/config";
import { callback, calendar, connect, email, listAccounts, music } from "./server/handlers";
import { seal, unseal } from "./server/seal";

const SECRET = "x".repeat(40);
const ENV = {
  ACCOUNTS_SECRET: SECRET,
  GOOGLE_CLIENT_ID: "gid",
  GOOGLE_CLIENT_SECRET: "gsecret",
  MICROSOFT_CLIENT_ID: "mid",
  MICROSOFT_CLIENT_SECRET: "msecret",
  SPOTIFY_CLIENT_ID: "sid",
  SPOTIFY_CLIENT_SECRET: "ssecret",
};
const BASE = "https://companion.example";

function cookieJar(res: Response): string {
  const all = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  return all.map((c) => c.split(";")[0]).join("; ");
}

function route(map: Record<string, unknown | ((init?: RequestInit) => Response)>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const key = Object.keys(map).find((k) => u.includes(k));
    if (!key) return new Response("not mocked: " + u, { status: 500 });
    const v = map[key];
    return typeof v === "function" ? (v as (i?: RequestInit) => Response)(init) : Response.json(v);
  }) as unknown as typeof fetch;
}

describe("sealed cookies", () => {
  it("round-trips, and rejects tampering or the wrong secret", () => {
    const s = seal({ account: "a@b.c", refresh: "r" }, SECRET);
    expect(unseal(s, SECRET)).toEqual({ account: "a@b.c", refresh: "r" });
    expect(unseal(s, "y".repeat(40))).toBeNull();
    expect(unseal(s.slice(0, -2) + "AA", SECRET)).toBeNull();
    expect(unseal("rubbish", SECRET)).toBeNull();
  });
});

describe("configuration", () => {
  it("needs both client keys and a long cookie secret", () => {
    expect(isConfigured("gmail", ENV)).toBe(true);
    expect(isConfigured("gmail", { ...ENV, ACCOUNTS_SECRET: "short" })).toBe(false);
    expect(isConfigured("outlook", { ACCOUNTS_SECRET: SECRET })).toBe(false);
  });

  it("lists accounts honestly, never with tokens", async () => {
    const list = await listAccounts(new Request(`${BASE}/api/accounts`), { ACCOUNTS_SECRET: SECRET, SPOTIFY_CLIENT_ID: "a", SPOTIFY_CLIENT_SECRET: "b" }).json();
    // Accounts this server isn't set up for are left out, so nothing looks broken.
    expect(list.map((a: { id: string }) => a.id)).toEqual(["spotify"]);
    expect(list.find((a: { id: string }) => a.id === "spotify").state).toBe("disconnected");
  });

  it("hides Outlook when it isn't set up, keeps the ones that are", async () => {
    const env = { ACCOUNTS_SECRET: SECRET, GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" };
    const ids = (await listAccounts(new Request(`${BASE}/api/accounts`), env).json()).map((a: { id: string }) => a.id);
    expect(ids).toEqual(["gmail", "google-calendar", "spotify"]);
  });
});

describe("sign-in", () => {
  it("connect -> Google with PKCE and state; callback with the right state connects", async () => {
    const start = connect(new Request(`${BASE}/api/accounts/gmail/connect`), "gmail", ENV);
    const to = new URL(start.headers.get("location")!);
    expect(to.origin).toBe("https://accounts.google.com");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(to.searchParams.get("redirect_uri")).toBe(`${BASE}/api/accounts/gmail/callback`);
    expect(to.searchParams.get("scope")).toContain("gmail.readonly");
    const state = to.searchParams.get("state")!;

    const fetchImpl = route({
      "oauth2.googleapis.com/token": { access_token: "AT", refresh_token: "RT", expires_in: 3600 },
      "openidconnect.googleapis.com": { email: "anna@gmail.com" },
    });
    const back = await callback(
      new Request(`${BASE}/api/accounts/gmail/callback?code=abc&state=${state}`, { headers: { cookie: cookieJar(start) } }),
      "gmail",
      ENV,
      fetchImpl,
    );
    expect(back.headers.get("location")).toBe(`${BASE}/settings/connections?connected=gmail`);
    const jar = cookieJar(back);
    expect(jar).toContain("acct_gmail=");
    expect(jar).not.toContain("RT"); // encrypted

    const list = await listAccounts(new Request(`${BASE}/api/accounts`, { headers: { cookie: jar } }), ENV).json();
    expect(list.find((a: { id: string }) => a.id === "gmail")).toMatchObject({ state: "connected", account: "anna@gmail.com" });
  });

  it("refuses a callback whose state doesn't match (forged sign-in)", async () => {
    const start = connect(new Request(`${BASE}/api/accounts/outlook/connect`), "outlook", ENV);
    const back = await callback(new Request(`${BASE}/api/accounts/outlook/callback?code=abc&state=evil`, { headers: { cookie: cookieJar(start) } }), "outlook", ENV, route({}));
    expect(back.headers.get("location")).toContain("error=outlook:state");
  });

  it("treats 'cancel' on the sign-in page as nothing changed", async () => {
    const back = await callback(new Request(`${BASE}/api/accounts/spotify/callback?error=access_denied`), "spotify", ENV, route({}));
    expect(back.headers.get("location")).toContain("error=spotify:cancelled");
    expect(signInOutcome("?error=spotify:cancelled")).toMatchObject({ tone: "info" });
  });
});

function connected(id: string, access = "AT") {
  return `acct_${id.replace(/-/g, "_")}=${seal({ account: "me", access, refresh: "RT", exp: Date.now() + 3_600_000 }, SECRET)}`;
}

describe("email and calendar", () => {
  it("409 when nothing is connected", async () => {
    expect((await email(new Request(`${BASE}/api/accounts/email`), ENV)).status).toBe(409);
  });

  it("merges Gmail, newest first", async () => {
    const fetchImpl = route({
      "messages?maxResults": { messages: [{ id: "1" }] },
      "labels/INBOX": { messagesUnread: 3 },
      "messages/1": { labelIds: ["UNREAD"], internalDate: String(Date.now()), payload: { headers: [{ name: "From", value: "Anna Smith <a@x.com>" }, { name: "Subject", value: "Lunch Sunday?" }] } },
    });
    const d = await (await email(new Request(`${BASE}/api/accounts/email`, { headers: { cookie: connected("gmail") } }), ENV, fetchImpl)).json();
    expect(d).toMatchObject({ unread: 3, items: [{ from: "Anna Smith", subject: "Lunch Sunday?", unread: true }] });
  });

  it("reads Outlook calendar events in UTC", async () => {
    const fetchImpl = route({
      calendarView: { value: [{ subject: "Doctor", start: { dateTime: "2026-11-12T10:30:00.0000000" }, isAllDay: false, location: { displayName: "Surgery" } }] },
    });
    const from = new Date("2026-11-12T00:00:00Z").toISOString();
    const to = new Date("2026-11-13T00:00:00Z").toISOString();
    const res = await calendar(new Request(`${BASE}/api/accounts/calendar?from=${from}&to=${to}`, { headers: { cookie: connected("outlook") } }), ENV, fetchImpl);
    expect((await res.json()).events[0]).toMatchObject({ title: "Doctor", start: "2026-11-12T10:30:00.0000000Z", location: "Surgery" });
  });

  it("refreshes an expired token and re-writes the cookie", async () => {
    const expired = `acct_google_calendar=${seal({ account: "me", access: "old", refresh: "RT", exp: Date.now() - 1000 }, SECRET)}`;
    const fetchImpl = route({ "oauth2.googleapis.com/token": { access_token: "NEW", expires_in: 3600 }, "calendar/v3": { items: [] } });
    const res = await calendar(new Request(`${BASE}/api/accounts/calendar?from=2026-11-12T00:00:00Z&to=2026-11-13T00:00:00Z`, { headers: { cookie: expired } }), ENV, fetchImpl);
    expect(res.status).toBe(200);
    expect(cookieJar(res)).toContain("acct_google_calendar=");
  });
});

describe("music", () => {
  it("without Spotify keys: Spotify's own search page", async () => {
    const res = await music(new Request(`${BASE}/api/accounts/music`, { method: "POST", body: JSON.stringify({ query: "frank sinatra" }) }), { ACCOUNTS_SECRET: SECRET });
    expect(await res.json()).toMatchObject({ url: "https://open.spotify.com/search/frank%20sinatra", played: false, note: "search-only" });
  });

  it("connected with Premium: finds and plays it", async () => {
    const fetchImpl = route({
      "api/v1/search": {},
      "v1/search": { tracks: { items: [{ uri: "spotify:track:1", name: "Fly Me to the Moon", external_urls: { spotify: "https://open.spotify.com/track/1" }, artists: [{ name: "Frank Sinatra" }] }] } },
      "me/player/play": () => new Response(null, { status: 204 }),
    });
    const res = await music(new Request(`${BASE}/api/accounts/music`, { method: "POST", body: JSON.stringify({ query: "fly me to the moon" }), headers: { cookie: connected("spotify") } }), ENV, fetchImpl);
    expect(await res.json()).toMatchObject({ played: true, title: "Fly Me to the Moon by Frank Sinatra" });
  });
});

describe("what the person hears", () => {
  const now = new Date();
  it("reads emails aloud in plain sentences", async () => {
    const f = (async () => Response.json({ unread: 2, items: [{ from: "Anna", subject: "Lunch", date: new Date(now.getTime() - 2 * 3600e3).toISOString(), unread: true }] })) as unknown as typeof fetch;
    expect((await readEmail(f, now)).message).toBe('You have 2 unread emails. The latest is from Anna, about "Lunch", 2 hours ago.');
  });
  it("says how to connect when nothing is connected", async () => {
    const f = (async () => new Response("{}", { status: 409 })) as unknown as typeof fetch;
    expect((await checkCalendar("today", f, now, "en-US")).message).toContain("Connected accounts");
  });
  it("opens Spotify when it can't start playing itself", async () => {
    const launch = vi.fn();
    const f = (async () => Response.json({ url: "https://open.spotify.com/track/1", title: "Moon River", played: false, note: "not-connected" })) as unknown as typeof fetch;
    const r = await playMusic("moon river", f, launch);
    expect(launch).toHaveBeenCalledWith("https://open.spotify.com/track/1");
    expect(r.message).toContain("Tap the green play button");
  });
});

describe("voice intents", () => {
  const intent = (s: string) => validateIntent(classify(s));
  it.each([
    ["read my email", "READ_EMAIL"],
    ["do I have any new emails?", "READ_EMAIL"],
    ["what's on my calendar today", "CHECK_CALENDAR"],
    ["am I busy this week", "CHECK_CALENDAR"],
    ["what do I have today", "LIST_REMINDERS"],
    ["play some frank sinatra", "PLAY_MUSIC"],
    ["put on some music", "PLAY_MUSIC"],
    ["read my messages", "READ_MESSAGES"],
    ["open my email", "OPEN_APPLICATION"],
  ])("%s -> %s", (s, name) => {
    expect(intent(s)?.name).toBe(name);
  });
  it("keeps the details", () => {
    expect(intent("what's on my calendar tomorrow")?.params).toEqual({ when: "tomorrow" });
    expect(intent("play some frank sinatra on spotify please")?.params).toEqual({ query: "frank sinatra" });
    expect(intent("put on some music")?.params).toEqual({ query: "relaxing music" });
  });
});
