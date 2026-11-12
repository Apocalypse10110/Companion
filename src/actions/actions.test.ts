import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionsService, ProposedAction } from "@/contracts";
import { addPerson, findPeople, loadPeople } from "@/people/store";
import { DEFAULT_SETTINGS, type Settings } from "@/ui/settings/types";
import { createActionService } from "./index";
import { mapsUrl, smsUrl, telUrl } from "./links";
import { addReminder, describeReminders, dueReminders, finishReminder, loadReminders } from "./reminders";
import { connectSettings, planSetting } from "./settingsBridge";

const NOW = new Date(2026, 10, 12, 9, 0, 0);
const act = (kind: string, params: Record<string, unknown>, risk: "low" | "high" = "high"): ProposedAction => ({ id: "a1", kind, title: "t", risk, params });
const perms = (state: "granted" | "prompt" | "denied" | "unsupported"): PermissionsService => ({ check: async () => state, request: async () => state });

function setup(opts: { os?: "ios" | "android" | "desktop"; picker?: unknown; notifications?: "granted" | "prompt" | "denied" | "unsupported" } = {}) {
  const launch = vi.fn();
  const service = createActionService({
    launch,
    os: () => opts.os ?? "android",
    picker: () => (opts.picker as never) ?? null,
    permissions: perms(opts.notifications ?? "granted"),
    now: () => NOW,
  });
  return { service, launch };
}

beforeEach(() => localStorage.clear());

describe("people", () => {
  it("finds by relationship, full name or first name, never guessing", () => {
    addPerson({ name: "Anna Smith", phone: "07700 900123", relationship: "daughter" });
    addPerson({ name: "Annabel", phone: "1" });
    expect(findPeople("my daughter").map((p) => p.name)).toEqual(["Anna Smith"]);
    expect(findPeople("anna").map((p) => p.name)).toEqual(["Anna Smith"]);
    expect(findPeople("annabel").map((p) => p.name)).toEqual(["Annabel"]);
    addPerson({ name: "Mary", phone: "2", relationship: "Mum" });
    expect(findPeople("mother").map((p) => p.name)).toEqual(["Mary"]);
  });
});

describe("calls", () => {
  it("opens the dialer with the saved number and says what to press", async () => {
    addPerson({ name: "Anna", phone: "+44 7700 900123", relationship: "daughter" });
    const { service, launch } = setup();
    const r = await service.execute(act("call", { contact: "daughter" }));
    expect(launch).toHaveBeenCalledWith("tel:+447700900123");
    expect(r.ok).toBe(true);
    expect(r.message).toContain("opened your phone app with Anna's number");
    expect(r.message).not.toMatch(/calling/i);
  });

  it("explains how to add someone it doesn't know, and does nothing", async () => {
    const { service, launch } = setup({ os: "ios" });
    const r = await service.execute(act("call", { contact: "daughter" }));
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Settings, then People");
    expect(launch).not.toHaveBeenCalled();
  });

  it("refuses to choose between two matches", async () => {
    addPerson({ name: "Anna", phone: "1", relationship: "daughter" });
    addPerson({ name: "Beth", phone: "2", relationship: "daughter" });
    const { service, launch } = setup();
    const r = await service.execute(act("call", { contact: "daughter" }));
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Anna and Beth");
    expect(launch).not.toHaveBeenCalled();
  });

  it("uses the Android contact picker and remembers the relationship", async () => {
    const picker = { select: vi.fn(async () => [{ name: ["Anna"], tel: ["07700 900123"] }]) };
    const { service, launch } = setup({ picker });
    const r = await service.execute(act("call", { contact: "daughter" }));
    expect(launch).toHaveBeenCalledWith("tel:07700900123");
    expect(r.message).toContain("saved Anna as your daughter");
    expect(loadPeople()[0]).toMatchObject({ name: "Anna", relationship: "daughter" });
  });

  it("dials a number said directly", async () => {
    const { service, launch } = setup();
    await service.execute(act("call", { contact: "0123 456789" }));
    expect(launch).toHaveBeenCalledWith("tel:0123456789");
  });
});

describe("messages", () => {
  it("opens Messages with the text ready, iPhone and Android formats", async () => {
    addPerson({ name: "Anna", phone: "123", relationship: "daughter" });
    const android = setup();
    const r = await android.service.execute(act("message", { contact: "daughter", body: "I'm running late" }));
    expect(android.launch).toHaveBeenCalledWith("sms:123?body=I'm%20running%20late");
    expect(r.message).toContain("tap Send");
    expect(smsUrl("123", "hi", "ios")).toBe("sms:123&body=hi");
  });
});

describe("open-app", () => {
  it("opens maps and the browser with links", async () => {
    const { service, launch } = setup({ os: "ios" });
    await service.execute(act("open-app", { app: "maps", destination: "the pharmacy" }, "low"));
    expect(launch).toHaveBeenCalledWith(mapsUrl("the pharmacy", "ios"));
    await service.execute(act("open-app", { app: "browser", query: "weather" }, "low"));
    expect(launch).toHaveBeenLastCalledWith("https://www.google.com/search?q=weather");
  });
  it("is honest about apps it can't open", async () => {
    const { service, launch } = setup({ os: "ios" });
    const r = await service.execute(act("open-app", { app: "phone" }, "low"));
    expect(r.ok).toBe(false);
    expect(launch).not.toHaveBeenCalled();
  });
});

describe("reminders", () => {
  const at = new Date(2026, 10, 12, 20, 0, 0).toISOString();

  it("asks for notifications at the moment it needs them", async () => {
    const { service } = setup({ notifications: "prompt" });
    const r = await service.execute(act("reminder", { text: "take my pills", at }, "low"));
    expect(r).toMatchObject({ ok: false, needsPermission: "notifications" });
    expect(loadReminders()).toHaveLength(0);
  });

  it("saves it, and is honest without notifications", async () => {
    const { service } = setup({ notifications: "unsupported" });
    const r = await service.execute(act("reminder", { text: "take my pills", at }, "low"));
    expect(r.ok).toBe(true);
    expect(r.message).toContain("take your pills");
    expect(r.message).toContain("Keep Companion open");
    expect(loadReminders()).toHaveLength(1);
  });

  it("reads them back, then repeats daily ones", async () => {
    addReminder({ text: "Take my pills", at, recurrence: "daily" }, NOW);
    expect(describeReminders("next", NOW)).toMatch(/^Your next reminder is to take my pills, /);
    const later = new Date(2026, 10, 12, 20, 1, 0);
    expect(dueReminders(later)).toHaveLength(1);
    finishReminder(loadReminders()[0].id, later);
    expect(new Date(loadReminders()[0].at).getDate()).toBe(13);
  });

  it("lists through the action", async () => {
    const { service } = setup();
    const r = await service.execute(act("list-reminders", { which: "next" }, "low"));
    expect(r.message).toContain("don't have any reminders");
  });
});

describe("accessibility actions", () => {
  it("changes Companion's own settings through the bridge", async () => {
    let s: Settings = { ...DEFAULT_SETTINGS, textSize: "large" };
    const off = connectSettings({ get: () => s, update: (p) => (s = { ...s, ...p }) });
    const { service } = setup();
    const r = await service.execute(act("accessibility", { setting: "textSize", value: "increase" }, "low"));
    expect(r).toEqual({ ok: true, message: "The text is bigger now." });
    expect(s.textSize).toBe("larger");
    off();
  });

  it("plans each change in plain words", () => {
    const s = { ...DEFAULT_SETTINGS, textSize: "largest" as const, volume: 1 };
    expect(planSetting(s, "textSize", "increase")?.message).toContain("already as big");
    expect(planSetting(s, "volume", "louder")?.patch).toEqual({});
    expect(planSetting(s, "highContrast", "on")?.patch).toEqual({ highContrast: true });
    expect(planSetting(s, "nope", "on")).toBeNull();
  });
});

describe("links", () => {
  it("cleans phone numbers", () => {
    expect(telUrl("(0123) 456-789")).toBe("tel:0123456789");
  });
});
