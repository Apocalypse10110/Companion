import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantRequest } from "@/contracts";
import { createAssistant } from "./assistant";
import type { AIProvider, InterpretResult } from "./providers/types";
import { forgetAllSkills, loadSkills, recordAttempt, recordSkill, skillLevel, skillsForPrompt } from "./skills";
import { cleanDocument, cleanScam, cleanStepCheck, cleanTarget } from "./target";

describe("skill levels: help fades, never disappears", () => {
  beforeEach(() => forgetAllSkills());

  it("goes from learning to learned only with independent finishes", () => {
    expect(skillLevel({ times: 0 })).toBe(1);
    expect(skillLevel({ times: 1 })).toBe(2);
    expect(skillLevel({ times: 4 })).toBe(3); // many finishes, but always told exactly
    expect(skillLevel({ times: 3, independent: 1 })).toBe(4);
    expect(skillLevel({ times: 5, independent: 3 })).toBe(5);
  });

  it("reads old records (no independent / attempts fields)", () => {
    localStorage.setItem("companion.skills.v1", JSON.stringify([{ name: "send a photo", times: 2, firstLearned: "2026-11-01T10:00:00Z", lastDone: "2026-11-02T10:00:00Z" }]));
    expect(skillsForPrompt()).toEqual(["send a photo (level 3, done 2 times)"]);
  });

  it("an attempt is tracked but not sent to the AI until finished", () => {
    recordAttempt("connect to wifi");
    expect(loadSkills()[0]).toMatchObject({ name: "connect to wifi", times: 0, attempts: 1 });
    expect(skillsForPrompt()).toEqual([]);
  });

  it("the first finish is never independent; later ones can be", () => {
    recordSkill("connect to wifi", new Date(), true);
    expect(loadSkills()[0].independent).toBe(0);
    recordSkill("connect to wifi", new Date(), true);
    expect(loadSkills()[0]).toMatchObject({ times: 2, independent: 1 });
  });
});

describe("the assistant records attempts and independence", () => {
  const req = (text: string, history: AssistantRequest["history"] = []): AssistantRequest => ({
    text,
    source: "text",
    history,
    language: "en-US",
    hints: { plainLanguage: true, willBeSpoken: false },
  });

  function setup(results: InterpretResult[], known: string[] = []) {
    const interpret = vi.fn<AIProvider["interpret"]>();
    results.forEach((r) => interpret.mockResolvedValueOnce(r));
    const record = vi.fn();
    const attempt = vi.fn();
    const assistant = createAssistant({ provider: { interpret }, skills: { list: () => known, record, attempt } });
    return { assistant, record, attempt };
  }

  it("counts one attempt per lesson in a conversation", async () => {
    const step = { intent: { name: "HELP", params: {} }, reply: "Open Settings.", skill: "connect to wifi" };
    const { assistant, attempt } = setup([step, step]);
    await assistant.send(req("how do I connect to wifi"));
    await assistant.send(req("done"));
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("a finish after 'Tell me exactly' is not independent", async () => {
    const { assistant, record } = setup([{ intent: { name: "HELP", params: {} }, reply: "Well done!", skill: "connect to wifi", taskDone: true }], ["connect to wifi (level 3, done 2 times)"]);
    await assistant.send(req("it works", [{ role: "user", text: "Tell me exactly" }, { role: "assistant", text: "Tap Wi-Fi." }]));
    expect(record).toHaveBeenCalledWith("connect to wifi", false);
  });

  it("a finish on their own, for a known task, is independent", async () => {
    const { assistant, record } = setup([{ intent: { name: "HELP", params: {} }, reply: "Well done!", skill: "connect to wifi", taskDone: true }], ["connect to wifi (level 3, done 2 times)"]);
    await assistant.send(req("it works", [{ role: "user", text: "how do I connect to wifi" }, { role: "assistant", text: "Do you remember?" }]));
    expect(record).toHaveBeenCalledWith("connect to wifi", true);
  });

  it("passes scam, step check and document through, and the mode to the AI", async () => {
    const interpret = vi.fn<AIProvider["interpret"]>().mockResolvedValue({
      intent: { name: "HELP", params: {} },
      reply: "Perfect. You're in Settings.",
      scam: { verdict: "safe", reasons: [] },
      stepCheck: "done",
    });
    const assistant = createAssistant({ provider: { interpret }, skills: { list: () => [], record: vi.fn() } });
    const r = await assistant.send({ ...req("check my step"), source: "photo", mode: "check", image: { mimeType: "image/jpeg", data: "A".repeat(200) } });
    expect(interpret.mock.calls[0][0].mode).toBe("check");
    expect(r.stepCheck).toBe("done");
    expect(r.scam?.verdict).toBe("safe");
  });

  it("a step check is ignored when the request wasn't a check", async () => {
    const interpret = vi.fn<AIProvider["interpret"]>().mockResolvedValue({ intent: { name: "HELP", params: {} }, reply: "Here.", stepCheck: "done" });
    const assistant = createAssistant({ provider: { interpret }, skills: { list: () => [], record: vi.fn() } });
    const r = await assistant.send({ ...req("help"), source: "photo", image: { mimeType: "image/jpeg", data: "A".repeat(200) } });
    expect(r.stepCheck).toBeUndefined();
  });
});

describe("validators for what the AI sends", () => {
  it("drops a ring the model isn't sure about, or a speck", () => {
    expect(cleanTarget({ label: "OK", box: [100, 100, 200, 200], confidence: "low" })).toBeNull();
    expect(cleanTarget({ label: "OK", box: [100, 100, 200, 200], confidence: "high" })).not.toBeNull();
    expect(cleanTarget({ label: "OK", box: [100, 100, 105, 110] })).toBeNull();
  });

  it("keeps scam reasons plain: no links, no long numbers", () => {
    expect(cleanScam("scam", ["Asks for a fee", "Visit http://evil.example", "Call 0800 123 4567 89", 5])).toEqual({ verdict: "scam", reasons: ["Asks for a fee"] });
    expect(cleanScam("definitely", [])).toBeNull();
    expect(cleanScam("unsure", undefined)).toEqual({ verdict: "unsure", reasons: [] });
  });

  it("step check only takes the three answers", () => {
    expect(cleanStepCheck("done")).toBe("done");
    expect(cleanStepCheck("yes")).toBeNull();
  });

  it("keeps only bill fields that look right", () => {
    expect(cleanDocument({ organization: "City Power", amount: "$84.20", dueDate: "2026-11-20", reference: "A-123", unclear: ["reference"] })).toEqual({
      organization: "City Power",
      amount: "$84.20",
      dueDate: "2026-11-20",
      reference: "A-123",
      unclear: ["reference"],
    });
    expect(cleanDocument({ organization: "X", amount: "pay now", dueDate: "20 Nov" })).toEqual({ organization: "X", unclear: [] });
    expect(cleanDocument({ unclear: [] })).toBeNull();
    expect(cleanDocument("nope")).toBeNull();
  });
});
