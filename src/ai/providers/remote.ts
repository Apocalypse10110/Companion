/**
 * Client-side provider that asks this app's own server (`/api/assistant`) to interpret a sentence.
 * The AI key stays on the server; the phone never sees it.
 * If the server has no AI configured it answers 503 and we quietly fall back to on-device rules.
 *
 * Owner: Developer B.
 */

import { AssistantError } from "@/contracts";
import { cleanFamilyNote, cleanTarget } from "../target";
import { redactPhoneNumbers } from "./redact";
import type { AIProvider, AIUnavailableReason, InterpretRequest, InterpretResult } from "./types";

export const ASSISTANT_ENDPOINT = "/api/assistant";

export function createRemoteProvider(endpoint = ASSISTANT_ENDPOINT, fetchImpl: typeof fetch = (...a) => fetch(...a)): AIProvider {
  /** Once the server says it has no AI, stop asking until the page reloads. */
  let unconfigured = false;
  let reason: AIUnavailableReason | null = null;

  return {
    unavailableReason: () => reason,
    async interpret(request: InterpretRequest, signal?: AbortSignal): Promise<InterpretResult | null> {
      if (unconfigured) return null;
      let res: Response;
      try {
        res = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Phone numbers stay on the phone (see ./redact.ts).
          body: JSON.stringify({
            ...request,
            text: redactPhoneNumbers(request.text),
            history: request.history.map((t) => ({ ...t, text: redactPhoneNumbers(t.text) })),
            ...(request.lastAssistantText ? { lastAssistantText: redactPhoneNumbers(request.lastAssistantText) } : {}),
          }),
          signal,
        });
      } catch (err) {
        if (signal?.aborted) throw err;
        // Offline or the server is unreachable: the on-device rules still work.
        if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
        throw new AssistantError("network", String(err));
      }
      if (res.status === 503 || res.status === 404) {
        unconfigured = true;
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        reason = body?.error === "ai-auth" ? "ai-auth" : "not-configured";
        return null;
      }
      if (res.status === 504) throw new AssistantError("timeout");
      // The AI is busy or briefly down. "unknown" lets the assistant fall back to its own words.
      if (res.status === 429) throw new AssistantError("unknown", "AI busy");
      if (res.status === 413) throw new AssistantError("unknown", "Too large");
      if (!res.ok) throw new AssistantError("unknown", `HTTP ${res.status}`);
      const data = (await res.json().catch(() => null)) as {
        intent?: unknown;
        reply?: unknown;
        suggestions?: unknown;
        skill?: unknown;
        taskDone?: unknown;
        target?: unknown;
        familyNote?: unknown;
      } | null;
      if (!data || typeof data !== "object") throw new AssistantError("unknown", "Bad response");
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions.filter((x): x is string => typeof x === "string") : [];
      return {
        intent: data.intent,
        reply: typeof data.reply === "string" ? data.reply : undefined,
        ...(suggestions.length ? { suggestions } : {}),
        ...(typeof data.skill === "string" && data.skill ? { skill: data.skill } : {}),
        ...(data.taskDone === true ? { taskDone: true } : {}),
        // Checked again here: the phone trusts nothing it is sent.
        ...(cleanTarget(data.target) ? { target: cleanTarget(data.target) } : {}),
        ...(cleanFamilyNote(data.familyNote) ? { familyNote: cleanFamilyNote(data.familyNote)! } : {}),
      };
    },
  };
}
