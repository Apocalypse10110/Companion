/**
 * Actions that use connected accounts: read the latest emails, read the calendar, play music.
 * Email and calendar are summarised here, on the phone, for reading aloud. They are never sent to
 * the AI. Owner: Developer C/D.
 */
import type { ActionResult } from "@/contracts";
import { isSampleOn, sampleEmails, sampleEvents } from "@/accounts/sample";
import type { Launcher } from "@/phone/platform";

type Fetch = typeof fetch;

const NOT_CONNECTED_EMAIL =
  "Your email isn't connected yet. Open Settings, then Connected accounts, and connect Gmail or Outlook. To try it right now, turn on the sample inbox there.";
const NOT_CONNECTED_CALENDAR =
  "Your calendar isn't connected yet. Open Settings, then Connected accounts, and connect Google Calendar or Outlook. To try it right now, turn on the sample calendar there.";
const PROVIDER_DOWN = "I couldn't reach your account just now. Please try again in a minute.";

function ago(iso: string, now: Date): string {
  const mins = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

type EmailList = { unread: number; items: Array<{ from: string; subject: string; date: string; unread: boolean }> };
type EventList = Array<{ title: string; start: string; allDay: boolean; location?: string }>;

function summariseEmails(d: EmailList, now: Date): string {
  if (!d.items.length) return "Your inbox is empty.";
  const lead = d.unread === 0 ? "You have no unread emails." : d.unread === 1 ? "You have 1 unread email." : `You have ${d.unread} unread emails.`;
  const [first, ...rest] = d.items;
  const lines = [`The latest is from ${first.from}, about "${first.subject}", ${ago(first.date, now)}.`];
  if (rest.length) lines.push(`Before that: ${rest.slice(0, 2).map((m) => `from ${m.from}, about "${m.subject}"`).join("; and ")}.`);
  return `${lead} ${lines.join(" ")}`;
}

export async function readEmail(fetchImpl: Fetch, now: Date): Promise<ActionResult> {
  // Sample mode: made-up emails, always introduced as the sample, never fetched from anywhere.
  if (isSampleOn()) return { ok: true, message: `This is the sample inbox. ${summariseEmails(sampleEmails(now), now)}` };
  let res: Response;
  try {
    res = await fetchImpl("/api/accounts/email", { cache: "no-store" });
  } catch {
    return { ok: false, message: "I couldn't check your email because there's no internet connection." };
  }
  if (res.status === 409) return { ok: false, message: NOT_CONNECTED_EMAIL };
  if (!res.ok) return { ok: false, message: PROVIDER_DOWN };
  return { ok: true, message: summariseEmails((await res.json()) as EmailList, now) };
}

/** The person's own today / tomorrow / this week, worked out on the phone (it knows the time zone). */
export function calendarRange(when: string, now: Date): { from: Date; to: Date; label: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (when === "tomorrow") {
    start.setDate(start.getDate() + 1);
    const to = new Date(start);
    to.setDate(to.getDate() + 1);
    return { from: start, to, label: "tomorrow" };
  }
  if (when === "week") {
    const to = new Date(start);
    to.setDate(to.getDate() + 7);
    return { from: now, to, label: "in the next 7 days" };
  }
  const to = new Date(start);
  to.setDate(to.getDate() + 1);
  return { from: now, to, label: "for the rest of today" };
}

function summariseEvents(events: EventList, r: { label: string }, language: string): string {
  if (!events.length) return `There's nothing on your calendar ${r.label}.`;
  const fmt = (e: EventList[number]) => {
    const t = new Date(e.start);
    let when = "";
    try {
      const day = r.label.startsWith("in the next") ? `${t.toLocaleDateString(language, { weekday: "long" })} ` : "";
      when = e.allDay ? `${day}all day` : `${day}at ${t.toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" })}`;
    } catch {
      when = e.allDay ? "all day" : "";
    }
    return `${e.title}, ${when}${e.location ? `, at ${e.location}` : ""}`;
  };
  const n = events.length;
  const shown = events.slice(0, 4).map(fmt);
  return `You have ${n === 1 ? "1 thing" : `${n} things`} on your calendar ${r.label}. ${shown.join(". Then ")}.${n > 4 ? ` And ${n - 4} more.` : ""}`;
}

export async function checkCalendar(when: string, fetchImpl: Fetch, now: Date, language: string): Promise<ActionResult> {
  const r = calendarRange(when, now);
  if (isSampleOn()) {
    const inRange = sampleEvents(now).filter((e) => Date.parse(e.start) >= r.from.getTime() && Date.parse(e.start) < r.to.getTime());
    return { ok: true, message: `This is the sample calendar. ${summariseEvents(inRange, r, language)}` };
  }
  let res: Response;
  try {
    res = await fetchImpl(`/api/accounts/calendar?from=${encodeURIComponent(r.from.toISOString())}&to=${encodeURIComponent(r.to.toISOString())}`, { cache: "no-store" });
  } catch {
    return { ok: false, message: "I couldn't check your calendar because there's no internet connection." };
  }
  if (res.status === 409) return { ok: false, message: NOT_CONNECTED_CALENDAR };
  if (!res.ok) return { ok: false, message: PROVIDER_DOWN };
  const d = (await res.json()) as { events: EventList };
  return { ok: true, message: summariseEvents(d.events, r, language) };
}

export async function playMusic(query: string, fetchImpl: Fetch, launch: Launcher): Promise<ActionResult> {
  let d: { url: string; title: string; played: boolean; note?: string };
  try {
    const res = await fetchImpl("/api/accounts/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    if (!res.ok) throw new Error(String(res.status));
    d = await res.json();
  } catch {
    // No internet or the server failed: Spotify's search page still works.
    d = { url: `https://open.spotify.com/search/${encodeURIComponent(query)}`, title: query, played: false, note: "search-only" };
  }
  if (d.played) return { ok: true, message: `Playing ${d.title} on Spotify.` };
  launch(d.url);
  if (d.note === "search-only") return { ok: true, message: `I've opened Spotify and searched for ${d.title}. Tap the one you want, then the green play button.` };
  return { ok: true, message: `I've opened ${d.title} in Spotify. Tap the green play button to start it.` };
}
