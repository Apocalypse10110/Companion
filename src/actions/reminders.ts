/**
 * Reminders, stored on this device, with an alert when one is due.
 *
 * Honest limits of a web app: there is no push server, so an alert can only appear while Companion
 * is open (in front, or recently in the background). When notifications are allowed, the alert is
 * a real phone notification; otherwise it appears and is spoken inside Companion.
 *
 * Each reminder has a title, optional details, a date and time, an optional repeat, a notification
 * switch and a done state. Done one-off reminders stay in "Past" until removed.
 * Owners: Developer C (store), Developer D (management screen, completion, notifications).
 */
import { describeWhen } from "@/ai/intents/time";

export type Recurrence = "daily" | "weekly";

export interface Reminder {
  id: string;
  /** The title: what to remember, in the person's words. */
  text: string;
  /** Optional extra details ("Dr Patel, bring the blue folder"). */
  description?: string;
  /** ISO time it is next due. */
  at: string;
  recurrence?: Recurrence;
  /** Show a phone notification when due (default true). On-screen and spoken alerts always happen. */
  notify?: boolean;
  createdAt: string;
  /** Set when a one-off reminder is done. Done reminders are shown under "Past". */
  completedAt?: string;
}

export interface ReminderInput {
  text: string;
  at: string;
  recurrence?: Recurrence;
  description?: string;
  notify?: boolean;
}

const KEY = "companion.reminders.v1";
const DAY = 24 * 60 * 60 * 1000;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadReminders(): Reminder[] {
  try {
    const raw = storage()?.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((r): r is Reminder => Boolean(r) && typeof r.id === "string" && typeof r.text === "string" && !Number.isNaN(Date.parse(r.at)))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  } catch {
    return [];
  }
}

function save(list: Reminder[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    /* not remembered, but nothing breaks */
  }
  listeners.forEach((l) => l());
}

export function subscribeReminders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clean(input: ReminderInput): Omit<Reminder, "id" | "createdAt"> {
  const at = Date.parse(input.at);
  if (!input.text.trim() || Number.isNaN(at)) throw new Error("A reminder needs a title and a valid time.");
  return {
    text: input.text.trim().replace(/\s+/g, " ").slice(0, 120),
    at: new Date(at).toISOString(),
    ...(input.recurrence ? { recurrence: input.recurrence } : {}),
    ...(input.description?.trim() ? { description: input.description.trim().slice(0, 300) } : {}),
    notify: input.notify !== false,
  };
}

/**
 * Save a new reminder. Reads it back afterwards and throws if it isn't there, so nobody is ever told
 * "it's saved" when the phone's storage refused it.
 */
export function addReminder(input: ReminderInput, now = new Date()): Reminder {
  const reminder: Reminder = { id: newId(), ...clean(input), createdAt: now.toISOString() };
  save([...loadReminders(), reminder]);
  if (!loadReminders().some((r) => r.id === reminder.id)) throw new Error("The reminder could not be saved on this phone.");
  return reminder;
}

/** Change a reminder. Changing the time of a done reminder makes it upcoming again. */
export function updateReminder(id: string, input: ReminderInput): Reminder | null {
  let updated: Reminder | null = null;
  save(
    loadReminders().map((r) => {
      if (r.id !== id) return r;
      const next: Reminder = { id: r.id, createdAt: r.createdAt, ...clean(input) };
      updated = next;
      return next;
    }),
  );
  return updated;
}

/** Mark as done now. A repeating one moves on to its next time instead. */
export function completeReminder(id: string, now = new Date()): void {
  finishReminder(id, now);
}

export function upcomingReminders(now = new Date()): Reminder[] {
  return loadReminders().filter((r) => !r.completedAt && Date.parse(r.at) > now.getTime());
}

/** Done ones, plus any that were missed (their time passed without being shown). */
export function pastReminders(now = new Date()): Reminder[] {
  return loadReminders()
    .filter((r) => r.completedAt || Date.parse(r.at) <= now.getTime())
    .sort((a, b) => Date.parse(b.completedAt ?? b.at) - Date.parse(a.completedAt ?? a.at));
}

export function removeReminder(id: string): void {
  save(loadReminders().filter((r) => r.id !== id));
}

/** After it has been shown: repeat ones move to their next time, one-off ones are marked done. */
export function finishReminder(id: string, now = new Date()): void {
  const list = loadReminders();
  const r = list.find((x) => x.id === id);
  if (!r) return;
  if (!r.recurrence) return save(list.map((x) => (x.id === id ? { ...x, completedAt: now.toISOString() } : x)));
  const step = r.recurrence === "daily" ? DAY : 7 * DAY;
  let next = Date.parse(r.at);
  while (next <= now.getTime()) next += step;
  save(list.map((x) => (x.id === id ? { ...x, at: new Date(next).toISOString() } : x)));
}

/** Show it again in a few minutes. */
export function snoozeReminder(id: string, minutes = 10, now = new Date()): void {
  save(
    loadReminders().map((x) =>
      x.id === id ? { ...x, at: new Date(now.getTime() + minutes * 60_000).toISOString(), completedAt: undefined } : x,
    ),
  );
}

export function dueReminders(now = new Date()): Reminder[] {
  return loadReminders().filter((r) => !r.completedAt && Date.parse(r.at) <= now.getTime());
}

/** One or two sentences that read well aloud. */
export function describeReminders(which: "next" | "today" | "all", now = new Date(), language = "en-US"): string {
  const upcoming = loadReminders().filter((r) => !r.completedAt && Date.parse(r.at) > now.getTime() - 60_000);
  const say = (r: Reminder) => `${r.text.replace(/^./, (c) => c.toLowerCase())}, ${describeWhen(new Date(r.at), now, language)}`;
  if (!upcoming.length) return "You don't have any reminders set. You can say, for example, remind me to take my pills at 8.";
  if (which === "next") return `Your next reminder is to ${say(upcoming[0])}.`;
  let list = upcoming;
  if (which === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    list = upcoming.filter((r) => Date.parse(r.at) <= end.getTime());
    if (!list.length) return `You have no more reminders today. Your next one is to ${say(upcoming[0])}.`;
  }
  const shown = list.slice(0, 3).map(say);
  const more = list.length > 3 ? ` And ${list.length - 3} more.` : "";
  return `You have ${list.length} reminder${list.length === 1 ? "" : "s"}${which === "today" ? " today" : ""}. ${capitalize(shown.join(". Then "))}.${more}`;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Show a phone notification, through the service worker where there is one (Android Chrome
 * requires that). Returns false if it couldn't be shown.
 */
export async function showSystemNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: "/icon-192.png", badge: "/icon-192.png", requireInteraction: true });
      return true;
    }
    new Notification(title, { body, tag, icon: "/icon-192.png" });
    return true;
  } catch {
    return false;
  }
}
