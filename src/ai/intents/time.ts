/**
 * Understands the everyday ways people say when ("at 8", "tomorrow at 3pm", "in 20 minutes",
 * "every day at 9") and turns them into a real date. Runs on the device, no AI needed.
 *
 * Owner: Developer B.
 */

export interface ParsedWhen {
  at: Date;
  recurrence?: "daily" | "weekly";
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty-five": 45, fifty: 50,
  a: 1, an: 1, half: 30,
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function num(word: string): number | undefined {
  if (/^\d+$/.test(word)) return Number(word);
  return WORD_NUMBERS[word];
}

function atTime(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Matches the words that say when. Exported so the rules can cut them out of the reminder text. */
export const WHEN_PATTERN = new RegExp(
  [
    String.raw`\b(?:every ?day|daily|each day|every (?:morning|evening|night)|every (?:${WEEKDAYS.join("|")}))\b`,
    String.raw`\bin (?:an?|half an|\d+|${Object.keys(WORD_NUMBERS).join("|")}) (?:minutes?|mins?|hours?|hrs?)\b`,
    String.raw`\b(?:today|tonight|tomorrow|this (?:morning|afternoon|evening)|(?:on |next )?(?:${WEEKDAYS.join("|")}))\b`,
    String.raw`\b(?:at|by|around) (?:noon|midday|midnight|\d{1,2}(?::\d{2})?(?: ?[ap]\.?m\.?)?|(?:${Object.keys(WORD_NUMBERS).join("|")})(?: o'?clock)?)(?: in the (?:morning|afternoon|evening)| at night)?\b`,
    String.raw`\b\d{1,2}(?::\d{2})? ?[ap]\.?m\.?\b`,
    String.raw`\b(?:in the (?:morning|afternoon|evening)|at night)\b`,
  ].join("|"),
  "gi",
);

/**
 * Parse when. Returns null if there is no time information at all.
 * A bare hour ("at 8") means the next time the clock shows 8, so "at 8" said at 9 am means 8 pm.
 */
export function parseWhen(input: string, now: Date = new Date()): ParsedWhen | null {
  const s = input.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;

  let recurrence: ParsedWhen["recurrence"];
  if (/\b(every ?day|daily|each day|every (morning|evening|night))\b/.test(s)) recurrence = "daily";
  const everyWeekday = s.match(new RegExp(`\\bevery (${WEEKDAYS.join("|")})\\b`));
  if (everyWeekday) recurrence = "weekly";

  // Relative: "in 20 minutes", "in an hour", "in half an hour".
  const rel = s.match(/\bin (an?|half an|\d+|[a-z-]+) (minutes?|mins?|hours?|hrs?)\b/);
  if (rel) {
    const unitIsHour = rel[2].startsWith("h");
    let amount = rel[1] === "half an" ? 30 : num(rel[1]);
    if (amount !== undefined) {
      if (rel[1] === "half an") return { at: new Date(now.getTime() + 30 * 60_000) };
      amount = unitIsHour ? amount * 60 : amount;
      return { at: new Date(now.getTime() + amount * 60_000) };
    }
  }

  // Which day.
  let day: Date | null = null;
  let dayExplicit = false;
  if (/\btomorrow\b/.test(s)) {
    day = addDays(now, 1);
    dayExplicit = true;
  } else if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(s)) {
    day = new Date(now);
    dayExplicit = true;
  } else {
    const wd = s.match(new RegExp(`\\b(?:on |next |every )?(${WEEKDAYS.join("|")})\\b`));
    if (wd) {
      const target = WEEKDAYS.indexOf(wd[1]);
      let diff = (target - now.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      day = addDays(now, diff);
      dayExplicit = true;
    }
  }

  // Part of day.
  const evening = /\b(tonight|evening|at night|this evening|in the evening)\b/.test(s);
  const afternoon = /\b(afternoon|in the afternoon)\b/.test(s);
  const morning = /\b(morning|in the morning)\b/.test(s);

  // Clock time.
  let hours: number | undefined;
  let minutes = 0;
  let meridiem: "am" | "pm" | undefined;
  if (/\b(noon|midday)\b/.test(s)) hours = 12;
  else if (/\bmidnight\b/.test(s)) hours = 0;
  else {
    const t =
      s.match(/\b(\d{1,2})(?::(\d{2}))? ?([ap])m\b/) ??
      s.match(/\b(?:at|by|around) (\d{1,2})(?::(\d{2}))?(?: ?([ap])m)?\b/) ??
      s.match(new RegExp(`\\b(?:at|by|around) (${Object.keys(WORD_NUMBERS).join("|")})(?: o'?clock)?()()\\b`));
    if (t) {
      const h = num(t[1]);
      if (h !== undefined && h <= 23) {
        hours = h;
        minutes = t[2] ? Math.min(59, Number(t[2])) : 0;
        if (t[3]) meridiem = t[3] === "a" ? "am" : "pm";
      }
    }
  }

  if (hours === undefined) {
    if (!day && !morning && !afternoon && !evening && !recurrence) return null;
    // A day with no time: pick a sensible default.
    hours = morning ? 9 : afternoon ? 14 : evening ? 19 : 9;
    const base = day ?? now;
    let at = atTime(base, hours, 0);
    if (!dayExplicit && at <= now) at = addDays(at, 1);
    if (dayExplicit && at <= now) at = atTime(addDays(now, 0), now.getHours() + 1, 0);
    return { at, recurrence };
  }

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (!meridiem && hours >= 1 && hours <= 12) {
    if (evening || afternoon) {
      if (hours < 12) hours += 12;
    } else if (morning) {
      if (hours === 12) hours = 0;
    } else if (dayExplicit) {
      // "tomorrow at 3" most likely means the afternoon; "tomorrow at 8" the morning.
      if (hours <= 6) hours += 12;
    } else {
      // Next time the clock shows this hour.
      const am = atTime(now, hours % 12, minutes);
      const pm = atTime(now, (hours % 12) + 12, minutes);
      const candidates = [am, pm, addDays(am, 1)].filter((d) => d > now);
      return { at: candidates[0], recurrence };
    }
  }

  let at = atTime(day ?? now, hours, minutes);
  if (!dayExplicit && at <= now) at = addDays(at, 1);
  return { at, recurrence };
}

/** "today at 8:00 PM", "tomorrow at 9:30 AM", "on Friday at 3:00 PM". */
export function describeWhen(at: Date, now: Date = new Date(), language = "en-US"): string {
  let time: string;
  try {
    time = at.toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" });
  } catch {
    time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(at) - startOf(now)) / 86_400_000);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `tomorrow at ${time}`;
  if (days > 1 && days < 7) return `on ${WEEKDAYS[at.getDay()].replace(/^./, (c) => c.toUpperCase())} at ${time}`;
  let date: string;
  try {
    date = at.toLocaleDateString(language, { weekday: "long", month: "long", day: "numeric" });
  } catch {
    date = at.toDateString();
  }
  return `on ${date} at ${time}`;
}
