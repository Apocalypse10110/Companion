import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposedAction } from "@/contracts";
import { createAssistant } from "@/ai/assistant";
import { classify } from "@/ai/intents/rules";
import { validateIntent } from "@/ai/intents/schema";
import { createActionService } from "@/actions";
import { describeWeather, weatherReport } from "@/actions/weather";
import { addPerson } from "@/people/store";

const intent = (s: string) => validateIntent(classify(s));
const act = (kind: string, params: Record<string, unknown>): ProposedAction => ({ id: "a", kind, title: "t", risk: "low", params });

beforeEach(() => localStorage.clear());

describe("understanding", () => {
  it("weather, with a place and a day", () => {
    expect(intent("what's the weather like")).toEqual({ name: "CHECK_WEATHER", params: { when: "today" } });
    expect(intent("will it rain tomorrow in Seattle")).toEqual({ name: "CHECK_WEATHER", params: { when: "tomorrow", query: "seattle" } });
    expect(intent("what's the weather in New York today")).toEqual({ name: "CHECK_WEATHER", params: { when: "today", query: "new york" } });
  });

  it("FaceTime and video calls", () => {
    expect(intent("facetime my son")).toEqual({ name: "CALL_CONTACT", params: { contact: "son", video: true } });
    expect(intent("video call my daughter")).toEqual({ name: "CALL_CONTACT", params: { contact: "daughter", video: true } });
    expect(intent("call my daughter")).toEqual({ name: "CALL_CONTACT", params: { contact: "daughter" } });
  });
});

describe("what the assistant offers", () => {
  const say = (text: string) =>
    createAssistant({ skills: { list: () => [], record: () => {} } }).send({ text, source: "text", history: [], language: "en-US", hints: { plainLanguage: true, willBeSpoken: false } });

  it("weather is a real check now, not 'open the browser'", async () => {
    const r = await say("will it rain tomorrow in Seattle");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "weather", risk: "low", params: { when: "tomorrow", place: "Seattle" }, title: "Check tomorrow's weather in Seattle" });
  });

  it("FaceTime is offered as a FaceTime call, always confirmed", async () => {
    const r = await say("FaceTime my son");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "call", risk: "high", title: "FaceTime your son", params: { contact: "son", video: true } });
  });
});

describe("FaceTime action", () => {
  it("opens FaceTime with the number on iPhone", async () => {
    addPerson({ name: "Tom", phone: "07700 900456", relationship: "son" });
    const launch = vi.fn();
    const r = await createActionService({ launch, os: () => "ios" }).execute(act("call", { contact: "son", video: true }));
    expect(launch).toHaveBeenCalledWith("facetime:07700900456");
    expect(r.ok).toBe(true);
    expect(r.message).toContain("FaceTime");
  });

  it("on Android it explains and dials nothing", async () => {
    addPerson({ name: "Tom", phone: "07700 900456", relationship: "son" });
    const launch = vi.fn();
    const r = await createActionService({ launch, os: () => "android" }).execute(act("call", { contact: "son", video: true }));
    expect(launch).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/FaceTime only works on iPhones/);
  });
});

describe("weather", () => {
  const forecast = {
    current: { temperature_2m: 53.6, weather_code: 61, wind_speed_10m: 9.2 },
    daily: { temperature_2m_max: [57.9, 60.1], temperature_2m_min: [46.2, 48], precipitation_probability_max: [80, 20], weather_code: [61, 2] },
  };
  const fetchFor = (geo?: unknown) =>
    vi.fn(async (url: string | URL | Request) =>
      String(url).includes("geocoding") ? Response.json(geo ?? { results: [{ name: "Seattle", latitude: 47.6062, longitude: -122.3321 }] }) : Response.json(forecast),
    ) as unknown as typeof fetch;

  it("today, for a named place, in plain words", async () => {
    const r = await weatherReport({ place: "seattle", when: "today" }, { fetch: fetchFor(), language: "en-US" });
    expect(r).toEqual({
      ok: true,
      message: "Right now in Seattle it's 54 degrees with light rain. Today's high is 58 and the low is 46, with an 80% chance of rain. You may want an umbrella.",
    });
  });

  it("tomorrow, where you are (location rounded before it leaves the phone)", async () => {
    const f = fetchFor();
    const locate = vi.fn(async () => ({ latitude: 47.606209, longitude: -122.332071 }));
    const r = await weatherReport({ when: "tomorrow" }, { fetch: f, language: "en-GB", locate });
    expect(r.message).toBe("Tomorrow where you are: partly cloudy, with a high of 60 and a low of 48, and a 20% chance of rain.");
    const url = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(url).toContain("latitude=47.61&longitude=-122.33");
    expect(url).toContain("temperature_unit=celsius");
  });

  it("is honest when it can't know where you are", async () => {
    const locate = vi.fn(async () => {
      throw Object.assign(new Error("denied"), { code: 1 });
    });
    const r = await weatherReport({ when: "today" }, { fetch: fetchFor(), language: "en-US", locate });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('"what\'s the weather in');
  });

  it("is honest about a place it can't find", async () => {
    const r = await weatherReport({ place: "Narnia", when: "today" }, { fetch: fetchFor({ results: [] }), language: "en-US" });
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toContain("couldn't find Narnia");
  });

  it("describes weather codes simply", () => {
    expect(describeWeather(0)).toBe("clear skies");
    expect(describeWeather(95)).toBe("thunderstorms");
    expect(describeWeather(1234)).toBe("mixed weather");
  });
});
