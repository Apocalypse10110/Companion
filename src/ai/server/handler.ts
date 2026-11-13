/**
 * The `/api/assistant` request handler, kept out of `src/app` so it can be tested.
 * It holds the AI key on the server, limits what callers can send, and returns
 * a validated intent. Server-only. Owner: Developer B.
 */

import type { AssistantImage, AssistantTurn } from "@/contracts";
import { cleanString, validateIntent } from "../intents/schema";
import { cleanDocument, cleanFamilyNote, cleanScam, cleanStepCheck, cleanTarget } from "../target";
import { createAnthropicInterpreter } from "./anthropic";
import { createGeminiInterpreter, parseModelList } from "./gemini";
import { createOpenAICompatibleInterpreter } from "./openaiCompatible";
import { ProviderError, type InterpretInput, type ServerInterpreter } from "./types";

export interface AIEnv {
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  [name: string]: string | undefined;
}

let cached: { key: string; value: ServerInterpreter | null } | null = null;

/** Build (once) the configured AI adapter, or null if none is configured. */
export function interpreterFromEnv(env: AIEnv): ServerInterpreter | null {
  const key = [env.AI_PROVIDER, env.AI_API_KEY, env.AI_MODEL, env.AI_BASE_URL, env.ANTHROPIC_API_KEY].join("\u0000");
  if (cached?.key !== key) cached = { key, value: buildInterpreter(env) };
  return cached.value;
}

/**
 * Which provider the server will use. AI_PROVIDER picks one explicitly; with it empty, Gemini is
 * used whenever GEMINI_API_KEY is set (Gemini is the default testing provider).
 */
export function providerName(env: AIEnv): string {
  const explicit = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  return env.GEMINI_API_KEY ? "gemini" : "";
}

function buildInterpreter(env: AIEnv): ServerInterpreter | null {
  const provider = providerName(env);
  if (provider === "gemini" || provider === "google") {
    const apiKey = env.GEMINI_API_KEY || env.AI_API_KEY;
    if (!apiKey) return null;
    return createGeminiInterpreter({ apiKey, models: parseModelList(env.AI_MODEL) });
  }
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
/** A photo is shrunk on the phone first (about 150 KB). This leaves room, under Vercel's 4.5 MB limit. */
const MAX_IMAGE_CHARS = 1_400_000;
const MAX_BODY_WITH_IMAGE = MAX_IMAGE_CHARS + MAX_BODY;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** A photo, if the body has a usable one. Checks the type and that the data really is base64. */
export function parseImage(value: unknown): AssistantImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as { mimeType?: unknown; data?: unknown };
  const mimeType = IMAGE_TYPES.find((t) => t === v.mimeType);
  if (!mimeType || typeof v.data !== "string") return undefined;
  if (v.data.length < 100 || v.data.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(v.data)) return undefined;
  return { mimeType, data: v.data };
}
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
  const skills = Array.isArray(b.skills)
    ? b.skills
        .map((s) => cleanString(s, 60))
        .filter((s): s is string => Boolean(s))
        .slice(0, 20)
    : [];
  const image = parseImage(b.image);
  const mode = b.mode === "check" || b.mode === "scam" || b.mode === "document" ? b.mode : undefined;
  return {
    text,
    history,
    language,
    now,
    lastAssistantText: cleanString(b.lastAssistantText, 1_000),
    ...(image ? { image } : {}),
    ...(skills.length ? { skills } : {}),
    ...(mode ? { mode } : {}),
    ...(b.detail === "short" || b.detail === "detailed" ? { detail: b.detail } : {}),
  };
}

/** A task name is shown on screen and kept on the phone, so it must be short plain words. */
function cleanSkill(value: unknown): string | null {
  const s = cleanString(value, 40)?.toLowerCase();
  return s && /^[\p{L} '-]+$/u.test(s) ? s : null;
}

const json = (status: number, data: unknown) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/assistant: whether an AI is configured, for the app's status line and for deploy checks.
 * Never returns the key or any part of it.
 */
export function assistantStatus(env: AIEnv): Response {
  const interpreter = interpreterFromEnv(env);
  const name = providerName(env);
  return json(200, {
    configured: Boolean(interpreter),
    provider: interpreter?.name ?? null,
    // Helpful when someone set AI_PROVIDER but forgot the key.
    problem: interpreter ? null : name ? "missing-key" : "not-configured",
  });
}

/** How each provider failure is answered. The client treats 503 as "no AI: work on the device". */
const PROVIDER_FAILURES: Record<ProviderError["code"], [number, string]> = {
  auth: [503, "ai-auth"],
  "rate-limit": [429, "ai-busy"],
  unavailable: [502, "ai-unavailable"],
  failed: [502, "ai-failed"],
};

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
  if (raw.length > MAX_BODY_WITH_IMAGE || (raw.length > MAX_BODY && !raw.includes('"image"'))) {
    return json(413, { error: "too-large" });
  }
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
    const suggestions = (result?.suggestions ?? [])
      .map((x) => cleanString(x, 60))
      .filter((x): x is string => Boolean(x))
      .slice(0, 3);
    return json(200, {
      intent: intent ?? { name: "UNKNOWN", params: {} },
      reply: cleanString(result?.reply, 600) ?? null,
      suggestions,
      skill: cleanSkill(result?.skill),
      taskDone: result?.taskDone === true,
      // "Tap here" only makes sense with a photo to draw on.
      target: input.image ? cleanTarget(result?.target) : null,
      familyNote: cleanFamilyNote(result?.familyNote),
      scam: result?.scam === "scam" || result?.scam === "suspicious" || result?.scam === "safe" || result?.scam === "unsure" ? result.scam : null,
      scamReasons: cleanScam(result?.scam, result?.scamReasons)?.reasons ?? [],
      // A step is only "checked" against a photo.
      stepCheck: input.image ? cleanStepCheck(result?.stepCheck) : null,
      document: cleanDocument(result?.document),
    });
  } catch (err) {
    if (controller.signal.aborted) return json(504, { error: "timeout" });
    console.error(`[assistant] ${interpreter.name} failed:`, err instanceof Error ? err.message : err);
    if (err instanceof ProviderError) {
      const [status, code] = PROVIDER_FAILURES[err.code];
      return json(status, { error: code });
    }
    return json(502, { error: "ai-failed" });
  } finally {
    clearTimeout(timer);
  }
}
