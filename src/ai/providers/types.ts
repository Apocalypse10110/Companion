/**
 * AI provider abstraction. The assistant asks a provider only when the on-device rules
 * can't understand a sentence. A provider returns an *untrusted* intent that is validated
 * exactly like local intents; it can never run anything itself.
 *
 * Owner: Developer B.
 */

import type { AssistantTurn } from "@/contracts";

export interface InterpretRequest {
  text: string;
  history: AssistantTurn[];
  language: string;
  /** The person's local date and time, ISO 8601, so "tomorrow" means something. */
  now: string;
  /** What the assistant just asked, if anything ("Who would you like to call?"). */
  lastAssistantText?: string;
}

export interface InterpretResult {
  /** Untrusted. Must go through validateIntent. */
  intent: unknown;
  /** For questions and help: a short plain-language answer. Ignored for actions. */
  reply?: string;
}

export interface AIProvider {
  /**
   * Returns null when no AI is configured (the assistant then uses its own words).
   * Rejects with AssistantError ("network", "timeout", "unknown") on failure.
   */
  interpret(request: InterpretRequest, signal?: AbortSignal): Promise<InterpretResult | null>;
}

/** Used when nothing is configured: the assistant runs fully on the device. */
export const noProvider: AIProvider = {
  async interpret() {
    return null;
  },
};
