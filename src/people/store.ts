/**
 * The people Companion can call or message: saved on this device only, by the person.
 *
 * A web app cannot read the phone's address book (iPhone never allows it; Android Chrome only lets
 * the person pick one contact at a time). So Companion keeps its own short list, filled in from
 * Settings > People or from the Android contact picker, with an optional relationship ("daughter")
 * so "call my daughter" finds the right person. It never guesses between two people.
 *
 * Owner: Developer C.
 */

export interface Person {
  id: string;
  name: string;
  /** How the person refers to them: "daughter", "doctor". Lower case. Optional. */
  relationship?: string;
  /** Phone number as typed or picked. */
  phone: string;
}

const KEY = "companion.people.v1";
const listeners = new Set<() => void>();

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadPeople(): Person[] {
  try {
    const raw = storage()?.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (p): p is Person => Boolean(p) && typeof p.id === "string" && typeof p.name === "string" && typeof p.phone === "string",
    );
  } catch {
    return [];
  }
}

function save(list: Person[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the list just won't be remembered */
  }
  listeners.forEach((l) => l());
}

/** Keep digits, a leading +, and the * and # keys. */
export function cleanPhone(phone: string): string {
  const t = phone.trim();
  const plus = t.startsWith("+") ? "+" : "";
  return plus + t.replace(/[^0-9*#]/g, "");
}

export function isPhoneNumber(text: string): boolean {
  return cleanPhone(text).replace(/\D/g, "").length >= 3 && !/[a-z]/i.test(text);
}

export function addPerson(input: { name: string; phone: string; relationship?: string }): Person {
  const person: Person = {
    id: newId(),
    name: input.name.trim().replace(/\s+/g, " ").slice(0, 60),
    phone: input.phone.trim().slice(0, 40),
    ...(input.relationship?.trim() ? { relationship: normalizeWords(input.relationship).slice(0, 40) } : {}),
  };
  save([...loadPeople(), person]);
  return person;
}

export function removePerson(id: string): void {
  save(loadPeople().filter((p) => p.id !== id));
}

export function subscribePeople(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Words that mean the same relationship. */
const SAME: Record<string, string> = {
  mom: "mother", mum: "mother", mummy: "mother", mommy: "mother", ma: "mother",
  dad: "father", daddy: "father", pa: "father",
  grandma: "grandmother", granny: "grandmother", nan: "grandmother", nana: "grandmother",
  grandpa: "grandfather", grandad: "grandfather", granddad: "grandfather",
  neighbor: "neighbour", gp: "doctor", "my doctor": "doctor",
  hubby: "husband", missus: "wife", carer: "caregiver",
};

export function normalizeWords(s: string): string {
  const t = s.toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, " ").replace(/\s+/g, " ").trim().replace(/^(?:my|our|the) /, "");
  return SAME[t] ?? t;
}

/**
 * Everyone who matches what the person said: a relationship, a full name, or a first name.
 * Exact matches win, so "Anna" never also matches "Annabel".
 */
export function findPeople(said: string, people: Person[] = loadPeople()): Person[] {
  const want = normalizeWords(said);
  if (!want) return [];
  const byRelationship = people.filter((p) => p.relationship && normalizeWords(p.relationship) === want);
  if (byRelationship.length) return byRelationship;
  const byName = people.filter((p) => p.name.toLowerCase() === want);
  if (byName.length) return byName;
  return people.filter((p) => p.name.toLowerCase().split(" ")[0] === want);
}
