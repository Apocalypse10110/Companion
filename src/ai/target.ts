/**
 * "Tap here" circles and family notes: checks for what the AI sends back with a reply.
 *
 * The AI is untrusted. A box is kept only if it is four numbers on the 0-1000 scale Gemini uses
 * ([ymin, xmin, ymax, xmax], as thousandths of the photo's height and width), the right way round,
 * and smaller than the whole photo. Anything else is dropped, and the reply is shown without a ring.
 *
 * Used on the server (before answering) and again on the phone (before drawing).
 */

import type { PointAt } from "@/contracts";
import { cleanString } from "./intents/schema";

/** A box covering nearly all of the photo points at nothing in particular. */
const MAX_SIDE = 950;
const MIN_SIDE = 4;

export function cleanTarget(value: unknown): PointAt | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { label?: unknown; box?: unknown };
  const label = cleanString(v.label, 60);
  if (!label || !Array.isArray(v.box) || v.box.length !== 4) return null;
  const nums = v.box.map((n) => (typeof n === "string" ? Number(n) : n));
  if (!nums.every((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000)) return null;
  const [ymin, xmin, ymax, xmax] = nums.map((n) => Math.round(n));
  const h = ymax - ymin;
  const w = xmax - xmin;
  if (h < MIN_SIDE || w < MIN_SIDE) return null;
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
