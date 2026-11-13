import { describe, expect, it, vi } from "vitest";
import type { AssistantRequest } from "@/contracts";
import { createAssistant, knowsSkill } from "./assistant";
import type { AIProvider, InterpretResult } from "./providers/types";
import { createRemoteProvider } from "./providers/remote";
import { handleAssistantRequest } from "./server/handler";
import { toRawIntent } from "./server/prompt";
import type { ServerInterpreter } from "./server/types";
import { cleanFamilyNote, cleanTarget } from "./target";

const IMAGE = { mimeType: "image/jpeg" as const, data: "A".repeat(200) };

describe("cleanTarget", () => {
  it("keeps a sensible box and rounds it", () => {
    expect(cleanTarget({ label: "Manage Storage", box: [600.4, 100, 680, 900] })).toEqual({ label: "Manage Storage", box: [600, 100, 680, 900] });
  });

  it("accepts numbers sent as strings", () => {
    expect(cleanTarget({ label: "OK", box: ["10", "10", "50", "50"] })?.box).toEqual([10, 10, 50, 50]);
  });

  it.each([
    ["no label", { box: [1, 1, 50, 50] }],
    ["three numbers", { label: "x", box: [1, 1, 50] }],
    ["out of range", { label: "x", box: [1, 1, 50, 1200] }],
    ["negative", { label: "x", box: [-5, 1, 50, 50] }],
    ["upside down", { label: "x", box: [500, 1, 100, 50] }],
    ["a dot", { label: "x", box: [100, 100, 101, 101] }],
    ["the whole photo", { label: "x", box: [0, 0, 1000, 1000] }],
    ["not numbers", { label: "x", box: ["a", 1, 50, 50] }],
    ["nothing", null],
  ])("drops %s", (_name, value) => {
    expect(cleanTarget(value)).toBeNull();
  });
});

describe("cleanFamilyNote", () => {
  it("keeps plain words", () => {
    expect(cleanFamilyNote("I got a text about a parcel. Companion thinks it's a scam.")).toBe(
      "I got a text about a parcel. Companion thinks it's a scam.",
    );
  });

  it("drops links and long numbers (codes, cards, phone numbers)", () => {
    expect(cleanFamilyNote("Look at https://evil.example")).toBeNull();
    expect(cleanFamilyNote("They asked for 4111 1111 1111 1111")).toBeNull();
    expect(cleanFamilyNote("Call 07700 900123")).toBeNull();
    expect(cleanFamilyNote("   ")).toBeNull();
  });
});

describe("knowsSkill", () => {
  it("matches the names the prompt list uses", () => {
    expect(knowsSkill(["connect to wifi (2 times)", "send a photo (once)"], "Send a photo")).toBe(true);
    expect(knowsSkill(["connect to wifi (2 times)"], "free up storage")).toBe(false);
    expect(knowsSkill([], undefined)).toBe(false);
  });
});

describe("tap here, end to end", () => {
  const answer = {
    intent: "HELP",
    params: {},
    reply: "This says your storage is full. Tap the grey button that says Manage Storage, at the bottom.",
    suggestions: ["Done", "Give me a hint"],
    skill: "free up storage",
    taskDone: false,
    target: { label: "Manage Storage", box: [820, 150, 880, 850] },
    familyNote: null,
  };

  it("the model's JSON keeps target through toRawIntent", () => {
    expect(toRawIntent(answer)?.target).toEqual(answer.target);
  });

  it("the server returns target only when a photo was sent", async () => {
    const interpreter: ServerInterpreter = { name: "t", interpret: vi.fn(async () => toRawIntent(answer)) };
    const post = (body: unknown) =>
      new Request("http://x/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    const withPhoto = await (await handleAssistantRequest(post({ text: "help", history: [], image: IMAGE }), interpreter)).json();
    expect(withPhoto.target).toEqual({ label: "Manage Storage", box: [820, 150, 880, 850] });

    const without = await (await handleAssistantRequest(post({ text: "help", history: [] }), interpreter)).json();
    expect(without.target).toBeNull();
  });

  it("the phone drops a bad box from the server", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ intent: { name: "HELP", params: {} }, reply: "Hi", target: { label: "x", box: [0, 0, 2000, 5] } }));
    const out = await createRemoteProvider("/api", fetchImpl as unknown as typeof fetch).interpret({ text: "hi", history: [], language: "en", now: "2026-11-12T10:00:00Z" });
    expect(out?.target).toBeUndefined();
  });

  function setup(result: Partial<InterpretResult>, known: string[] = []) {
    const provider: AIProvider = { interpret: vi.fn(async () => ({ intent: { name: "HELP", params: {} }, reply: "Tap Manage Storage.", ...result })) };
    const record = vi.fn();
    const assistant = createAssistant({ provider, skills: { list: () => known, record } });
    const req: AssistantRequest = {
      text: "Can you look at this photo and help me with it?",
      source: "photo",
      image: IMAGE,
      history: [],
      language: "en-US",
      hints: { plainLanguage: true, willBeSpoken: true },
    };
    return { send: () => assistant.send(req), record };
  }

  it("the first time, the ring is shown", async () => {
    const r = await setup({ skill: "free up storage", target: answer.target }).send();
    expect(r.pointAt).toEqual({ label: "Manage Storage", box: [820, 150, 880, 850] });
  });

  it("a task done before starts with the ring hidden (help that fades)", async () => {
    const r = await setup({ skill: "free up storage", target: answer.target, suggestions: ["Give me a hint", "I found it"] }, ["free up storage (once)"]).send();
    expect(r.pointAt).toMatchObject({ label: "Manage Storage", hidden: true });
    // "Show me where" on the photo replaces the hint suggestions.
    expect(r.suggestions).toEqual(["I found it"]);
  });

  it("finishing the task now doesn't hide the ring", async () => {
    const known: string[] = [];
    const { send, record } = setup({ skill: "free up storage", taskDone: true, target: answer.target }, known);
    const r = await send();
    expect(record).toHaveBeenCalledWith("free up storage", false);
    expect(r.pointAt?.hidden).toBeUndefined();
  });

  it("passes the family note along with a photo reply", async () => {
    const r = await setup({ familyNote: "I got a scam text. I didn't tap anything." }).send();
    expect(r.familyNote).toBe("I got a scam text. I didn't tap anything.");
  });
});
