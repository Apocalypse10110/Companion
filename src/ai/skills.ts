/**
 * What the person has learned to do. Kept on this phone only.
 *
 * Each time Companion finishes teaching a task ("connect to wifi"), it is recorded here. The list is
 * sent with each request so the AI can step back: the first time it gives the exact step, the next
 * time it asks the person to try first and offers a hint. Help fades as they become independent.
 */

export interface Skill {
  /** Lower-case short name, e.g. "connect to wifi". */
  name: string;
  times: number;
  firstLearned: string;
  lastDone: string;
}

const KEY = "companion.skills.v1";
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSkills(): Skill[] {
  try {
    const raw = storage()?.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((s): s is Skill => Boolean(s) && typeof s.name === "string" && typeof s.times === "number")
      .sort((a, b) => Date.parse(b.lastDone) - Date.parse(a.lastDone));
  } catch {
    return [];
  }
}

function save(list: Skill[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    /* not remembered; nothing breaks */
  }
  listeners.forEach((l) => l());
}

export function subscribeSkills(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Record that the person finished a task. Returns the updated skill. */
export function recordSkill(name: string, now = new Date()): Skill | null {
  const clean = name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  if (!clean || !/^[\p{L} '-]+$/u.test(clean)) return null;
  const list = loadSkills();
  const found = list.find((s) => s.name === clean);
  const at = now.toISOString();
  const skill: Skill = found ? { ...found, times: found.times + 1, lastDone: at } : { name: clean, times: 1, firstLearned: at, lastDone: at };
  save([skill, ...list.filter((s) => s.name !== clean)]);
  return skill;
}

export function forgetSkill(name: string): void {
  save(loadSkills().filter((s) => s.name !== name));
}

export function forgetAllSkills(): void {
  save([]);
}

/** What the AI is told: "connect to wifi (2 times)". */
export function skillsForPrompt(limit = 20): string[] {
  return loadSkills()
    .slice(0, limit)
    .map((s) => `${s.name} (${s.times === 1 ? "once" : `${s.times} times`})`);
}
