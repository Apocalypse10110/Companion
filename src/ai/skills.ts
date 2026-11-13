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
  /** Times the task was finished (with or without help). */
  times: number;
  /** Times it was finished without asking to be told exactly. Older records have none. */
  independent?: number;
  /** Times a lesson on it was started. */
  attempts?: number;
  /** First time it was finished, or started if never finished. */
  firstLearned: string;
  /** Last time it was finished (or started, if never finished). */
  lastDone: string;
}

/**
 * How much help Companion gives for a skill. Help fades as the level rises, but never goes away:
 * the person can always ask "Tell me exactly".
 *   1 learning: full guidance, visual targets and why.  2: shorter steps.
 *   3 practising: "Do you remember where to find that?" first.  4 nearly there: try the whole task, then check.
 *   5 learned: done on their own 3 times.
 */
export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export function skillLevel(s: Pick<Skill, "times" | "independent">): SkillLevel {
  const independent = s.independent ?? 0;
  if (s.times <= 0) return 1;
  if (independent >= 3) return 5;
  if (independent >= 1) return 4;
  return s.times === 1 ? 2 : 3;
}

export const LEVEL_NAMES: Record<SkillLevel, string> = {
  1: "Learning",
  2: "Practising",
  3: "Practising",
  4: "Nearly there",
  5: "Learned",
};

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

function cleanName(name: string): string | null {
  const clean = name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  return clean && /^[\p{L} '-]+$/u.test(clean) ? clean : null;
}

/**
 * Record that the person finished a task. `independent`: they did it without asking to be told
 * exactly (only counts once they've learned it before). Returns the updated skill.
 */
export function recordSkill(name: string, now = new Date(), independent = false): Skill | null {
  const clean = cleanName(name);
  if (!clean) return null;
  const list = loadSkills();
  const found = list.find((s) => s.name === clean);
  const at = now.toISOString();
  const skill: Skill = found
    ? {
        ...found,
        times: found.times + 1,
        independent: (found.independent ?? 0) + (independent && found.times > 0 ? 1 : 0),
        attempts: Math.max(found.attempts ?? 0, found.times + 1),
        lastDone: at,
      }
    : { name: clean, times: 1, independent: 0, attempts: 1, firstLearned: at, lastDone: at };
  save([skill, ...list.filter((s) => s.name !== clean)]);
  return skill;
}

/** Record that a lesson on a task was started (an attempt). Never lowers anything. */
export function recordAttempt(name: string, now = new Date()): Skill | null {
  const clean = cleanName(name);
  if (!clean) return null;
  const list = loadSkills();
  const found = list.find((s) => s.name === clean);
  const at = now.toISOString();
  const skill: Skill = found
    ? { ...found, attempts: (found.attempts ?? found.times) + 1 }
    : { name: clean, times: 0, independent: 0, attempts: 1, firstLearned: at, lastDone: at };
  save([skill, ...list.filter((s) => s.name !== clean)]);
  return skill;
}

export function forgetSkill(name: string): void {
  save(loadSkills().filter((s) => s.name !== name));
}

export function forgetAllSkills(): void {
  save([]);
}

/** What the AI is told: "connect to wifi (level 3, done 2 times)". Only tasks finished at least once. */
export function skillsForPrompt(limit = 20): string[] {
  return loadSkills()
    .filter((s) => s.times > 0)
    .slice(0, limit)
    .map((s) => `${s.name} (level ${skillLevel(s)}, done ${s.times === 1 ? "once" : `${s.times} times`})`);
}
