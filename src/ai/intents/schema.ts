/**
 * The structured intents the assistant understands, and the validator every intent
 * passes through before it can become an action. Both the local rules and any AI model
 * produce raw intents; only `validateIntent` turns them into trusted `Intent`s.
 *
 * Owner: Developer B.
 */

export const INTENT_NAMES = [
  "CALL_CONTACT",
  "SEND_MESSAGE",
  "READ_MESSAGES",
  "OPEN_APPLICATION",
  "CHANGE_ACCESSIBILITY",
  "CREATE_REMINDER",
  "LIST_REMINDERS",
  "CHECK_WEATHER",
  "READ_TIME",
  "FIND_INFORMATION",
  "HELP",
  "CONFIRM",
  "DENY",
  "UNKNOWN",
] as const;

export type IntentName = (typeof INTENT_NAMES)[number];

/** Apps the assistant may ask to open. Anything else is refused. */
export const APPS = ["photos", "camera", "phone", "messages", "calendar", "clock", "settings", "maps", "contacts", "email", "browser"] as const;
export type AppName = (typeof APPS)[number];

/** Settings the assistant may ask to change, and the values each accepts. Mirrors `src/ui/settings/types.ts`. */
export const ACCESSIBILITY_SETTINGS = {
  textSize: ["increase", "decrease", "standard", "large", "larger", "largest"],
  highContrast: ["on", "off"],
  theme: ["light", "dark", "system"],
  boldText: ["on", "off"],
  motion: ["reduce", "full"],
  extraLargeButtons: ["on", "off"],
  speechRate: ["slower", "faster", "normal"],
  volume: ["louder", "quieter"],
  speakReplies: ["on", "off"],
} as const satisfies Record<string, readonly string[]>;
export type AccessibilitySetting = keyof typeof ACCESSIBILITY_SETTINGS;

export const REMINDER_LISTS = ["next", "today", "all"] as const;
export const RECURRENCES = ["daily", "weekly"] as const;

export interface IntentParams {
  /** A name ("Emma") or a relationship ("daughter") exactly as the person said it. */
  contact?: string;
  /** Message text. */
  body?: string;
  app?: AppName;
  /** For maps: where to. */
  destination?: string;
  setting?: AccessibilitySetting;
  value?: string;
  /** Reminder text, in the person's own words. */
  text?: string;
  /** Reminder time as an ISO 8601 string. */
  at?: string;
  /** The time words the person used, before parsing ("at 8"). */
  when?: string;
  recurrence?: (typeof RECURRENCES)[number];
  which?: (typeof REMINDER_LISTS)[number];
  /** READ_TIME: "time" or "date". */
  what?: "time" | "date";
  /** FIND_INFORMATION / HELP: what they asked about. */
  query?: string;
  topic?: string;
}

export interface Intent {
  name: IntentName;
  params: IntentParams;
}

const SHORT = 120;
const LONG = 500;

/** Trim, drop control characters, collapse spaces, cap length. Returns undefined for empty or non-strings. */
export function cleanString(value: unknown, max = SHORT): string | undefined {
  if (typeof value !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max).trim() : s;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function isValidIso(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

/**
 * Turn anything (local rules output, or untrusted JSON from an AI model) into a safe Intent.
 * Unknown intent names, unknown fields and out-of-range values are dropped.
 * Returns null when the input is not an intent at all.
 */
export function validateIntent(raw: unknown): Intent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = oneOf(r.name ?? r.intent, INTENT_NAMES);
  if (!name) return null;
  const p = (r.params && typeof r.params === "object" ? r.params : r.parameters && typeof r.parameters === "object" ? r.parameters : {}) as Record<string, unknown>;
  const params: IntentParams = {};

  switch (name) {
    case "CALL_CONTACT":
      params.contact = cleanString(p.contact, 60);
      break;
    case "SEND_MESSAGE":
      params.contact = cleanString(p.contact, 60);
      params.body = cleanString(p.body, LONG);
      break;
    case "OPEN_APPLICATION": {
      const app = oneOf(p.app, APPS);
      if (!app) return { name: "UNKNOWN", params: { query: cleanString(p.app, 60) } };
      params.app = app;
      if (app === "maps") params.destination = cleanString(p.destination, SHORT);
      break;
    }
    case "CHANGE_ACCESSIBILITY": {
      const setting = oneOf(p.setting, Object.keys(ACCESSIBILITY_SETTINGS) as AccessibilitySetting[]);
      const value = setting ? oneOf(p.value, ACCESSIBILITY_SETTINGS[setting] as readonly string[]) : undefined;
      if (!setting || !value) return { name: "UNKNOWN", params: {} };
      params.setting = setting;
      params.value = value;
      break;
    }
    case "CREATE_REMINDER":
      params.text = cleanString(p.text, SHORT);
      params.when = cleanString(p.when, 60);
      if (isValidIso(p.at)) params.at = new Date(p.at).toISOString();
      params.recurrence = oneOf(p.recurrence, RECURRENCES);
      break;
    case "LIST_REMINDERS":
      params.which = oneOf(p.which, REMINDER_LISTS) ?? "next";
      break;
    case "READ_TIME":
      params.what = oneOf(p.what, ["time", "date"] as const) ?? "time";
      break;
    case "FIND_INFORMATION":
      params.query = cleanString(p.query, LONG);
      break;
    case "HELP":
      params.topic = cleanString(p.topic, SHORT);
      break;
    default:
      break;
  }

  // Drop undefined keys so intents compare cleanly.
  for (const k of Object.keys(params) as Array<keyof IntentParams>) if (params[k] === undefined) delete params[k];
  return { name, params };
}
