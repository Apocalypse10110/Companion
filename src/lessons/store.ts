/**
 * Saved lessons ("Fridge Cards"). Kept on this phone only, as text. A lesson is the plain steps
 * of a task the person finished with Companion, so they can print it and do it again without the app.
 */

export interface Lesson {
  id: string;
  /** The skill it teaches, lower case ("connect to wifi"). */
  skill: string;
  /** "How to connect to Wi-Fi". */
  title: string;
  steps: string[];
  /** "If it doesn't work" tips. */
  troubleshooting: string[];
  createdAt: string;
}

const KEY = "companion.lessons.v1";
const MAX = 30;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const isText = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;

export function cleanLesson(value: unknown): Omit<Lesson, "id" | "createdAt" | "skill"> | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { title?: unknown; steps?: unknown; troubleshooting?: unknown };
  const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
  if (!isText(v.title) || !Array.isArray(v.steps)) return null;
  const steps = v.steps.filter(isText).map((s) => clip(s, 200)).slice(0, 10);
  if (steps.length === 0) return null;
  const troubleshooting = Array.isArray(v.troubleshooting) ? v.troubleshooting.filter(isText).map((s) => clip(s, 200)).slice(0, 4) : [];
  return { title: clip(v.title, 80), steps, troubleshooting };
}

export function loadLessons(): Lesson[] {
  try {
    const raw = storage()?.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((l): l is Lesson => Boolean(l) && isText(l.id) && isText(l.title) && Array.isArray(l.steps));
  } catch {
    return [];
  }
}

function save(list: Lesson[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* not saved; the card can still be printed now */
  }
  listeners.forEach((l) => l());
}

export function subscribeLessons(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Save a lesson. A newer lesson for the same skill replaces the older one. */
export function saveLesson(input: Omit<Lesson, "id" | "createdAt">, now = new Date()): Lesson {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `l-${now.getTime().toString(36)}`;
  const lesson: Lesson = { ...input, id, createdAt: now.toISOString() };
  save([lesson, ...loadLessons().filter((l) => l.skill !== input.skill)]);
  return lesson;
}

export function getLesson(id: string): Lesson | null {
  return loadLessons().find((l) => l.id === id) ?? null;
}

export function lessonForSkill(skill: string): Lesson | null {
  return loadLessons().find((l) => l.skill === skill) ?? null;
}

export function removeLesson(id: string): void {
  save(loadLessons().filter((l) => l.id !== id));
}

export function forgetAllLessons(): void {
  save([]);
}
