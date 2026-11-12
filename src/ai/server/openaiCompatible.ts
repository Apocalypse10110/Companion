/**
 * Adapter for any server that speaks the OpenAI-style `/chat/completions` API
 * (OpenAI, Ollama, LM Studio, llama.cpp server, vLLM, ...). Server-only.
 * Owner: Developer B.
 */

import { SYSTEM_PROMPT, extractJson, toRawIntent, userPrompt } from "./prompt";
import type { ServerInterpreter } from "./types";

export function createOpenAICompatibleInterpreter(config: {
  baseURL: string;
  apiKey?: string;
  model: string;
  fetchImpl?: typeof fetch;
}): ServerInterpreter {
  const doFetch = config.fetchImpl ?? fetch;
  const url = `${config.baseURL.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: "openai-compatible",
    async interpret(input, signal) {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          max_tokens: 400,
          // Widely supported; servers that don't know it ignore it, and we parse defensively anyway.
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...input.history.map((t) => ({ role: t.role, content: t.text })),
            {
              role: "user",
              content: input.image
                ? [
                    { type: "image_url", image_url: { url: `data:${input.image.mimeType};base64,${input.image.data}` } },
                    { type: "text", text: userPrompt(input) },
                  ]
                : userPrompt(input),
            },
          ],
        }),
        signal,
      });
      if (!res.ok) throw Object.assign(new Error(`AI server returned ${res.status}`), { status: res.status });
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return toRawIntent(extractJson(data.choices?.[0]?.message?.content ?? ""));
    },
  };
}
