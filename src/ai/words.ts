/**
 * Small helpers that make replies read naturally: "your daughter", "Emma", "take your pills".
 * Owner: Developer B.
 */

import type { AppName } from "./intents/schema";

const RELATIONSHIPS = new Set([
  "daughter", "son", "wife", "husband", "partner", "mother", "mum", "mom", "mummy", "mommy", "father", "dad", "daddy",
  "sister", "brother", "grandson", "granddaughter", "grandchild", "grandma", "grandpa", "granny", "nan", "nana", "grandad",
  "grandmother", "grandfather", "niece", "nephew", "aunt", "auntie", "uncle", "cousin", "neighbour", "neighbor", "friend",
  "best friend", "carer", "caregiver", "nurse", "doctor", "gp", "dentist", "pharmacy", "pharmacist", "boss", "landlord",
  "son-in-law", "daughter-in-law", "stepson", "stepdaughter", "children", "kids", "family", "girlfriend", "boyfriend",
]);

export function isRelationship(contact: string): boolean {
  const c = contact.toLowerCase().replace(/^(?:my|our|the) /, "");
  return RELATIONSHIPS.has(c) || /^(?:eldest|youngest|oldest|other|older|younger) /.test(c);
}

/** How to say a contact back: "your daughter", "Emma Smith". */
export function contactLabel(contact: string): string {
  const c = contact.trim();
  if (isRelationship(c)) return `your ${c.toLowerCase().replace(/^(?:my|our|the) /, "")}`;
  return c
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** "Your daughter" at the start of a sentence or title. */
export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Turn the person's words around so we can say them back: "take my pills" -> "take your pills". */
export function yourify(s: string): string {
  return s
    .replace(/\bmy\b/gi, "your")
    .replace(/\bmine\b/gi, "yours")
    .replace(/\bmyself\b/gi, "yourself")
    .replace(/\bi am\b/gi, "you are")
    .replace(/\bi'm\b/gi, "you're")
    .replace(/\bme\b/gi, "you");
}

/**
 * Rules work on lowercased text. Find the same words in what the person actually said,
 * so names and capitals survive ("i'll be home soon" -> "I'll be home soon").
 */
export function recoverCase(original: string, fragment: string): string {
  const flat = original.replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(fragment.toLowerCase());
  const found = i >= 0 ? flat.slice(i, i + fragment.length) : fragment;
  // Capitalise a lone "i" and the first letter.
  return capitalize(found.replace(/\bi\b/g, "I").replace(/\bi'(m|ll|d|ve)\b/g, "I'$1"));
}

export const APP_LABELS: Record<AppName, string> = {
  photos: "Photos",
  camera: "Camera",
  phone: "Phone",
  messages: "Messages",
  calendar: "Calendar",
  clock: "Clock",
  settings: "Settings",
  maps: "Maps",
  contacts: "Contacts",
  email: "Email",
  browser: "the web browser",
};

/**
 * Apps a web app can actually open with a link (tel:, sms:, mailto:, map and web links).
 * Any other app can't be launched from a browser, so the assistant explains how to find it instead.
 */
export const OPENABLE_APPS: ReadonlySet<AppName> = new Set<AppName>(["phone", "messages", "email", "maps", "browser"]);

/** How to find an app the assistant can't open itself. Plain words, what it looks like. */
export const APP_GUIDANCE: Partial<Record<AppName, string>> = {
  photos:
    "I can't open Photos from here, but here's how. Go to your home screen and tap Photos. On an iPhone it's a colourful flower. On Android it may be called Gallery or Google Photos.",
  camera:
    "I can't open the Camera from here, but here's how. Go to your home screen and tap Camera. It looks like a small camera. On many phones you can also swipe left on the lock screen.",
  settings:
    "I can't open Settings from here, but here's how. Go to your home screen and look for a grey gear, called Settings. Tap it once. Tell me what you want to change and I'll guide you.",
  clock:
    "I can't open the Clock from here, but here's how. Go to your home screen and tap Clock. It looks like a clock face. That's where alarms and timers are.",
  calendar:
    "I can't open your Calendar from here, but here's how. Go to your home screen and tap Calendar. It usually shows today's date. I can also set a reminder for you.",
  contacts:
    "I can't open Contacts from here, but here's how. Open your Phone app, the green one with a phone handset, and tap Contacts at the bottom.",
};

export const SETTING_TITLES: Record<string, string> = {
  "textSize:increase": "Make the text bigger",
  "textSize:decrease": "Make the text smaller",
  "textSize:standard": "Use standard text size",
  "textSize:large": "Use large text",
  "textSize:larger": "Use larger text",
  "textSize:largest": "Use the largest text",
  "highContrast:on": "Turn on high contrast",
  "highContrast:off": "Turn off high contrast",
  "theme:dark": "Switch to dark mode",
  "theme:light": "Switch to light mode",
  "theme:system": "Match the phone's light or dark setting",
  "boldText:on": "Make the text bold",
  "boldText:off": "Stop using bold text",
  "motion:reduce": "Reduce movement on screen",
  "motion:full": "Turn animations back on",
  "extraLargeButtons:on": "Make the buttons extra large",
  "extraLargeButtons:off": "Use normal-sized buttons",
  "speechRate:slower": "Speak more slowly",
  "speechRate:faster": "Speak a little faster",
  "speechRate:normal": "Speak at normal speed",
  "volume:louder": "Speak louder",
  "volume:quieter": "Speak more quietly",
  "speakReplies:on": "Read my answers out loud",
  "speakReplies:off": "Stop reading answers out loud",
};
