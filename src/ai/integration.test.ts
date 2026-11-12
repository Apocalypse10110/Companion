/**
 * Integration tests (Developer C): Gemini adapter, provider selection, and the assistant using the
 * AI for conversation (step-by-step tech help) while keeping clear actions on the device.
 */
import { describe, expect, it, vi } from "vitest";
import { AssistantError, type AssistantReply, type AssistantRequest, type AssistantTurn } from "@/contracts";
import { createAssistant } from "./assistant";
import type { AIProvider, InterpretRequest } from "./providers/types";
import { createRemoteProvider } from "./providers/remote";
import { classifyGeminiError, createGeminiInterpreter, parseModelList } from "./server/gemini";
import { assistantStatus, handleAssistantRequest, interpreterFromEnv, providerName } from "./server/handler";
import { ProviderError } from "./server/types";

vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { create: vi.fn() } }; } }));

const NOW = new Date(2026, 10, 11, 9, 0, 0);
const input = { text: "My wifi won't work", history: [], language: "en-US", now: NOW.toISOString() };

function fakeClient(answers: Array<unknown>) {
  const calls: Array<{ model: string }> = [];
  const generateContent = vi.fn(async (req: { model: string }) => {
    calls.push({ model: req.model });
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return { text: JSON.stringify(next) };
  });
  return { client: { models: { generateContent } } as never, calls };
}

const httpError = (status: number, message = "x") => Object.assign(new Error(message), { status });

describe("Gemini adapter", () => {
  it("returns the model's intent, reply and suggestions", async () => {
    const { client } = fakeClient([{ intent: "HELP", params: { topic: "wifi" }, reply: "Let's fix it. First, open Settings.", suggestions: ["I see it"] }]);
    const ai = createGeminiInterpreter({ apiKey: "k", client });
    expect(await ai.interpret(input)).toEqual({
      intent: { name: "HELP", params: { topic: "wifi" } },
      reply: "Let's fix it. First, open Settings.",
      suggestions: ["I see it"],
    });
  });

  it("falls back to the next model when one is overloaded", async () => {
    const { client, calls } = fakeClient([httpError(503), { intent: "HELP", reply: "ok" }]);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ai = createGeminiInterpreter({ apiKey: "k", client, models: ["a", "b"] });
    expect((await ai.interpret(input))?.reply).toBe("ok");
    expect(calls.map((c) => c.model)).toEqual(["a", "b"]);
  });

  it("stops at once on a bad key", async () => {
    const { client, calls } = fakeClient([httpError(400, "API key not valid. Please pass a valid API key."), { intent: "HELP" }]);
    const ai = createGeminiInterpreter({ apiKey: "bad", client, models: ["a", "b"] });
    await expect(ai.interpret(input)).rejects.toMatchObject({ code: "auth" });
    expect(calls).toHaveLength(1);
  });

  it("reports unavailable when every model fails", async () => {
    const { client } = fakeClient([httpError(503), httpError(429)]);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ai = createGeminiInterpreter({ apiKey: "k", client, models: ["a", "b"] });
    await expect(ai.interpret(input)).rejects.toBeInstanceOf(ProviderError);
  });

  it("classifies errors without leaking details", () => {
    expect(classifyGeminiError(httpError(429)).code).toBe("rate-limit");
    expect(classifyGeminiError(httpError(403)).code).toBe("auth");
    expect(classifyGeminiError(new TypeError("fetch failed")).code).toBe("unavailable");
  });

  it("reads a comma-separated model list", () => {
    expect(parseModelList(" a, b ,")).toEqual(["a", "b"]);
    expect(parseModelList(undefined).length).toBeGreaterThan(0);
  });
});

describe("provider selection", () => {
  it("uses Gemini by default when GEMINI_API_KEY is set", () => {
    expect(providerName({ GEMINI_API_KEY: "k" })).toBe("gemini");
    expect(interpreterFromEnv({ GEMINI_API_KEY: "k" })?.name).toBe("gemini");
    expect(interpreterFromEnv({ AI_PROVIDER: "gemini" })).toBeNull();
  });

  it("status never includes the key", async () => {
    const res = assistantStatus({ GEMINI_API_KEY: "secret-key-123" });
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ configured: true, provider: "gemini", problem: null });
    expect(text).not.toContain("secret");
    expect(await assistantStatus({ AI_PROVIDER: "gemini" }).json()).toMatchObject({ configured: false, problem: "missing-key" });
  });

  it("answers a bad key with 503 ai-auth so the phone falls back to on-device", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleAssistantRequest(
      new Request("http://localhost/api/assistant", { method: "POST", body: JSON.stringify({ text: "hi" }) }),
      { name: "t", interpret: async () => { throw new ProviderError("auth"); } },
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "ai-auth" });
  });

  it("the client remembers why there's no AI", async () => {
    const p = createRemoteProvider("/x", async () => Response.json({ error: "ai-auth" }, { status: 503 }));
    expect(await p.interpret(input)).toBeNull();
    expect(p.unavailableReason?.()).toBe("ai-auth");
  });
});

function setup(provider?: AIProvider) {
  let n = 0;
  const assistant = createAssistant({ provider, now: () => NOW, newId: () => `id${++n}` });
  const history: AssistantTurn[] = [];
  async function say(text: string, extra: Partial<AssistantRequest> = {}): Promise<AssistantReply> {
    const reply = await assistant.send({
      text,
      source: "text",
      history: [...history],
      language: "en-US",
      hints: { plainLanguage: true, willBeSpoken: true },
      ...extra,
    });
    history.push({ role: "user", text }, { role: "assistant", text: reply.text });
    return reply;
  }
  return { say };
}

describe("assistant with an AI: tech support", () => {
  it("sends help questions to the AI and shows its step and suggestions", async () => {
    const interpret = vi.fn(async () => ({ intent: { name: "HELP", params: {} }, reply: "Let's get your Wi-Fi working. First, open Settings.", suggestions: ["I see it", "I can't find it"] }));
    const { say } = setup({ interpret });
    const r = await say("help me with my phone, the wifi isn't working");
    expect(interpret).toHaveBeenCalledTimes(1);
    expect(r.text).toBe("Let's get your Wi-Fi working. First, open Settings.");
    expect(r.suggestions).toEqual(["I see it", "I can't find it"]);
    expect(r.proposedActions).toBeUndefined();
  });

  it("a 'yes' during help goes to the AI with the conversation so far", async () => {
    const interpret = vi.fn(async (req: InterpretRequest) => ({
      intent: { name: "HELP", params: {} },
      reply: req.history.length ? "Good. Now tap Wi-Fi." : "First, open Settings. Tell me when it's open.",
    }));
    const { say } = setup({ interpret });
    await say("how do I connect to wifi");
    const r = await say("yes");
    expect(r.text).toBe("Good. Now tap Wi-Fi.");
    expect(interpret.mock.calls[1][0].history).toHaveLength(2);
  });

  it("keeps clear actions on the device (no AI call)", async () => {
    const interpret = vi.fn();
    const { say } = setup({ interpret });
    const r = await say("Call my daughter");
    expect(interpret).not.toHaveBeenCalled();
    expect(r.proposedActions?.[0].kind).toBe("call");
  });

  it("'yes' after an offer is still a confirmation, not sent to the AI", async () => {
    const interpret = vi.fn();
    const { say } = setup({ interpret });
    await say("Call my daughter");
    const r = await say("yes");
    expect(interpret).not.toHaveBeenCalled();
    expect(r.text).toContain("Yes, do it");
  });

  it("is honest when the AI is down", async () => {
    const { say } = setup({ interpret: async () => { throw new AssistantError("unknown", "busy"); } });
    const r = await say("What is the capital of France?");
    expect(r.text).toContain("can't reach my online helper");
  });

  it("says so when the server's AI key was refused", async () => {
    const { say } = setup({ interpret: async () => null, unavailableReason: () => "ai-auth" });
    const r = await say("What is the capital of France?");
    expect(r.text).toContain("can't reach my online helper");
  });

  it("explains how to find apps a web app can't open", async () => {
    const { say } = setup();
    const r = await say("open the camera");
    expect(r.proposedActions).toBeUndefined();
    expect(r.text).toContain("Camera");
  });
});

describe("Show me (photos) and help that fades", () => {
  const photo = { mimeType: "image/jpeg" as const, data: "A".repeat(200) };

  it("sends a photo to the AI, never to the rules, with what they've learned", async () => {
    const interpret = vi.fn(async () => ({ intent: { name: "HELP", params: {} }, reply: "This says your storage is full. First, open Settings.", suggestions: ["Give me a hint"] }));
    const assistant = createAssistant({ provider: { interpret }, skills: { list: () => ["connect to wifi (once)"], record: vi.fn() } });
    const r = await assistant.send({ text: "Call my daughter", source: "photo", image: photo, history: [], language: "en-US", hints: { plainLanguage: true, willBeSpoken: false } });
    expect(r.text).toContain("storage is full");
    expect(r.proposedActions).toBeUndefined();
    expect((interpret.mock.calls[0] as unknown[])[0]).toMatchObject({ image: photo, skills: ["connect to wifi (once)"] });
  });

  it("is honest when no AI can look at the photo", async () => {
    const assistant = createAssistant({ provider: { interpret: async () => null }, skills: { list: () => [], record: vi.fn() } });
    const r = await assistant.send({ text: "help", source: "photo", image: photo, history: [], language: "en-US", hints: { plainLanguage: true, willBeSpoken: false } });
    expect(r.text).toContain("can't look at photos");
  });

  it("records a finished task so next time it can let them try first", async () => {
    const record = vi.fn();
    const interpret = vi.fn(async () => ({ intent: { name: "HELP", params: {} }, reply: "You did it!", skill: "connect to wifi", taskDone: true }));
    const assistant = createAssistant({ provider: { interpret }, skills: { list: () => [], record } });
    await assistant.send({ text: "done, it works", source: "text", history: [], language: "en-US", hints: { plainLanguage: true, willBeSpoken: false } });
    expect(record).toHaveBeenCalledWith("connect to wifi");
  });

  it("the server only accepts real, small images", async () => {
    const { parseImage } = await import("./server/handler");
    expect(parseImage(photo)).toEqual(photo);
    expect(parseImage({ mimeType: "image/gif", data: photo.data })).toBeUndefined();
    expect(parseImage({ mimeType: "image/jpeg", data: "not base64!" + "A".repeat(200) })).toBeUndefined();
  });

  it("the skill record keeps plain names and counts", async () => {
    const { recordSkill, loadSkills, skillsForPrompt, forgetAllSkills } = await import("./skills");
    forgetAllSkills();
    recordSkill("Connect to WiFi");
    recordSkill("connect to wifi");
    expect(recordSkill("<script>")).toBeNull();
    expect(loadSkills()[0]).toMatchObject({ name: "connect to wifi", times: 2 });
    expect(skillsForPrompt()).toEqual(["connect to wifi (2 times)"]);
  });
});

describe("privacy: phone numbers never leave the phone", () => {
  it("redacts numbers but keeps times and short numbers", async () => {
    const { redactPhoneNumbers } = await import("./providers/redact");
    expect(redactPhoneNumbers("call 07700 900123 or +44 (0)20 7946-0958 at 8:30")).toBe("call [phone number] or [phone number] at 8:30");
    expect(redactPhoneNumbers("remind me in 20 minutes, in 2026")).toBe("remind me in 20 minutes, in 2026");
  });
  it("the remote provider sends redacted text and history", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ intent: { name: "HELP", params: {} }, reply: "ok" }));
    const p = createRemoteProvider("/x", fetchImpl);
    await p.interpret({ ...input, text: "my number is 0123 456 7890", history: [{ role: "user", text: "text 07700900123" }] });
    const body = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
    expect(body).not.toMatch(/0123 456 7890|07700900123/);
  });
});
