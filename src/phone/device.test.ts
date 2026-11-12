import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssistant } from "@/ai/assistant";
import { addReminder, completeReminder, dueReminders, loadReminders, pastReminders, updateReminder, upcomingReminders } from "@/actions/reminders";
import { parseVCards } from "@/people/vcard";
import { markLeft, recordHandoff, takeReturn, welcomeBackText } from "./handoff";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("contact cards (.vcf) from the phone's Contacts app", () => {
  it("reads name and numbers, iPhone-style", () => {
    const card = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Smith;Anna;;;",
      "FN:Anna Smith",
      "item1.TEL;type=pref:+44 7700 900123",
      "TEL;type=HOME:020 7946 0958",
      "EMAIL:anna@example.com",
      "END:VCARD",
    ].join("\r\n");
    expect(parseVCards(card)).toEqual([{ name: "Anna Smith", phones: ["+44 7700 900123", "020 7946 0958"] }]);
  });

  it("handles several cards, folded lines and people without numbers", () => {
    const text = "BEGIN:VCARD\nFN:Bob\n Jones\nTEL:0123456\nEND:VCARD\nBEGIN:VCARD\nFN:No Number\nEND:VCARD\nBEGIN:VCARD\nN:Lee;Kim\nTEL:999 888 777\nEND:VCARD";
    expect(parseVCards(text).map((c) => c.name)).toEqual(["BobJones", "Kim Lee"]);
  });
});

describe("coming back after a call", () => {
  it("remembers the conversation when the page is left, and greets once on return", () => {
    vi.useFakeTimers();
    recordHandoff("call", "Anna");
    markLeft("conv-1", "/");
    vi.advanceTimersByTime(60_000);
    const h = takeReturn();
    expect(h).toMatchObject({ kind: "call", name: "Anna", conversationId: "conv-1", path: "/" });
    expect(welcomeBackText(h!)).toContain("call with Anna");
    expect(takeReturn()).toBeNull();
  });

  it("ignores leaving long after the hand-off (nothing was opened)", () => {
    vi.useFakeTimers();
    recordHandoff("call", "Anna");
    vi.advanceTimersByTime(60_000);
    markLeft("conv-1", "/");
    vi.advanceTimersByTime(60_000);
    expect(takeReturn()).toBeNull();
  });
});

describe("reminders management", () => {
  const now = new Date(2026, 10, 12, 9, 0);
  const later = new Date(2026, 10, 12, 20, 0).toISOString();

  it("adds with details and notification choice, edits, completes into Past", () => {
    const r = addReminder({ text: "Doctor", description: "Bring the blue folder", at: later, notify: false }, now);
    expect(loadReminders()[0]).toMatchObject({ text: "Doctor", description: "Bring the blue folder", notify: false });
    updateReminder(r.id, { text: "Doctor Patel", at: later, notify: true });
    expect(loadReminders()[0]).toMatchObject({ text: "Doctor Patel", notify: true });
    expect(upcomingReminders(now)).toHaveLength(1);
    completeReminder(r.id, now);
    expect(upcomingReminders(now)).toHaveLength(0);
    expect(pastReminders(now)[0].completedAt).toBeTruthy();
    expect(dueReminders(new Date(2026, 10, 13))).toHaveLength(0);
  });

  it("refuses a reminder without a title or time instead of pretending", () => {
    expect(() => addReminder({ text: " ", at: later })).toThrow();
    expect(() => addReminder({ text: "x", at: "not a date" })).toThrow();
    expect(loadReminders()).toHaveLength(0);
  });
});

describe("reminders understood by the AI", () => {
  it("turns the AI's time words into a real time on the phone", async () => {
    const NOW = new Date(2026, 10, 12, 9, 0);
    const assistant = createAssistant({
      now: () => NOW,
      skills: { list: () => [], record: () => {} },
      provider: { interpret: async () => ({ intent: { name: "CREATE_REMINDER", params: { text: "call the dentist", when: "tomorrow at 3pm" } } }) },
    });
    const r = await assistant.send({
      text: "oh and don't let me forget the dentist thing, tomorrow afternoon at three",
      source: "voice",
      history: [],
      language: "en-US",
      hints: { plainLanguage: true, willBeSpoken: true },
    });
    const at = new Date(r.proposedActions?.[0].params.at as string);
    expect(r.proposedActions?.[0].kind).toBe("reminder");
    expect([at.getDate(), at.getHours()]).toEqual([13, 15]);
  });
});
