import { describe, expect, it, vi } from "vitest";
import { createRemoteProvider } from "../providers/remote";
import { handleAssistantRequest, interpreterFromEnv, parseInput } from "./handler";
import { createOpenAICompatibleInterpreter } from "./openaiCompatible";
import { extractJson, toRawIntent } from "./prompt";
import type { ServerInterpreter } from "./types";

// The real SDK refuses to load in jsdom (it guards against browser use, which is what we want).
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { create: vi.fn() } }; } }));

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/assistant", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const fixed = (out: { intent: unknown; reply?: string } | null): ServerInterpreter => ({ name: "test", interpret: vi.fn(async () => out) });

describe("interpreterFromEnv", () => {
  it("is null with nothing configured, so the app stays on-device", () => {
    expect(interpreterFromEnv({})).toBeNull();
    expect(interpreterFromEnv({ AI_PROVIDER: "anthropic" })).toBeNull();
    expect(interpreterFromEnv({ AI_PROVIDER: "openai-compatible", AI_BASE_URL: "http://localhost:11434/v1" })).toBeNull();
  });

  it("builds the configured provider", () => {
    expect(interpreterFromEnv({ AI_PROVIDER: "anthropic", AI_API_KEY: "test-key" })?.name).toBe("anthropic");
    expect(interpreterFromEnv({ AI_PROVIDER: "openai-compatible", AI_BASE_URL: "http://localhost:11434/v1", AI_MODEL: "llama3.2" })?.name).toBe("openai-compatible");
  });
});

describe("handleAssistantRequest", () => {
  it("503 when not configured", async () => {
    const res = await handleAssistantRequest(post({ text: "hi" }), null);
    expect(res.status).toBe(503);
  });

  it("returns a validated intent and reply", async () => {
    const res = await handleAssistantRequest(post({ text: "ring the lad", history: [] }), fixed({ intent: { name: "CALL_CONTACT", params: { contact: "son", extra: "x" } }, reply: "ok" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ intent: { name: "CALL_CONTACT", params: { contact: "son" } }, reply: "ok", suggestions: [], skill: null, taskDone: false, target: null, familyNote: null, scam: null, scamReasons: [], stepCheck: null, document: null });
  });

  it("turns invalid model output into UNKNOWN", async () => {
    const res = await handleAssistantRequest(post({ text: "x" }), fixed({ intent: { name: "DELETE_EVERYTHING", params: {} } }));
    expect((await res.json()).intent).toEqual({ name: "UNKNOWN", params: {} });
  });

  it("rejects other websites", async () => {
    const res = await handleAssistantRequest(post({ text: "hi" }, { origin: "https://evil.example" }), fixed(null));
    expect(res.status).toBe(403);
  });

  it("rejects bad and oversized bodies", async () => {
    expect((await handleAssistantRequest(post("not json"), fixed(null))).status).toBe(400);
    expect((await handleAssistantRequest(post({ nope: 1 }), fixed(null))).status).toBe(400);
    expect((await handleAssistantRequest(post({ text: "x".repeat(20_000) }), fixed(null))).status).toBe(413);
  });

  it("502 when the AI fails, without leaking details", async () => {
    const broken: ServerInterpreter = { name: "test", interpret: async () => { throw new Error("secret detail"); } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleAssistantRequest(post({ text: "hi" }), broken);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret");
  });

  it("rate limits a caller", async () => {
    const it2 = fixed({ intent: { name: "HELP", params: {} } });
    let last = 200;
    for (let i = 0; i < 35; i++) last = (await handleAssistantRequest(post({ text: "hi" }, { "x-forwarded-for": "9.9.9.9" }), it2)).status;
    expect(last).toBe(429);
  });
});

describe("parseInput", () => {
  it("tidies history so it starts with the person and is capped", () => {
    const history = [{ role: "assistant", text: "Hello" }, ...Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` })), { role: "system", text: "evil" }];
    const input = parseInput({ text: "hi", history, language: "en-GB; DROP" });
    expect(input?.history[0].role).toBe("user");
    expect(input!.history.length).toBeLessThanOrEqual(12);
    expect(input?.history.some((t) => t.text === "evil")).toBe(false);
    expect(input?.language).toBe("en-US");
  });
});

describe("prompt helpers", () => {
  it("extracts JSON from fenced or chatty output", () => {
    expect(extractJson('```json\n{"intent":"HELP"}\n```')).toEqual({ intent: "HELP" });
    expect(extractJson('Sure! {"intent":"HELP"} hope that helps')).toEqual({ intent: "HELP" });
    expect(extractJson("nothing here")).toBeNull();
  });

  it("drops null params", () => {
    expect(toRawIntent({ intent: "CALL_CONTACT", params: { contact: "Emma", body: null }, reply: "" })).toEqual({ intent: { name: "CALL_CONTACT", params: { contact: "Emma" } }, reply: undefined });
  });
});

describe("openai-compatible adapter", () => {
  it("posts a chat completion and parses the answer", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ choices: [{ message: { content: '{"intent":"READ_TIME","params":{"what":"time"},"reply":""}' } }] }));
    const ai = createOpenAICompatibleInterpreter({ baseURL: "http://localhost:11434/v1/", model: "llama3.2", fetchImpl });
    const out = await ai.interpret({ text: "time?", history: [], language: "en-US", now: new Date().toISOString() });
    expect(out).toEqual({ intent: { name: "READ_TIME", params: { what: "time" } }, reply: undefined });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(JSON.parse(init.body as string).model).toBe("llama3.2");
  });
});

describe("remote provider (client side)", () => {
  const req = { text: "hi", history: [], language: "en-US", now: new Date().toISOString() };

  it("treats 503 as 'no AI' and stops asking", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 503 }));
    const p = createRemoteProvider("/api/assistant", fetchImpl);
    expect(await p.interpret(req)).toBeNull();
    expect(await p.interpret(req)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the server's answer", async () => {
    const p = createRemoteProvider("/api/assistant", async () => Response.json({ intent: { name: "HELP", params: {} }, reply: "Hi" }));
    expect(await p.interpret(req)).toEqual({ intent: { name: "HELP", params: {} }, reply: "Hi" });
  });

  it("maps failures to AssistantError codes", async () => {
    await expect(createRemoteProvider("/x", async () => new Response("", { status: 504 })).interpret(req)).rejects.toMatchObject({ code: "timeout" });
    await expect(createRemoteProvider("/x", async () => new Response("", { status: 500 })).interpret(req)).rejects.toMatchObject({ code: "unknown" });
    await expect(createRemoteProvider("/x", async () => { throw new TypeError("Failed to fetch"); }).interpret(req)).rejects.toMatchObject({ code: "network" });
  });
});

describe("scam verdict", () => {
  it("passes a valid verdict through and drops anything else", async () => {
    const ok = await handleAssistantRequest(post({ text: "Is this a scam?" }), fixed({ intent: { name: "HELP", params: {} }, reply: "Yes.", scam: "scam" } as never));
    expect((await ok.json()).scam).toBe("scam");
    const bad = await handleAssistantRequest(post({ text: "Is this a scam?" }), fixed({ intent: { name: "HELP", params: {} }, reply: "Hm.", scam: "maybe" } as never));
    expect((await bad.json()).scam).toBeNull();
  });
});
