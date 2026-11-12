/**
 * Claude adapter (server-only). Uses the official Anthropic SDK with structured output so the
 * answer always matches INTERPRET_SCHEMA. The API key is read from the server environment.
 * Owner: Developer B.
 */

import Anthropic from "@anthropic-ai/sdk";
import { INTERPRET_SCHEMA, SYSTEM_PROMPT, extractJson, toRawIntent, userPrompt } from "./prompt";
import type { ServerInterpreter } from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export function createAnthropicInterpreter(config: { apiKey: string; model?: string; baseURL?: string }): ServerInterpreter {
  const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL || undefined, maxRetries: 1, timeout: 20_000 });
  const model = config.model || DEFAULT_ANTHROPIC_MODEL;

  return {
    name: "anthropic",
    async interpret(input, signal) {
      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            ...input.history.map((t) => ({ role: t.role, content: t.text })),
            { role: "user" as const, content: userPrompt(input) },
          ],
          // Classification is quick work: low effort keeps the person waiting as little as possible.
          output_config: { effort: "low", format: { type: "json_schema", schema: INTERPRET_SCHEMA } },
          // If the model declines for policy reasons, let the API retry on its default fallback.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal },
      );
      if (response.stop_reason === "refusal") return { intent: { name: "UNKNOWN", params: {} } };
      const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return toRawIntent(extractJson(text));
    },
  };
}
