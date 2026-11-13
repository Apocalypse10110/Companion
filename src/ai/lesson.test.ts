import { describe, expect, it, vi } from "vitest";
import { createAssistant } from "./assistant";
import type { AIProvider } from "./providers/types";

function assistantWith(result: Record<string, unknown>, learned: string[] = []) {
  const record = vi.fn();
  const provider: AIProvider = { interpret: async () => ({ intent: { name: "HELP", params: {} }, reply: "First, open Settings, the grey gear. Settings is where your phone keeps its switches.", ...result }) };
  const a = createAssistant({ provider, skills: { list: () => learned, record } });
  const ask = (text: string) => a.send({ text, source: "text", history: [], language: "en-GB", hints: { plainLanguage: true, willBeSpoken: false } });
  return { ask, record };
}

describe("teaching is visible from the first time", () => {
  it("first time: a 'Teaching you' lesson, with 'Let me try it myself' offered", async () => {
    const { ask } = assistantWith({ skill: "connect to wifi", suggestions: ["Done", "I can't find it"] });
    const r = await ask("how do I connect to wifi");
    expect(r.lesson).toEqual({ skill: "connect to wifi", stage: "new" });
    expect(r.suggestions).toEqual(["Done", "I can't find it", "Let me try it myself"]);
  });

  it("a task they've done before: 'practice' (try it yourself)", async () => {
    const { ask } = assistantWith({ skill: "connect to wifi", suggestions: ["Give me a hint", "Tell me exactly"] }, ["connect to wifi (once)"]);
    const r = await ask("how do I connect to wifi");
    expect(r.lesson).toEqual({ skill: "connect to wifi", stage: "practice" });
    expect(r.suggestions).not.toContain("Let me try it myself");
  });

  it("finishing the task: 'learned', and it's recorded", async () => {
    const { ask, record } = assistantWith({ skill: "connect to wifi", taskDone: true, reply: "Well done! You can do this on your own now." });
    const r = await ask("it says connected!");
    expect(r.lesson).toEqual({ skill: "connect to wifi", stage: "learned" });
    expect(record).toHaveBeenCalledWith("connect to wifi");
  });

  it("no lesson for ordinary questions or actions", async () => {
    const { ask } = assistantWith({});
    expect((await ask("what is the capital of France")).lesson).toBeUndefined();
    expect((await ask("call my daughter")).lesson).toBeUndefined();
  });
});
