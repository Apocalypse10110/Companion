/**
 * The on-device understanding layer. Turns everyday sentences into intents with plain
 * patterns, so the assistant works with no internet and no paid AI service.
 * Anything it can't place confidently returns null and may go to an AI provider.
 *
 * Owner: Developer B.
 */

import { APPS, type AppName, type Intent, cleanString } from "./schema";
import { WHEN_PATTERN, parseWhen } from "./time";

/** Lowercase, straighten quotes, drop end punctuation, collapse spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[!?.,;]+(\s|$)/g, "$1")
    .replace(/["]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const POLITE_PREFIX =
  /^(?:(?:hey|hi|hello|ok|okay|um+|uh+|so|well|now|alright)(?: there)?(?: companion)? )*(?:(?:please|kindly) )?(?:(?:can|could|would|will) you(?: please)? |i(?:'d| would) like (?:you )?to |i want (?:you )?to |i need (?:you )?to |i wanna |help me (?=(?:call|send|text|open|set|make|find)\b)|let's |go ahead and |(?:please )?try to )?(?:please )?/;
const POLITE_SUFFIX = /(?: (?:please|for me|now|right now|thanks|thank you|if you can|if you could|would you|could you))+$/;

/** Remove "could you please", "for me", "thanks" and similar padding. */
export function stripPolite(s: string): string {
  let out = s;
  for (let i = 0; i < 3; i++) {
    const next = out.replace(POLITE_PREFIX, "").replace(POLITE_SUFFIX, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

/** "my daughter" -> "daughter", "Emma on her mobile" -> "emma". Keeps the person's words otherwise. */
export function cleanContact(raw: string): string | undefined {
  const s = raw
    .replace(/^(?:to |up )/, "")
    .replace(/^(?:my |our |the )/, "")
    .replace(/(?: (?:on|at) (?:her|his|their|the)? ?(?:mobile|cell|phone|home|work|landline)(?: number| phone)?)$/, "")
    .replace(/ (?:back|again|up|now)$/, "")
    .trim();
  return cleanString(s, 60);
}

export const PRONOUNS = /^(?:her|him|them|they|that person|this person|that number|the same person|back)$/;

const CONFIRM = /^(?:yes|yeah|yep|yup|yes please|sure|ok|okay|alright|all right|go ahead|go on|do it|do that|please do|that's right|that is right|correct|right|absolutely|of course|definitely|yes do it|yes go ahead|sounds good|confirm|i'm sure|please)$/;
const DENY = /^(?:no|nope|nah|no thanks|no thank you|don't|do not|don't do that|cancel|cancel that|stop|never ?mind|forget it|not now|wait|hold on|no don't)$/;

const APP_WORDS: Array<[RegExp, AppName]> = [
  [/\b(?:photos?|pictures?|pics|gallery|photo album|snaps)\b/, "photos"],
  [/\bcamera\b/, "camera"],
  [/\b(?:phone app|dialer|dial pad|keypad)\b/, "phone"],
  [/\b(?:messages app|messaging|text messages app|sms app)\b/, "messages"],
  [/\b(?:calendar|diary|schedule)\b/, "calendar"],
  [/\b(?:clock|alarms?|timer)\b/, "clock"],
  [/\b(?:settings|phone settings)\b/, "settings"],
  [/\b(?:maps?|directions|navigation|sat ?nav|gps)\b/, "maps"],
  [/\b(?:contacts|address book|phone book)\b/, "contacts"],
  [/\b(?:e-?mails?|inbox|gmail)\b/, "email"],
  [/\b(?:browser|internet|chrome|web)\b/, "browser"],
];

function appFrom(s: string): AppName | undefined {
  for (const [re, app] of APP_WORDS) if (re.test(s)) return app;
  return (APPS as readonly string[]).includes(s) ? (s as AppName) : undefined;
}

function accessibility(s: string): Intent | null {
  const text = /\b(?:text|font|writing|words|letters|everything|screen|it|things|print)\b/;
  const bigger = /\b(?:bigger|larger|large|increase|enlarge|easier to read|hard to read|can't read|cannot read|too small|zoom in|grow)\b/;
  const smaller = /\b(?:smaller|decrease|reduce|shrink|too big|too large|zoom out)\b/;
  if ((text.test(s) || /\beasier to read\b/.test(s)) && bigger.test(s) && !/\bbutton/.test(s))
    return { name: "CHANGE_ACCESSIBILITY", params: { setting: "textSize", value: "increase" } };
  if (text.test(s) && smaller.test(s) && !/\bbutton/.test(s))
    return { name: "CHANGE_ACCESSIBILITY", params: { setting: "textSize", value: "decrease" } };
  if (/\bbuttons?\b/.test(s) && bigger.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "extraLargeButtons", value: "on" } };
  if (/\bbuttons?\b/.test(s) && smaller.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "extraLargeButtons", value: "off" } };
  if (/\bhigh contrast\b|\bmore contrast\b|\bstronger colou?rs\b/.test(s))
    return { name: "CHANGE_ACCESSIBILITY", params: { setting: "highContrast", value: /\b(?:off|disable|no more|less)\b/.test(s) ? "off" : "on" } };
  if (/\bdark (?:mode|theme)\b|\bmake (?:it|the screen) dark(?:er)?\b|\btoo bright\b/.test(s))
    return { name: "CHANGE_ACCESSIBILITY", params: { setting: "theme", value: /\b(?:off|disable)\b/.test(s) ? "light" : "dark" } };
  if (/\blight (?:mode|theme)\b|\bmake (?:it|the screen) (?:light|bright)(?:er)?\b|\btoo dark\b/.test(s))
    return { name: "CHANGE_ACCESSIBILITY", params: { setting: "theme", value: "light" } };
  if (/\bbold\b/.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "boldText", value: /\b(?:off|disable|stop|no|not|normal)\b/.test(s) ? "off" : "on" } };
  if (/\b(?:animations?|motion|moving)\b/.test(s))
    return { name: "CHANGE_ACCESSIBILITY", params: { setting: "motion", value: /\b(?:turn on|enable|more|bring back)\b/.test(s) ? "full" : "reduce" } };
  const talk = /\b(?:speak|talk|read|voice|speaking|talking|say things)\b/;
  if (talk.test(s) && /\b(?:slow(?:er| down)?|too fast)\b/.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "speechRate", value: "slower" } };
  if (talk.test(s) && /\b(?:fast(?:er)?|quick(?:er|ly)?|speed up|too slow)\b/.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "speechRate", value: "faster" } };
  if (/\b(?:louder|volume up|turn (?:it |the volume )?up|can't hear you|cannot hear you|speak up)\b/.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "volume", value: "louder" } };
  if (/\b(?:quieter|softer|volume down|turn (?:it |the volume )?down|too loud)\b/.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "volume", value: "quieter" } };
  if (/\b(?:stop|don't|do not) (?:talking|speaking|reading (?:out )?loud)\b|\bbe quiet\b|\bmute\b/.test(s) && !/\b(?:message|call)\b/.test(s))
    return { name: "CHANGE_ACCESSIBILITY", params: { setting: "speakReplies", value: "off" } };
  if (/\b(?:read|speak|say) (?:your )?(?:answers|replies) (?:out loud|aloud)\b/.test(s)) return { name: "CHANGE_ACCESSIBILITY", params: { setting: "speakReplies", value: "on" } };
  return null;
}

function reminderText(raw: string): string | undefined {
  const s = raw
    .replace(WHEN_PATTERN, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:to |about |that |of )/, "")
    .replace(/ (?:to|about|at|on|for|and)$/, "")
    .trim();
  return cleanString(s, 120);
}

function whenWords(raw: string): string | undefined {
  const m = raw.match(WHEN_PATTERN);
  return m ? cleanString(m.join(" "), 60) : undefined;
}

function reminder(s: string, now: Date): Intent | null {
  // Asking about reminders or the day's plans.
  if (
    /^(?:what|which|any|do i have|have i got|read|tell me|list|show|check|what's|whats|when(?:'s| is)|is there|are there)\b.*\b(?:reminders?|appointments?|plans|schedule|on today|on tomorrow|to do today|have (?:on )?today)\b/.test(s) ||
    /^(?:my (?:reminders|appointments)|reminders)$/.test(s) ||
    /\bwhat (?:do i have|have i got|am i doing)(?: on)? (?:today|tomorrow|this (?:morning|afternoon|evening))\b/.test(s)
  ) {
    if (/\b(?:latest|next|first|upcoming|soonest|last)\b/.test(s)) return { name: "LIST_REMINDERS", params: { which: "next" } };
    if (/\b(?:today|this (?:morning|afternoon|evening)|tonight)\b/.test(s)) return { name: "LIST_REMINDERS", params: { which: "today" } };
    if (/\ball\b/.test(s)) return { name: "LIST_REMINDERS", params: { which: "all" } };
    return { name: "LIST_REMINDERS", params: { which: /\breminders\b|\bappointments\b/.test(s) ? "all" : "today" } };
  }

  const m =
    s.match(/^remind me(?: to| about| that| of)?(?: (.*))?$/) ??
    s.match(/^(?:set|make|create|add|put in|schedule)(?: me)?(?: a| an)? (?:reminder|alarm|alert)(?: for me)?(?: to| about| for| that)?(?: (.*))?$/) ??
    s.match(/^(?:don't let me forget|make sure i don't forget|help me remember)(?: to| about)?(?: (.*))?$/);
  if (!m) return null;
  const rest = (m[1] ?? "").trim();
  const parsed = rest ? parseWhen(rest, now) : null;
  const params: Intent["params"] = { text: reminderText(rest), when: whenWords(rest) };
  if (parsed) {
    params.at = parsed.at.toISOString();
    if (parsed.recurrence) params.recurrence = parsed.recurrence;
  }
  return { name: "CREATE_REMINDER", params };
}

function message(s: string): Intent | null {
  if (/^(?:tell|let) me\b/.test(s)) return null;
  if (
    /^(?:read|check|play|any|do i have|have i got|did i get|are there|is there|what(?:'s| is| are)?|who)\b.*\b(?:messages?|texts?|sms|whatsapps?)\b/.test(s) ||
    /^(?:my )?(?:new |latest )?(?:messages|texts)$/.test(s)
  )
    return { name: "READ_MESSAGES", params: {} };

  const forms: RegExp[] = [
    /^(?:send|write)(?: a)? (?:message|text|note|sms)(?: message)? to (.+?)(?: (?:saying|that says|to say|telling (?:her|him|them)|that|and say)\b ?(.*))?$/,
    /^(?:send|write) (.+?) a (?:message|text|note)(?: (?:saying|that says|to say|that)\b ?(.*))?$/,
    /^(?:text|message) (.+?)(?: (?:saying|that says|to say|that|and say)\b ?(.*))?$/,
    /^(?:tell|let) (.+?) know(?: that)?(?: (.*))?$/,
    /^tell ((?:my |our )?\S+) (?:that )?(.+)$/,
  ];
  for (const re of forms) {
    const m = s.match(re);
    if (!m) continue;
    let contact = m[1];
    let body = m[2];
    // "text emma i'm late" (no "saying"): first word is the contact if it's a single name.
    if (re === forms[2] && !body) {
      const parts = contact.split(" ");
      if (parts.length > 1 && !/^(?:my|the|our)$/.test(parts[0])) {
        contact = parts[0];
        body = parts.slice(1).join(" ");
      } else if (parts.length > 2) {
        contact = parts.slice(0, 2).join(" ");
        body = parts.slice(2).join(" ");
      }
    }
    return {
      name: "SEND_MESSAGE",
      params: { contact: cleanContact(contact), body: body ? cleanString(body.replace(/^that /, ""), 500) : undefined },
    };
  }
  if (/^(?:send|write)(?: a)? (?:message|text)$/.test(s) || /^(?:i want to )?(?:send|write) (?:someone )?a (?:message|text)$/.test(s))
    return { name: "SEND_MESSAGE", params: {} };
  return null;
}

function call(s: string): Intent | null {
  const m =
    s.match(/^(?:call|phone|ring|dial|ring up|phone up|video call|facetime)(?: up)?(?: (.+))?$/) ??
    s.match(/^(?:give|make) (.+?) a (?:call|ring|phone call)$/) ??
    s.match(/^(?:make a (?:phone )?call|place a call)(?: to (.+))?$/) ??
    s.match(/^(?:get|put) me through to (.+)$/) ??
    s.match(/^(?:i want to )?(?:talk|speak) (?:to|with) (.+?)(?: on the phone)?$/);
  if (!m) return null;
  const who = m[1] ? cleanContact(m[1]) : undefined;
  if (who && /^(?:someone|somebody|a number|a friend)$/.test(who)) return { name: "CALL_CONTACT", params: {} };
  return { name: "CALL_CONTACT", params: { contact: who } };
}

function openApp(s: string): Intent | null {
  // Getting somewhere.
  const nav =
    s.match(/^(?:help me )?(?:find|show me|get|give me|take me|navigate|guide me)(?: my| the)? (?:way|directions|route)? ?(?:back )?(?:to|home)\b ?(.*)$/) ??
    s.match(/^(?:how do i get|directions|navigate|take me) (?:to|home)\b ?(.*)$/) ??
    s.match(/^i(?:'m| am) lost$/);
  if (nav) {
    const dest = /\bhome\b/.test(s) && !nav[1] ? "home" : cleanString(nav[1]?.replace(/^(?:the )/, ""), 120) ?? (/\bhome\b/.test(s) ? "home" : undefined);
    return { name: "OPEN_APPLICATION", params: { app: "maps", destination: dest } };
  }
  const m = s.match(/^(?:open|launch|start|show(?: me)?|go to|bring up|pull up|i want to see|i'd like to see|let me see|can i see|see|look at|take a)(?: up)?(?: my| the| a)? (.+?)(?: app)?$/);
  if (!m) return null;
  const app = appFrom(m[1]);
  if (app) return { name: "OPEN_APPLICATION", params: { app } };
  if (/^(?:open|launch|start)\b/.test(s)) return { name: "OPEN_APPLICATION", params: { app: m[1] as AppName } }; // validator turns unknown apps into UNKNOWN
  return null;
}

function time(s: string): Intent | null {
  if (/\bwhat(?:'s| is)? the (?:date|day)\b|\bwhat (?:day|date) is (?:it|today)\b|\btoday's date\b|\bwhich day is it\b|\bwhat day of the week\b/.test(s))
    return { name: "READ_TIME", params: { what: "date" } };
  if (/\bwhat(?:'s| is)? the time\b|\bwhat time is it\b|\btell me the time\b|\bhave you got the time\b|^time$|\bwhat time it is\b/.test(s))
    return { name: "READ_TIME", params: { what: "time" } };
  return null;
}

function help(s: string): Intent | null {
  if (/\bnotification\b/.test(s) && /\b(?:understand|mean|what is|what's|explain|confus)/.test(s)) return { name: "HELP", params: { topic: "notification" } };
  if (
    /^(?:help|help me|i need help|i need some help|what can you do|what do you do|how do(?:es)? (?:this|you) work|how do i use (?:you|this|my phone|the phone)|i'm confused|i am confused|i'm stuck|i am stuck|i don't know what to do|show me how)\b/.test(s) ||
    /\bhelp me (?:use|with) (?:my|the) phone\b|\bhelp me use\b|\bi don't understand\b/.test(s)
  )
    return { name: "HELP", params: { topic: cleanString(s.replace(/^.*?\b(?:with|use|understand)\b ?/, ""), 120) } };
  return null;
}

function weather(s: string): Intent | null {
  if (/\b(?:weather|forecast|temperature outside|going to rain|will it rain|is it raining|umbrella|how (?:hot|cold|warm) is it)\b/.test(s))
    return { name: "CHECK_WEATHER", params: {} };
  return null;
}

/**
 * Classify one sentence. Returns null when the sentence is not understood well enough.
 * The returned intent still goes through `validateIntent`.
 */
export function classify(text: string, now: Date = new Date()): Intent | null {
  const n = normalize(text);
  if (!n) return null;
  if (CONFIRM.test(n)) return { name: "CONFIRM", params: {} };
  if (DENY.test(n)) return { name: "DENY", params: {} };
  const s = stripPolite(n);
  if (!s) return null;
  if (CONFIRM.test(s)) return { name: "CONFIRM", params: {} };
  if (DENY.test(s)) return { name: "DENY", params: {} };

  return (
    time(s) ??
    reminder(s, now) ??
    accessibility(s) ??
    call(s) ??
    message(s) ??
    weather(s) ??
    openApp(s) ??
    help(s) ??
    null
  );
}

/** Does this sentence look like a question we could answer with general knowledge? */
export function looksLikeQuestion(text: string): boolean {
  return /^(?:what|who|where|when|why|how|which|is|are|was|were|do|does|did|can|could|should|will|would|tell me about|explain)\b/.test(stripPolite(normalize(text)));
}
