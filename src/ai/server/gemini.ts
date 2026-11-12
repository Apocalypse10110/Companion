/**
 * Google Gemini adapter (server-only), using the official Google Gen AI SDK (`@google/genai`).
 *
 * Gemini is Companion's default AI provider. It plugs in behind the same
 * `ServerInterpreter` interface as the Anthropic and OpenAI-compatible adapters, so it can be
 * replaced by changing AI_PROVIDER without touching the rest of the app.
 *
 * Models are tried in order: if one is overloaded (503), missing (404) or rate limited (429),
 * the next one is used. The key is read from the server environment only.
 * Owner: Developer C (integration).
 */
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { GEMINI_SCHEMA, SYSTEM_PROMPT, extractJson, toRawIntent, userPrompt } from "./prompt";
import { ProviderError, type ServerInterpreter } from "./types";

/** Fast models first: replies are read aloud, so waiting matters more than polish. */
export const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];

/** Per-model time limit, so a slow model still leaves time to try the next one. */
const PER_MODEL_TIMEOUT_MS = 7_000;

export function parseModelList(value: string | undefined): string[] {
  const list = (value ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_GEMINI_MODELS;
}

/** Turn an SDK or network error into one of our codes. Never includes the key or request. */
export function classifyGeminiError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof ApiError || (err && typeof err === "object" && "status" in err)) {
    const status = Number((err as { status?: number }).status);
    const msg = String((err as { message?: unknown }).message ?? "");
    if (status === 401 || status === 403 || /api key not valid|API_KEY_INVALID|permission/i.test(msg)) {
      return new ProviderError("auth", `Gemini rejected the key (HTTP ${status})`);
    }
    if (status === 429) return new ProviderError("rate-limit", "Gemini rate limit or quota reached");
    if (status === 404 || status === 500 || status === 503 || status === 504) {
      return new ProviderError("unavailable", `Gemini model unavailable (HTTP ${status})`);
    }
    return new ProviderError("failed", `Gemini returned HTTP ${status}`);
  }
  if (err instanceof Error && err.name === "AbortError") return new ProviderError("unavailable", "Gemini timed out");
  const what = err instanceof Error ? `${err.name}: ${err.message.slice(0, 120)}` : String(err).slice(0, 120);
  return new ProviderError("unavailable", `Could not reach Gemini (${what})`);
}

/** Worth trying the next model? (Not for a bad key: every model would refuse it.) */
function tryNext(e: ProviderError): boolean {
  return e.code === "unavailable" || e.code === "rate-limit" || e.code === "failed";
}

export interface GeminiConfig {
  apiKey: string;
  models?: string[];
  /** For tests. */
  client?: Pick<GoogleGenAI, "models">;
}

export function createGeminiInterpreter(config: GeminiConfig): ServerInterpreter {
  const client = config.client ?? new GoogleGenAI({ apiKey: config.apiKey, apiVersion: "v1beta" });
  const models = config.models?.length ? config.models : DEFAULT_GEMINI_MODELS;

  return {
    name: "gemini",
    async interpret(input, signal) {
      const contents = [
        ...input.history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
        {
          role: "user",
          parts: [
            ...(input.image ? [{ inlineData: { mimeType: input.image.mimeType, data: input.image.data } }] : []),
            { text: userPrompt(input) },
          ],
        },
      ];

      let lastError: ProviderError = new ProviderError("unavailable", "No Gemini model configured");
      for (const model of models) {
        if (signal?.aborted) throw new ProviderError("unavailable", "Cancelled");
        const own = new AbortController();
        const timer = setTimeout(() => own.abort(), PER_MODEL_TIMEOUT_MS);
        const onAbort = () => own.abort();
        signal?.addEventListener("abort", onAbort);
        try {
          const response = await client.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              responseMimeType: "application/json",
              responseJsonSchema: GEMINI_SCHEMA,
              temperature: 0.3,
              maxOutputTokens: 2048,
              // Gemini 3 models think before answering; a little is plenty here and keeps replies fast (~2s).
              ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
              abortSignal: own.signal,
            },
          });
          const text = response.text ?? "";
          const parsed = toRawIntent(extractJson(text));
          if (!parsed) {
            lastError = new ProviderError("failed", `Gemini (${model}) returned no usable JSON`);
            continue;
          }
          return parsed;
        } catch (err) {
          if (signal?.aborted) throw err;
          lastError = classifyGeminiError(err);
          if (!tryNext(lastError)) throw lastError;
          console.warn(`[assistant] gemini model ${model} failed (${lastError.code}: ${lastError.message}), trying the next one`);
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        }
      }
      throw lastError;
    },
  };
}

export interface GeminiHealth {
  ok: boolean;
  model?: string;
  ms: number;
  problem?: "auth" | "rate-limit" | "unavailable" | "failed";
}

/**
 * Is the key valid and Gemini reachable? Looks up the first available model's details, which is
 * free (it doesn't use the reply quota). Tries the models in order, like a real request does.
 */
export async function geminiHealth(apiKey: string, models: string[], client?: Pick<GoogleGenAI, "models">): Promise<GeminiHealth> {
  const c = client ?? new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  const started = Date.now();
  let problem: GeminiHealth["problem"] = "unavailable";
  for (const model of models) {
    try {
      await c.models.get({ model, config: { abortSignal: AbortSignal.timeout(5000) } });
      return { ok: true, model, ms: Date.now() - started };
    } catch (err) {
      problem = classifyGeminiError(err).code;
      if (problem === "auth") break;
    }
  }
  return { ok: false, ms: Date.now() - started, problem };
}
