/**
 * Scam Bait: "Doris", a chatty, muddled, endlessly polite persona who keeps a scammer busy so
 * they waste their time on her instead of on someone who might fall for it.
 * Inspired by O2's "Daisy" (2024), which did the same for phone calls.
 *
 * Shared by the server (checks the AI's line) and the phone (the lines used when there's no AI).
 * Doris never gives anything real: no numbers, codes, links, addresses or emails, checked here.
 */

export type BaitFrom = "scammer" | "doris";

export interface BaitTurn {
  from: BaitFrom;
  text: string;
}

export const BAIT_NAME = "Doris";
export const MAX_TURNS = 40;
export const MAX_TURN_CHARS = 600;

/** Used when no AI is connected (or it fails), so a demo never stalls. Every one of them stalls. */
export const STALL_LINES: readonly string[] = [
  "Oh hello dear, is this about my parcel? I have been waiting for the knitting wool. Hold on, I need to find my glasses.",
  "Sorry love, my grandson set this phone up and the letters are ever so small. What was it you needed?",
  "I've found my glasses but now the cat is sitting on my handbag. Do you have a cat? Mine is called Mr Biscuits.",
  "You'll have to bear with me, I'm typing with one finger. Is it the blue card or the gold one? I have so many cards from the grandchildren.",
  "My neighbour Pat says I shouldn't tap links. Can you post it to me instead? Second class is fine, I'm not in a hurry.",
  "Oh dear, the kettle's whistling. Don't go anywhere. Is it a long number? I'll need a pencil, and a sit down.",
  "I've written it on the back of an envelope but I think I've written it on the gas bill. Can you say it again, slowly?",
  "My daughter rings on Sundays, I could ask her. Is it Sunday? I lose track since I retired from the post office.",
  "Now which button is the 'confirm' one? Mine has a little picture of a house. Is that the right one?",
  "I pressed something and now the phone is talking to me in French. Hang on, dear.",
];

/** The next fallback line: walks the list in order so the conversation feels like it moves on. */
export function stallLine(thread: BaitTurn[]): string {
  const used = thread.filter((t) => t.from === "doris").length;
  return STALL_LINES[used % STALL_LINES.length];
}

/**
 * Is this line safe to show as Doris? No links, emails, long numbers (phone, card, code), or
 * anything that reads like real personal detail. A failed check means a stall line is used instead.
 */
export function isSafeBaitLine(text: string): boolean {
  if (!text.trim() || text.length > 400) return false;
  if (/https?:\/\/|www\.|\.(?:com|net|org|co|uk|io|ly)\b/i.test(text)) return false;
  if (/\S+@\S+\.\S+/.test(text)) return false;
  // Any run of 4 or more digits, even spaced or dashed, could be a real number or code.
  if (/\d(?:[\s-]?\d){3,}/.test(text)) return false;
  if (/\b(?:pin|password|passcode|sort code|cvv|security code)\s*(?:is|:)/i.test(text)) return false;
  return true;
}

/** Tidy an untrusted thread from a request. Returns null if there's nothing to answer. */
export function parseThread(value: unknown): BaitTurn[] | null {
  if (!Array.isArray(value)) return null;
  const out: BaitTurn[] = [];
  for (const t of value.slice(-MAX_TURNS)) {
    if (!t || typeof t !== "object") continue;
    const from = (t as BaitTurn).from;
    const raw = (t as BaitTurn).text;
    if ((from !== "scammer" && from !== "doris") || typeof raw !== "string") continue;
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TURN_CHARS);
    if (text) out.push({ from, text });
  }
  if (!out.length || out[out.length - 1].from !== "scammer") return null;
  return out;
}

/** "Kept them busy 14 minutes": from the scammer's first message to their last. */
export function busyMinutes(times: number[]): number {
  if (times.length < 2) return 0;
  return Math.max(0, Math.round((Math.max(...times) - Math.min(...times)) / 60_000));
}
