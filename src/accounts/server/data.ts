/**
 * Reading from connected accounts (server only). Only what's needed to read aloud is fetched:
 * who an email is from, the subject, when, and whether it's unread; calendar titles, times and
 * places. Nothing is stored, and none of it is sent to the AI.
 */
import type { Fetch } from "./oauth";

export interface EmailItem {
  from: string;
  subject: string;
  date: string;
  unread: boolean;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  location?: string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return (await res.json()) as T;
}

/** "Anna Smith <anna@x.com>" -> "Anna Smith". */
export function displayName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return (m ? m[1] : from).trim().slice(0, 80) || "someone";
}

const clip = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ---------- Gmail ----------

export async function gmailLatest(token: string, fetchImpl: Fetch, max = 5): Promise<{ unread: number; items: EmailItem[] }> {
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";
  const [list, inbox] = await Promise.all([
    fetchImpl(`${base}/messages?maxResults=${max}&labelIds=INBOX&q=${encodeURIComponent("category:primary")}`, { headers: auth(token) }).then((r) =>
      json<{ messages?: Array<{ id: string }> }>(r),
    ),
    fetchImpl(`${base}/labels/INBOX`, { headers: auth(token) })
      .then((r) => json<{ messagesUnread?: number }>(r))
      .catch(() => ({ messagesUnread: 0 })),
  ]);
  const items = await Promise.all(
    (list.messages ?? []).slice(0, max).map(async ({ id }) => {
      const m = await fetchImpl(`${base}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: auth(token),
      }).then((r) => json<{ labelIds?: string[]; internalDate?: string; payload?: { headers?: Array<{ name: string; value: string }> } }>(r));
      const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value;
      return {
        from: displayName(h("from") ?? ""),
        subject: clip(h("subject"), 140) || "(no subject)",
        date: new Date(Number(m.internalDate) || Date.parse(h("date") ?? "") || Date.now()).toISOString(),
        unread: Boolean(m.labelIds?.includes("UNREAD")),
      };
    }),
  );
  return { unread: inbox.messagesUnread ?? items.filter((i) => i.unread).length, items };
}

// ---------- Google Calendar ----------

export async function googleEvents(token: string, from: string, to: string, fetchImpl: Fetch): Promise<CalendarEvent[]> {
  const q = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: "true", orderBy: "startTime", maxResults: "15" });
  const d = await fetchImpl(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { headers: auth(token) }).then((r) =>
    json<{ items?: Array<{ summary?: string; location?: string; status?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }> }>(r),
  );
  return (d.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      title: clip(e.summary, 120) || "Busy",
      start: e.start?.dateTime ?? e.start?.date ?? from,
      end: e.end?.dateTime ?? e.end?.date,
      allDay: !e.start?.dateTime,
      ...(e.location ? { location: clip(e.location, 120) } : {}),
    }));
}

// ---------- Outlook (Microsoft Graph) ----------

export async function outlookLatest(token: string, fetchImpl: Fetch, max = 5): Promise<{ unread: number; items: EmailItem[] }> {
  const g = "https://graph.microsoft.com/v1.0/me";
  const [list, folder] = await Promise.all([
    fetchImpl(`${g}/mailFolders/inbox/messages?$top=${max}&$select=subject,from,receivedDateTime,isRead&$orderby=receivedDateTime desc`, {
      headers: auth(token),
    }).then((r) => json<{ value?: Array<{ subject?: string; isRead?: boolean; receivedDateTime?: string; from?: { emailAddress?: { name?: string; address?: string } } }> }>(r)),
    fetchImpl(`${g}/mailFolders/inbox?$select=unreadItemCount`, { headers: auth(token) })
      .then((r) => json<{ unreadItemCount?: number }>(r))
      .catch(() => ({ unreadItemCount: 0 })),
  ]);
  const items = (list.value ?? []).map((m) => ({
    from: clip(m.from?.emailAddress?.name || m.from?.emailAddress?.address, 80) || "someone",
    subject: clip(m.subject, 140) || "(no subject)",
    date: m.receivedDateTime ?? new Date().toISOString(),
    unread: m.isRead === false,
  }));
  return { unread: folder.unreadItemCount ?? items.filter((i) => i.unread).length, items };
}

export async function outlookEvents(token: string, from: string, to: string, fetchImpl: Fetch): Promise<CalendarEvent[]> {
  const q = new URLSearchParams({ startDateTime: from, endDateTime: to, $select: "subject,start,end,isAllDay,location,isCancelled", $orderby: "start/dateTime", $top: "15" });
  const d = await fetchImpl(`https://graph.microsoft.com/v1.0/me/calendarView?${q}`, {
    headers: { ...auth(token), Prefer: 'outlook.timezone="UTC"' },
  }).then((r) =>
    json<{ value?: Array<{ subject?: string; isAllDay?: boolean; isCancelled?: boolean; location?: { displayName?: string }; start?: { dateTime?: string }; end?: { dateTime?: string } }> }>(r),
  );
  const utc = (s?: string) => (s ? (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`) : undefined);
  return (d.value ?? [])
    .filter((e) => !e.isCancelled)
    .map((e) => ({
      title: clip(e.subject, 120) || "Busy",
      start: utc(e.start?.dateTime) ?? from,
      end: utc(e.end?.dateTime),
      allDay: Boolean(e.isAllDay),
      ...(e.location?.displayName ? { location: clip(e.location.displayName, 120) } : {}),
    }));
}

// ---------- Spotify ----------

export interface MusicResult {
  /** Opens the song or playlist in the Spotify app (or website). */
  url: string;
  title: string;
  /** True only when Spotify confirmed it started playing. */
  played: boolean;
  /** Why it couldn't start by itself, if it didn't. */
  note?: "no-device" | "premium" | "not-connected" | "search-only";
}

/** A Spotify app token (no person signed in), good for searching. */
export async function spotifyAppToken(clientId: string, clientSecret: string, fetchImpl: Fetch): Promise<string> {
  const res = await fetchImpl("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  return (await json<{ access_token: string }>(res)).access_token;
}

/** Find the best song or playlist for what the person asked for ("Frank Sinatra", "relaxing piano"). */
export async function spotifySearch(query: string, token: string, fetchImpl: Fetch): Promise<{ uri: string; url: string; title: string; kind: "track" | "playlist" } | null> {
  const q = new URLSearchParams({ q: query, type: "track,playlist", limit: "1" });
  const d = await fetchImpl(`https://api.spotify.com/v1/search?${q}`, { headers: auth(token) }).then((r) =>
    json<{
      tracks?: { items?: Array<{ uri: string; name: string; external_urls?: { spotify?: string }; artists?: Array<{ name: string }> } | null> };
      playlists?: { items?: Array<{ uri: string; name: string; external_urls?: { spotify?: string } } | null> };
    }>(r),
  );
  // Moods and genres ("relaxing music") suit a playlist; a name suits a song.
  const wantsPlaylist = /\b(music|songs|playlist|radio|mix|relax|calm|sleep|classical|jazz|hits|oldies|christmas)\b/i.test(query);
  const track = d.tracks?.items?.find(Boolean);
  const list = d.playlists?.items?.find(Boolean);
  const pickPlaylist = (wantsPlaylist && list) || (!track && list);
  if (pickPlaylist && list) return { uri: list.uri, url: list.external_urls?.spotify ?? "", title: list.name, kind: "playlist" };
  if (track) {
    const by = track.artists?.map((a) => a.name).slice(0, 2).join(" and ");
    return { uri: track.uri, url: track.external_urls?.spotify ?? "", title: by ? `${track.name} by ${by}` : track.name, kind: "track" };
  }
  return null;
}

/** Start it on the person's Spotify (needs Premium and Spotify open on a device). */
export async function spotifyPlay(token: string, item: { uri: string; kind: "track" | "playlist" }, fetchImpl: Fetch): Promise<true | "no-device" | "premium" | "failed"> {
  const res = await fetchImpl("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: { ...auth(token), "Content-Type": "application/json" },
    body: JSON.stringify(item.kind === "track" ? { uris: [item.uri] } : { context_uri: item.uri }),
  });
  if (res.status === 204 || res.status === 202 || res.ok) return true;
  if (res.status === 404) return "no-device";
  if (res.status === 403) return "premium";
  return "failed";
}

export function spotifySearchUrl(query: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}`;
}
