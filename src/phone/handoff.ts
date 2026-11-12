/**
 * Coming back after a call. When Companion hands over to the phone app or Messages, it notes who,
 * which conversation and which screen. When the person returns (even if the phone reloaded
 * Companion in the meantime), the conversation is put back and Companion offers to carry on.
 *
 * A web app can't bring itself back to the front when a call ends; the person returns by switching
 * back (iPhone: swipe up, or the "back to Safari/Companion" link; Android: the Back or Recents button).
 * Owner: Developer D.
 */

export interface Handoff {
  kind: "call" | "message";
  /** Who it was for, as shown to the person ("Anna", "your daughter"). */
  name: string;
  at: number;
  /** Filled in by the app when the page is left. */
  conversationId?: string;
  path?: string;
  leftAt?: number;
}

const KEY = "companion.handoff.v1";
/** Leaving must happen soon after the hand-off to count (a desktop browser may do nothing at all). */
const LEAVE_WINDOW_MS = 20_000;
/** Older than this, a hand-off is forgotten. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

function read(): Handoff | null {
  try {
    const raw = localStorage.getItem(KEY);
    const h = raw ? (JSON.parse(raw) as Handoff) : null;
    if (!h || typeof h.at !== "number" || Date.now() - h.at > MAX_AGE_MS) {
      if (raw) localStorage.removeItem(KEY);
      return null;
    }
    return h;
  } catch {
    return null;
  }
}

function write(h: Handoff | null): void {
  try {
    if (h) localStorage.setItem(KEY, JSON.stringify(h));
    else localStorage.removeItem(KEY);
  } catch {
    /* without storage, coming back still works while the page stays in memory */
  }
}

/** Called by the ActionService just before opening the dialer or Messages. */
export function recordHandoff(kind: Handoff["kind"], name: string): void {
  write({ kind, name, at: Date.now() });
}

/** The page is being left: remember where we were, if a hand-off just happened. */
export function markLeft(conversationId: string, path: string): void {
  const h = read();
  if (!h || h.leftAt || Date.now() - h.at > LEAVE_WINDOW_MS) return;
  write({ ...h, conversationId, path, leftAt: Date.now() });
}

/**
 * The person is back. Returns the hand-off to resume (once), or null.
 * `minAwayMs` ignores a flicker when switching back; after a reload there's no flicker, so use 0.
 */
export function takeReturn(minAwayMs = 1500): Handoff | null {
  const h = read();
  if (!h?.leftAt) return null;
  if (Date.now() - h.leftAt < minAwayMs) return null;
  write(null);
  return h;
}

export function welcomeBackText(h: Handoff): string {
  return h.kind === "call"
    ? `Welcome back. I hope your call with ${h.name} went well. We can carry on where we left off, or tell me what you need next.`
    : `Welcome back. I hope your message to ${h.name} went well. We can carry on where we left off, or tell me what you need next.`;
}
