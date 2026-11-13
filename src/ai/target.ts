/**
 * "Tap here" circles and family notes: checks for what the AI sends back with a reply.
 *
 * The AI is untrusted. A box is kept only if it is four numbers on the 0-1000 scale Gemini uses
 * ([ymin, xmin, ymax, xmax], as thousandths of the photo's height and width), the right way round,
 * and smaller than the whole photo. Anything else is dropped, and the reply is shown without a ring.
 *
 * Used on the server (before answering) and again on the phone (before drawing).
 */

import type { DocumentInfo, PointAt, ScamCheck, ScamVerdict, StepCheck } from "@/contracts";
import { cleanString } from "./intents/schema";

/** A box covering nearly all of the photo points at nothing in particular. */
const MAX_SIDE = 950;
const MIN_SIDE = 4;
/** Smaller than this (in thousandths squared, i.e. 0.01% of the photo) is a speck, not a button. */
const MIN_AREA = 100;

/**
 * A ring the person can trust. Dropped when the model says it isn't sure (`confidence: "low"`),
 * when the label is missing, or when the box is malformed, back to front, a speck or the whole photo.
 */
export function cleanTarget(value: unknown): PointAt | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { label?: unknown; box?: unknown; confidence?: unknown };
  if (v.confidence === "low") return null;
  const label = cleanString(v.label, 60);
  if (!label || !Array.isArray(v.box) || v.box.length !== 4) return null;
  const nums = v.box.map((n) => (typeof n === "string" ? Number(n) : n));
  if (!nums.every((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000)) return null;
  const [ymin, xmin, ymax, xmax] = nums.map((n) => Math.round(n));
  const h = ymax - ymin;
  const w = xmax - xmin;
  if (h < MIN_SIDE || w < MIN_SIDE || h * w < MIN_AREA) return null;
  if (h > MAX_SIDE && w > MAX_SIDE) return null;
  return { label, box: [ymin, xmin, ymax, xmax] };
}

/** A short note for a family member. Plain words only: no links, and no long digit runs (codes, cards). */
export function cleanFamilyNote(value: unknown): string | null {
  const note = cleanString(value, 400);
  if (!note) return null;
  if (/https?:\/\/|www\./i.test(note)) return null;
  if (/\d[\d\s-]{5,}\d/.test(note)) return null;
  return note;
}

const VERDICTS: readonly ScamVerdict[] = ["scam", "suspicious", "safe", "unsure"];

/** A scam verdict with up to 4 short plain reasons. Reasons never carry links or long numbers. */
export function cleanScam(verdict: unknown, reasons: unknown): ScamCheck | null {
  const v = VERDICTS.find((x) => x === verdict);
  if (!v) return null;
  const list = Array.isArray(reasons)
    ? reasons
        .map((r) => cleanString(r, 160))
        .filter((r): r is string => Boolean(r) && !/https?:\/\/|www\./i.test(r!) && !/\d[\d\s-]{7,}\d/.test(r!))
        .slice(0, 4)
    : [];
  return { verdict: v, reasons: list };
}

export function cleanStepCheck(value: unknown): StepCheck | null {
  return value === "done" || value === "not-yet" || value === "unsure" ? value : null;
}

/** What was read from a bill or letter. Each field is kept only when it looks like what it claims to be. */
export function cleanDocument(value: unknown): DocumentInfo | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const organization = cleanString(v.organization, 80) ?? undefined;
  const amountRaw = cleanString(v.amount, 30);
  const amount = amountRaw && /\d/.test(amountRaw) && /^[^\d]{0,4}[\d.,\s]+[^\d]{0,4}$/.test(amountRaw) ? amountRaw : undefined;
  const dueRaw = cleanString(v.dueDate, 10);
  const dueDate = dueRaw && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) && !Number.isNaN(Date.parse(`${dueRaw}T12:00:00`)) ? dueRaw : undefined;
  const reference = cleanString(v.reference, 40) ?? undefined;
  const summary = cleanString(v.summary, 300) ?? undefined;
  const unclear = Array.isArray(v.unclear)
    ? v.unclear.map((u) => cleanString(u, 40)).filter((u): u is string => Boolean(u)).slice(0, 5)
    : [];
  if (!organization && !amount && !dueDate && !summary) return null;
  return {
    ...(organization ? { organization } : {}),
    ...(amount ? { amount } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(reference ? { reference } : {}),
    ...(summary ? { summary } : {}),
    unclear,
  };
}
