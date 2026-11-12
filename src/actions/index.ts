/**
 * ActionService (contract: src/contracts/actions.ts): does what the person confirmed.
 *
 * Runs only after a tap on "Yes, do it" (the UI's rule). Every result says exactly what happened:
 * a web app opens the dialer or Messages with things filled in, and the person presses Call or Send.
 * It never says "calling" or "sent", because it can't know.
 *
 * Kinds handled: call, message, open-app, reminder, list-reminders, accessibility (docs/ACTION_SCHEMA.md).
 * Owner: Developer C.
 */
import type { ActionKind, ActionResult, ActionService, PermissionsService, ProposedAction } from "@/contracts";
import { contactLabel, isRelationship, yourify } from "@/ai/words";
import { addPerson, findPeople, isPhoneNumber, type Person } from "@/people/store";
import { contactPicker as defaultPicker, defaultLauncher, detectOS, type ContactPicker, type Launcher, type OS } from "@/phone/platform";
import { permissions as defaultPermissions } from "@/permissions";
import { recordHandoff } from "@/phone/handoff";
import { checkCalendar, playMusic, readEmail } from "./accounts";
import { mapsUrl, searchUrl, smsUrl, telUrl } from "./links";
import { addReminder, describeReminders } from "./reminders";
import { planSetting, settingsBridge } from "./settingsBridge";

const SUPPORTED = new Set<ActionKind>([
  "call",
  "message",
  "open-app",
  "reminder",
  "list-reminders",
  "accessibility",
  "read-email",
  "check-calendar",
  "play-music",
]);

export interface ActionDeps {
  launch?: Launcher;
  os?: () => OS;
  picker?: () => ContactPicker | null;
  permissions?: PermissionsService;
  now?: () => Date;
  fetch?: typeof fetch;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "Anna", "your daughter", or the number itself. */
function who(contact: string, person?: Person): string {
  if (person) return person.name;
  return isPhoneNumber(contact) ? contact : contactLabel(contact);
}

const NO_CALLS_HERE = "If nothing opened, this device can't make phone calls. Try on your phone.";

export function createActionService(deps: ActionDeps = {}): ActionService {
  const launch = deps.launch ?? defaultLauncher;
  const os = deps.os ?? (() => detectOS());
  const picker = deps.picker ?? defaultPicker;
  const perms = deps.permissions ?? defaultPermissions;
  const now = deps.now ?? (() => new Date());
  const fetchImpl = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const lang = () => (typeof navigator !== "undefined" && navigator.language) || "en-US";

  /**
   * Find the one person meant. Zero matches: offer the Android contact picker, or explain how to add
   * them. Several matches: never guess.
   */
  async function resolve(contact: string): Promise<{ person?: Person; phone?: string; fail?: ActionResult; picked?: boolean }> {
    if (isPhoneNumber(contact)) return { phone: contact };
    const matches = findPeople(contact);
    if (matches.length === 1) return { person: matches[0], phone: matches[0].phone };
    if (matches.length > 1) {
      const names = matches.slice(0, 3).map((p) => p.name);
      return {
        fail: {
          ok: false,
          message: `I found ${matches.length} people for ${contactLabel(contact)}: ${names.join(" and ")}. Please tell me their name, for example "call ${names[0]}".`,
        },
      };
    }

    const p = picker();
    if (p) {
      try {
        const chosen = await p.select(["name", "tel"], { multiple: false });
        const first = chosen?.[0];
        const phone = first?.tel?.find((t) => t.trim());
        if (!first || !phone) return { fail: { ok: false, message: "You didn't choose anyone with a phone number, so I didn't do anything." } };
        const name = first.name?.find((n) => n.trim()) ?? phone;
        const person = addPerson({ name, phone, relationship: isRelationship(contact) ? contact : undefined });
        return { person, phone, picked: true };
      } catch {
        /* The picker was closed or failed: fall through to the explanation. */
      }
    }
    return {
      fail: {
        ok: false,
        message: `I don't have a phone number for ${contactLabel(contact)} yet. Open Settings, then People, to add them. Then ask me again.`,
      },
    };
  }

  function savedNote(contact: string, person: Person | undefined, picked?: boolean): string {
    if (!picked || !person) return "";
    return isRelationship(contact) ? ` I've saved ${person.name} as ${contactLabel(contact)}, so next time I'll know.` : ` I've saved ${person.name} for next time.`;
  }

  async function call(action: ProposedAction): Promise<ActionResult> {
    const contact = str(action.params.contact);
    if (!contact) return { ok: false, message: "I don't know who to call. Please tell me their name." };
    const r = await resolve(contact);
    if (r.fail) return r.fail;
    const name = who(contact, r.person);
    // So Companion can pick up where it left off when the person comes back from the call.
    recordHandoff("call", name);
    launch(telUrl(r.phone!));
    const system = os();
    const next =
      system === "ios"
        ? "Tap Call on the box that appears to start the call."
        : system === "android"
          ? "Tap the green call button to start the call."
          : NO_CALLS_HERE;
    return { ok: true, message: `I've opened your phone app with ${name}'s number. ${next}${savedNote(contact, r.person, r.picked)}` };
  }

  async function message(action: ProposedAction): Promise<ActionResult> {
    const contact = str(action.params.contact);
    const body = str(action.params.body);
    if (!contact) return { ok: false, message: "I don't know who to send it to. Please tell me their name." };
    const r = await resolve(contact);
    if (r.fail) return r.fail;
    const system = os();
    const name = who(contact, r.person);
    recordHandoff("message", name);
    launch(smsUrl(r.phone!, body, system));
    const next = system === "desktop" ? "If nothing opened, this device can't send text messages. Try on your phone." : "Check it, then tap Send.";
    return { ok: true, message: `I've opened Messages with your message to ${name} ready. ${next}${savedNote(contact, r.person, r.picked)}` };
  }

  function openApp(action: ProposedAction): ActionResult {
    const app = str(action.params.app);
    const system = os();
    switch (app) {
      case "phone":
        if (system === "ios") return { ok: false, message: "I can't open the Phone app on an iPhone. Tap the green Phone app on your home screen, or ask me to call someone." };
        launch("tel:");
        return { ok: true, message: "I've opened your phone app." };
      case "messages":
        launch("sms:");
        return { ok: true, message: system === "desktop" ? "I tried to open Messages. If nothing opened, this device doesn't have a messages app." : "I've opened Messages." };
      case "email":
        launch("mailto:");
        return { ok: true, message: "I've opened your email app." };
      case "maps": {
        const destination = str(action.params.destination);
        launch(mapsUrl(destination === "home" ? "Home" : destination, system));
        return { ok: true, message: destination ? `I've opened Maps with directions to ${destination}. Press Start when you're ready.` : "I've opened Maps." };
      }
      case "browser": {
        const query = str(action.params.query);
        launch(searchUrl(query));
        return { ok: true, message: query ? `I've opened the web browser and searched for ${query}.` : "I've opened the web browser." };
      }
      default:
        return { ok: false, message: "I can't open that app from here. Look for it on your home screen and tap it once." };
    }
  }

  async function reminder(action: ProposedAction): Promise<ActionResult> {
    const text = str(action.params.text);
    const at = str(action.params.at);
    const when = Date.parse(at);
    if (!text || Number.isNaN(when)) return { ok: false, message: "I couldn't tell what or when. Please ask me again, for example: remind me to take my pills at 8." };
    if (when <= now().getTime()) return { ok: false, message: "That time has already passed. Please ask me again with a new time." };

    // Ask for notifications at the moment they're needed (and only if this phone can show them).
    const state = await perms.check("notifications").catch(() => "unsupported" as const);
    if (state === "prompt") {
      return {
        ok: false,
        message: 'To alert you at the right time, I need to show notifications. Tap "Allow notifications", then choose Allow.',
        needsPermission: "notifications",
      };
    }
    const recurrence = action.params.recurrence === "daily" || action.params.recurrence === "weekly" ? action.params.recurrence : undefined;
    addReminder({ text, at: new Date(when).toISOString(), recurrence }, now());
    const what = yourify(text.replace(/^./, (c) => c.toLowerCase()));
    const how =
      state === "granted"
        ? "I'll send a notification then. Keep Companion open in the background so I can."
        : "Keep Companion open and I'll remind you on screen and out loud.";
    return { ok: true, message: `I'll remind you to ${what}. ${how}` };
  }

  function accessibility(action: ProposedAction): ActionResult {
    const bridge = settingsBridge();
    if (!bridge) return { ok: false, message: "I couldn't change that just now. You can change it in Settings." };
    const plan = planSetting(bridge.get(), str(action.params.setting), str(action.params.value));
    if (!plan) return { ok: false, message: "I can't change that setting. You can look in Settings." };
    if (Object.keys(plan.patch).length) bridge.update(plan.patch);
    return { ok: true, message: plan.message };
  }

  return {
    supports: (kind) => SUPPORTED.has(kind),
    async execute(action): Promise<ActionResult> {
      try {
        switch (action.kind) {
          case "call":
            return await call(action);
          case "message":
            return await message(action);
          case "open-app":
            return openApp(action);
          case "reminder":
            return await reminder(action);
          case "list-reminders": {
            const which = action.params.which === "today" || action.params.which === "all" ? action.params.which : "next";
            const reminders = describeReminders(which, now(), lang());
            if (which === "next") return { ok: true, message: reminders };
            // "What do I have today?" also covers a connected calendar (if there is one).
            const cal = await checkCalendar(which === "today" ? "today" : "week", fetchImpl, now(), lang()).catch(() => null);
            if (!cal?.ok || /^There's nothing/.test(cal.message)) return { ok: true, message: reminders };
            const none = /^You don't have any reminders/.test(reminders);
            return { ok: true, message: none ? cal.message : `${reminders} ${cal.message}` };
          }
          case "read-email":
            return await readEmail(fetchImpl, now());
          case "check-calendar":
            return await checkCalendar(str(action.params.when) || "today", fetchImpl, now(), lang());
          case "play-music":
            return await playMusic(str(action.params.query) || "relaxing music", fetchImpl, launch);
          case "accessibility":
            return accessibility(action);
          default:
            return { ok: false, message: "I can't do this on this device yet." };
        }
      } catch {
        return { ok: false, message: "Something went wrong, and nothing was done. Please try again." };
      }
    },
  };
}

export const actions = createActionService();
