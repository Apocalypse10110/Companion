import { describe, expect, it } from "vitest";
import { describeWhen, parseWhen } from "./time";

// Wednesday 11 Nov 2026, 9:00 am.
const NOW = new Date(2026, 10, 11, 9, 0, 0);
const at = (text: string) => parseWhen(text, NOW)?.at;

describe("parseWhen", () => {
  it("bare hours mean the next time the clock shows them", () => {
    expect(at("at 8")).toEqual(new Date(2026, 10, 11, 20, 0));
    expect(at("at 10")).toEqual(new Date(2026, 10, 11, 10, 0));
    expect(at("at 8:30")).toEqual(new Date(2026, 10, 11, 20, 30));
  });

  it("am / pm", () => {
    expect(at("at 8pm")).toEqual(new Date(2026, 10, 11, 20, 0));
    expect(at("at 7 a.m.")).toEqual(new Date(2026, 10, 12, 7, 0));
    expect(at("3:15 pm")).toEqual(new Date(2026, 10, 11, 15, 15));
  });

  it("words", () => {
    expect(at("at noon")).toEqual(new Date(2026, 10, 11, 12, 0));
    expect(at("at eight o'clock")).toEqual(new Date(2026, 10, 11, 20, 0));
    expect(at("at 6 in the morning")).toEqual(new Date(2026, 10, 12, 6, 0));
    expect(at("tonight at 7")).toEqual(new Date(2026, 10, 11, 19, 0));
  });

  it("days", () => {
    expect(at("tomorrow")).toEqual(new Date(2026, 10, 12, 9, 0));
    expect(at("tomorrow at 3")).toEqual(new Date(2026, 10, 12, 15, 0));
    expect(at("tomorrow at 8")).toEqual(new Date(2026, 10, 12, 8, 0));
    expect(at("on friday at 2pm")).toEqual(new Date(2026, 10, 13, 14, 0));
    expect(at("wednesday")).toEqual(new Date(2026, 10, 18, 9, 0));
  });

  it("relative times", () => {
    expect(at("in 20 minutes")).toEqual(new Date(2026, 10, 11, 9, 20));
    expect(at("in an hour")).toEqual(new Date(2026, 10, 11, 10, 0));
    expect(at("in two hours")).toEqual(new Date(2026, 10, 11, 11, 0));
    expect(at("in half an hour")).toEqual(new Date(2026, 10, 11, 9, 30));
  });

  it("recurrence", () => {
    expect(parseWhen("every day at 9am", NOW)).toEqual({ at: new Date(2026, 10, 12, 9, 0), recurrence: "daily" });
    expect(parseWhen("every monday", NOW)?.recurrence).toBe("weekly");
  });

  it("returns null with no time words", () => {
    expect(parseWhen("take my pills", NOW)).toBeNull();
  });
});

describe("describeWhen", () => {
  it("says today / tomorrow / weekday", () => {
    expect(describeWhen(new Date(2026, 10, 11, 20, 0), NOW)).toBe("today at 8:00 PM");
    expect(describeWhen(new Date(2026, 10, 12, 9, 0), NOW)).toBe("tomorrow at 9:00 AM");
    expect(describeWhen(new Date(2026, 10, 13, 14, 0), NOW)).toBe("on Friday at 2:00 PM");
  });
});
