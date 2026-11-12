/**
 * The `/api/assistant` request handler, kept out of `src/app` so it can be tested.
 * It holds the AI key on the server, limits what callers can send, and returns
 * a validated intent. Server-only. Owner: Developer B.
 */

import type { AssistantTurn } from "@/contracts";
import { cleanString, validateIntent } from "../intents/schema";
import { createAnthropicInterpreter } from "./anthropic";
import { createOpenAICompatibleInterpreter } from "./openaiCompatible";
import type { InterpretInput, ServerInterpreter } from "./types";

export interface AIEnv {
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  [name: string]: string | undefined;
}

let cached: { key: string; value: ServerInterpreter | null } | null = null;

/** Build (once) the configured AI adapter, or null if none is configured. */
export function interpreterFromEnv(env: AIEnv): ServerInterpreter | null {
  const key = [env.AI_PROVIDER, env.AI_API_KEY, env.AI_MODEL, env.AI_BASE_URL, env.ANTHROPIC_API_KEY].join("\u0000");
  if (cached?.key !== key) cached = { key, value: buildInterpreter(env) };
  return cached.value;
}

function buildInterpreter(env: AIEnv): ServerInterpreter | null {
  const provider = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "anthropic") {
    const apiKey = env.AI_API_KEY || env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return createAnthropicInterpreter({ apiKey, model: env.AI_MODEL, baseURL: env.AI_BASE_URL });
  }
  if (provider === "openai-compatible" || provider === "openai") {
    const baseURL = env.AI_BASE_URL || (provider === "openai" ? "https://api.openai.com/v1" : "");
    if (!baseURL || !env.AI_MODEL) return null;
    return createOpenAICompatibleInterpreter({ baseURL, apiKey: env.AI_API_KEY, model: env.AI_MODEL });
  }
  return null;
}

const MAX_BODY = 16_000;
const MAX_HISTORY = 12;
const TIMEOUT_MS = 20_000;
const RATE_LIMIT = 30; // requests per minute per caller
const hits = new Map<string, number[]>();

function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > RATE_LIMIT;
}

/** Check and tidy the request body. Returns null if it isn't usable. */
export function parseInput(body: unknown): InterpretInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const text = cleanString(b.text, 1_000);
  if (!text) return null;
  const history: AssistantTurn[] = [];
  if (Array.isArray(b.history)) {
    for (const t of b.history.slice(-MAX_HISTORY)) {
      if (!t || typeof t !== "object") continue;
      const role = (t as AssistantTurn).role;
      const turnText = cleanString((t as AssistantTurn).text, 1_000);
      if ((role === "user" || role === "assistant") && turnText) history.push({ role, text: turnText });
    }
  }
  // Conversations sent to the model must start with the person.
  while (history.length && history[0].role !== "user") history.shift();
  const now = typeof b.now === "string" && !Number.isNaN(Date.parse(b.now)) ? b.now.slice(0, 40) : new Date().toISOString();
  const language = typeof b.language === "string" && /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(b.language) ? b.language : "en-US";
  return { text, history, language, now, lastAssistantText: cleanString(b.lastAssistantText, 1_000) };
}

const json = (status: number, data: unknown) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function handleAssistantRequest(
  request: Request,
  interpreter: ServerInterpreter | null,
): Promise<Response> {
  if (!interpreter) return json(503, { error: "not-configured" });

  // Only this app's own pages may use the key.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json(403, { error: "forbidden" });
    } catch {
      return json(403, { error: "forbidden" });
    }
  }

  const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(caller)) return json(429, { error: "too-many-requests" });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: "too-large" });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad-request" });
  }
  const input = parseInput(body);
  if (!input) return json(400, { error: "bad-request" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  request.signal?.addEventListener("abort", () => controller.abort());
  try {
    const result = await interpreter.interpret(input, controller.signal);
    const intent = result ? validateIntent(result.intent) : null;
    return json(200, { intent: intent ?? { name: "UNKNOWN", params: {} }, reply: cleanString(result?.reply, 600) ?? null });
  } catch (err) {
    if (controller.signal.aborted) return json(504, { error: "timeout" });
    console.error(`[assistant] ${interpreter.name} failed:`, err instanceof Error ? err.message : err);
    return json(502, { error: "ai-failed" });
  } finally {
    clearTimeout(timer);
  }
}
