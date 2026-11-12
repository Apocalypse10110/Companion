/**
 * The assistant: implements the shared `AssistantService` contract.
 *
 *   sentence -> context (yes/no, "her", answers to our questions)
 *            -> on-device rules -> (if not understood) AI provider
 *            -> validateIntent -> reply + ProposedAction for the person to confirm
 *
 * It never performs an action. Developer C's ActionService does that, only after the
 * person taps "Yes, do it" in the UI.
 *
 * Owner: Developer B.
 */

import {
  AssistantError,
  type AssistantReply,
  type AssistantRequest,
  type AssistantSendOptions,
  type AssistantService,
  type ProposedAction,
} from "@/contracts";
import { speakable } from "@/voice/speakable";
import { ContextStore, type ConversationContext, type Slot } from "./context";
import { PRONOUNS, classify, cleanContact, looksLikeQuestion, normalize, stripPolite } from "./intents/rules";
import { cleanString, validateIntent, type Intent } from "./intents/schema";
import { describeWhen, parseWhen } from "./intents/time";
import { noProvider, type AIProvider } from "./providers/types";
import { APP_LABELS, SETTING_TITLES, capitalize, contactLabel, recoverCase, yourify } from "./words";

export interface AssistantOptions {
  provider?: AIProvider;
  /** For tests. */
  now?: () => Date;
  newId?: () => string;
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const EXAMPLES = ["Call my daughter", "Remind me to take my pills at 8", "Make the text bigger"];

/** Longest answer we show from an AI model. Long answers are hard to follow when spoken. */
const MAX_AI_REPLY = 600;

interface Draft {
  text: string;
  spoken?: string;
  action?: { intent: Intent; action: Omit<ProposedAction, "id"> };
  suggestions?: string[];
  awaiting?: { intent: Intent; slot: Slot };
  /** The offered action is still waiting for the person's tap. */
  keepPending?: boolean;
}

export function createAssistant(options: AssistantOptions = {}): AssistantService & { reset(): void } {
  const provider = options.provider ?? noProvider;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? defaultId;
  const store = new ContextStore();

  async function understand(
    request: AssistantRequest,
    signal?: AbortSignal,
  ): Promise<{ intent: Intent | null; aiReply?: string }> {
    const raw = classify(request.text, now());
    const local = raw ? validateIntent(raw) : null;
    if (local) return { intent: local };

    const lastAssistant = [...request.history].reverse().find((t) => t.role === "assistant")?.text;
    const result = await provider.interpret(
      { text: request.text, history: request.history, language: request.language, now: now().toISOString(), lastAssistantText: lastAssistant },
      signal,
    );
    if (!result) return { intent: null };
    const intent = validateIntent(result.intent);
    // For actions we always use our own wording; the AI's sentence is only used for answers.
    return { intent, aiReply: cleanString(result.reply, MAX_AI_REPLY) };
  }

  function fillSlot(ctx: ConversationContext, text: string): Intent | "cancel" | null {
    const awaiting = ctx.awaiting;
    if (!awaiting) return null;
    const n = normalize(text);
    const raw = classify(text, now());
    const asked = raw ? validateIntent(raw) : null;
    if (asked?.name === "DENY") return "cancel";
    const intent: Intent = { name: awaiting.intent.name, params: { ...awaiting.intent.params } };

    switch (awaiting.slot) {
      case "body": {
        // Anything they say now is the message, even "call me later".
        const body = cleanString(text, 500);
        if (!body) return null;
        intent.params.body = capitalize(body);
        return intent;
      }
      case "text": {
        if (asked && asked.name !== "UNKNOWN" && asked.name !== "CREATE_REMINDER" && asked.name !== "CONFIRM") return null;
        const t = cleanString(stripPolite(n).replace(/^(?:to |about |that )/, ""), 120);
        if (!t) return null;
        intent.params.text = t;
        const when = parseWhen(t, now());
        if (when && !intent.params.at) {
          intent.params.at = when.at.toISOString();
          if (when.recurrence) intent.params.recurrence = when.recurrence;
        }
        return intent;
      }
      case "at": {
        const when = parseWhen(n, now());
        if (!when) return asked && asked.name !== "UNKNOWN" && asked.name !== "CONFIRM" ? null : intent; // ask again
        intent.params.at = when.at.toISOString();
        if (when.recurrence) intent.params.recurrence = when.recurrence;
        intent.params.when = cleanString(n, 60);
        return intent;
      }
      case "contact": {
        // A new, clear request wins over answering our question.
        if (asked && !["UNKNOWN", "CONFIRM", "FIND_INFORMATION", "HELP"].includes(asked.name)) return null;
        const who = cleanContact(stripPolite(n).replace(/^(?:call|text|message|it's|it is|to) /, ""));
        if (!who) return null;
        intent.params.contact = who;
        return intent;
      }
    }
  }

  function resolvePronoun(intent: Intent, ctx: ConversationContext): Intent {
    const c = intent.params.contact;
    if (!c || !PRONOUNS.test(c.toLowerCase())) return intent;
    return { ...intent, params: { ...intent.params, contact: ctx.lastContact } };
  }

  function respond(intent: Intent, request: AssistantRequest, ctx: ConversationContext, aiReply?: string): Draft {
    const p = intent.params;
    const lang = request.language || "en-US";

    switch (intent.name) {
      case "CALL_CONTACT": {
        if (!p.contact) {
          return {
            text: PRONOUNS_ASKED(request.text) ? "Who would you like me to call? Please say their name." : "Who would you like to call?",
            awaiting: { intent, slot: "contact" },
          };
        }
        const who = contactLabel(p.contact);
        return {
          text: `Would you like me to call ${who}? Tap "Yes, do it" to start the call.`,
          spoken: `Would you like me to call ${who}? Tap yes to start the call.`,
          action: { intent, action: { kind: "call", title: `Call ${who}`, risk: "high", params: { contact: p.contact } } },
        };
      }

      case "SEND_MESSAGE": {
        if (!p.contact) return { text: "Who should I send the message to?", awaiting: { intent, slot: "contact" } };
        const who = contactLabel(p.contact);
        if (!p.body) return { text: `What would you like the message to ${who} to say?`, awaiting: { intent, slot: "body" } };
        const body = recoverCase(request.text, p.body);
        const finalIntent = { ...intent, params: { ...p, body } };
        return {
          text: `Here is your message to ${who}: "${body}". Should I send it?`,
          spoken: `Here is your message to ${who}. ${body}. Should I send it?`,
          action: {
            intent: finalIntent,
            action: { kind: "message", title: `Send a message to ${who}`, description: `"${body}"`, risk: "high", params: { contact: p.contact, body } },
          },
        };
      }

      case "READ_MESSAGES":
        return {
          text: "I'm sorry, I can't read your messages myself. Your phone keeps them private from other apps. I can open your Messages app so you can read them.",
          action: { intent: { name: "OPEN_APPLICATION", params: { app: "messages" } }, action: { kind: "open-app", title: "Open Messages", risk: "low", params: { app: "messages" } } },
        };

      case "OPEN_APPLICATION": {
        const app = p.app!;
        if (app === "maps" && p.destination) {
          const dest = p.destination === "home" ? "home" : recoverCase(request.text, p.destination);
          const title = dest === "home" ? "Get directions home" : `Get directions to ${dest}`;
          return {
            text: `I can open Maps with directions ${dest === "home" ? "home" : `to ${dest}`}.`,
            action: { intent, action: { kind: "open-app", title, risk: "low", params: { app, destination: dest } } },
          };
        }
        return {
          text: `I can open ${APP_LABELS[app]} for you.`,
          action: { intent, action: { kind: "open-app", title: `Open ${capitalize(APP_LABELS[app])}`, risk: "low", params: { app } } },
        };
      }

      case "CHANGE_ACCESSIBILITY": {
        const title = SETTING_TITLES[`${p.setting}:${p.value}`] ?? "Change a setting";
        return {
          text: `I can do that. ${title}?`,
          action: { intent, action: { kind: "accessibility", title, risk: "low", params: { setting: p.setting, value: p.value } } },
        };
      }

      case "CREATE_REMINDER": {
        if (!p.text) return { text: "What would you like me to remind you about?", awaiting: { intent, slot: "text" } };
        const what = yourify(recoverCase(request.text, p.text).replace(/^./, (ch) => ch.toLowerCase()));
        if (!p.at) {
          return {
            text: `When should I remind you to ${what}? You can say something like "at 8 tonight" or "tomorrow morning".`,
            spoken: `When should I remind you to ${what}? You can say something like, at 8 tonight, or tomorrow morning.`,
            awaiting: { intent, slot: "at" },
          };
        }
        const at = new Date(p.at);
        if (at.getTime() <= now().getTime()) {
          return { text: "That time has already passed. When should I remind you instead?", awaiting: { intent: { ...intent, params: { ...p, at: undefined } }, slot: "at" } };
        }
        const when = describeWhen(at, now(), lang);
        const repeat = p.recurrence === "daily" ? ", every day" : p.recurrence === "weekly" ? ", every week" : "";
        const text = recoverCase(request.text, p.text);
        return {
          text: `I'll remind you to ${what} ${when}${repeat}. Should I set that reminder?`,
          action: {
            intent,
            action: {
              kind: "reminder",
              title: `Remind me to ${what}`,
              description: capitalize(`${when}${repeat}`),
              risk: "low",
              params: { text, at: at.toISOString(), ...(p.recurrence ? { recurrence: p.recurrence } : {}) },
            },
          },
        };
      }

      case "LIST_REMINDERS": {
        const which = p.which ?? "next";
        const title = which === "next" ? "Read my next reminder" : which === "today" ? "Read today's reminders" : "Read all my reminders";
        return {
          text: which === "today" ? "I'll check what you have today." : "I'll check your reminders.",
          action: { intent, action: { kind: "list-reminders", title, risk: "low", params: { which } } },
        };
      }

      case "READ_TIME": {
        const d = now();
        if (p.what === "date") {
          const date = safeDate(d, lang, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
          return { text: `Today is ${date}.` };
        }
        const time = safeTime(d, lang);
        const part = d.getHours() < 12 ? "in the morning" : d.getHours() < 17 ? "in the afternoon" : d.getHours() < 21 ? "in the evening" : "at night";
        return { text: `It's ${time}.`, spoken: `It's ${time.replace(/\s?[AP]M$/i, "")} ${part}.` };
      }

      case "CHECK_WEATHER":
        if (aiReply) return { text: aiReply };
        return {
          text: "I'm sorry, I can't check the weather yet. I can open the web browser so you can look it up.",
          action: { intent: { name: "OPEN_APPLICATION", params: { app: "browser" } }, action: { kind: "open-app", title: "Open the web browser", risk: "low", params: { app: "browser", query: "weather" } } },
        };

      case "FIND_INFORMATION":
        if (aiReply) return { text: aiReply };
        return {
          text: "I'm sorry, I can't look that up right now. I can help you call someone, send a message, set a reminder, or make the text bigger.",
          suggestions: EXAMPLES,
        };

      case "HELP": {
        if (aiReply) return { text: aiReply, suggestions: EXAMPLES };
        if (p.topic === "notification") {
          return {
            text: "A notification is a short message from an app, like a new text or a reminder. To see them, slide your finger down from the very top of the screen. To clear one, slide it to the side. If you read it to me, I can explain what it means.",
          };
        }
        return {
          text: "I'm here to help. Tap the microphone and tell me what you need in your own words. For example, you can ask me to call someone, send a message, set a reminder, or make the text bigger.",
          suggestions: EXAMPLES,
        };
      }

      case "CONFIRM": {
        if (ctx.pending) {
          return {
            text: `Okay. Please tap "Yes, do it" on the card above to ${lowerFirst(ctx.pending.action.title)}.`,
            spoken: `Okay. Please tap yes on the card above to ${lowerFirst(ctx.pending.action.title)}.`,
            keepPending: true,
          };
        }
        return { text: "I'm not sure what you'd like me to do. Could you tell me again?", suggestions: EXAMPLES };
      }

      case "DENY":
        return { text: ctx.pending || ctx.awaiting ? "Okay, I won't do that." : "Okay." };

      case "UNKNOWN":
      default:
        if (aiReply) return { text: aiReply };
        return {
          text: "Sorry, I didn't quite understand that. You can ask me to call someone, send a message, set a reminder, or make the text bigger.",
          suggestions: EXAMPLES,
        };
    }
  }

  function quickAction(request: AssistantRequest): Draft | null {
    switch (request.quickActionId) {
      case "call":
        return { text: "Who would you like to call?", awaiting: { intent: { name: "CALL_CONTACT", params: {} }, slot: "contact" } };
      case "messages":
        return {
          text: "Who would you like to send a message to?",
          awaiting: { intent: { name: "SEND_MESSAGE", params: {} }, slot: "contact" },
          suggestions: ["Read my messages"],
        };
      case "reminders":
        return { text: "Would you like to hear your reminders, or set a new one?", suggestions: ["Read my reminders", "Set a reminder"] };
      case "help":
        return null; // handled as HELP below
      default:
        return null;
    }
  }

  return {
    reset: () => store.reset(),

    async send(request: AssistantRequest, opts: AssistantSendOptions = {}): Promise<AssistantReply> {
      const { signal } = opts;
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const text = (request.text ?? "").trim();
      if (!text) throw new AssistantError("unknown", "Empty request");

      const ctx = store.restore(request.history ?? []);
      let draft: Draft | null = request.source === "quick-action" ? quickAction(request) : null;

      if (!draft) {
        let intent: Intent | null = null;
        let aiReply: string | undefined;

        const filled = fillSlot(ctx, text);
        if (filled === "cancel") intent = { name: "DENY", params: {} };
        else if (filled) intent = filled;
        else if (request.quickActionId === "help") intent = { name: "HELP", params: {} };
        else {
          try {
            ({ intent, aiReply } = await understand(request, signal));
          } catch (err) {
            if (signal?.aborted) throw err;
            // The AI failed, but a question we can't answer locally should still get a kind reply.
            if (err instanceof AssistantError && err.code !== "unknown") throw err;
            intent = null;
          }
          if (!intent) intent = { name: looksLikeQuestion(text) ? "FIND_INFORMATION" : "UNKNOWN", params: { query: cleanString(text, 500) } };
        }

        // Someone asked "Who should I call?" and the person said "her": resolve from context.
        intent = resolvePronoun(intent, ctx);
        draft = respond(intent, request, ctx, aiReply);
      }

      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      // Build the reply and remember what we need for the next turn.
      const reply: AssistantReply = { id: newId(), text: draft.text };
      const spoken = speakable(draft.spoken ?? draft.text);
      if (spoken !== draft.text) reply.spokenText = spoken;
      if (draft.suggestions?.length) reply.suggestions = draft.suggestions.slice(0, 3);

      const next: ConversationContext = { lastContact: ctx.lastContact, lastReplyText: reply.text };
      if (draft.action) {
        const action: ProposedAction = { id: newId(), ...draft.action.action };
        reply.proposedActions = [action];
        next.pending = { intent: draft.action.intent, action };
        const contact = draft.action.intent.params.contact;
        if (contact && !PRONOUNS.test(contact)) next.lastContact = contact;
      } else if (draft.awaiting) {
        next.awaiting = draft.awaiting;
      } else if (draft.keepPending) {
        next.pending = ctx.pending;
      }
      store.save(next);
      return reply;
    },
  };
}

function PRONOUNS_ASKED(text: string): boolean {
  return /\b(?:her|him|them)\b/i.test(text);
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function safeTime(d: Date, lang: string): string {
  try {
    return d.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });
  } catch {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}

function safeDate(d: Date, lang: string, o: Intl.DateTimeFormatOptions): string {
  try {
    return d.toLocaleDateString(lang, o);
  } catch {
    return d.toLocaleDateString("en-US", o);
  }
}
