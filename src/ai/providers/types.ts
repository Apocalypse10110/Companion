/**
 * AI provider abstraction. The assistant asks a provider only when the on-device rules
 * can't understand a sentence. A provider returns an *untrusted* intent that is validated
 * exactly like local intents; it can never run anything itself.
 *
 * Owner: Developer B.
 */

import type { AssistantImage, AssistantMode, AssistantTurn, DocumentInfo, ScamCheck, StepCheck } from "@/contracts";

export interface InterpretRequest {
  text: string;
  history: AssistantTurn[];
  language: string;
  /** The person's local date and time, ISO 8601, so "tomorrow" means something. */
  now: string;
  /** What the assistant just asked, if anything ("Who would you like to call?"). */
  lastAssistantText?: string;
  /** A photo to look at ("Show me"). */
  image?: AssistantImage;
  /** Tasks they've finished before, so the AI can let them try first. */
  skills?: string[];
  /** What the request is for (default "help"). */
  mode?: AssistantMode;
}

export interface InterpretResult {
  /** Untrusted. Must go through validateIntent. */
  intent: unknown;
  /** For questions and help: a short plain-language answer. Ignored for actions. */
  reply?: string;
  /** Short things the person might say next. Untrusted; the assistant caps them. */
  suggestions?: string[];
  /** The task being taught, if any ("connect to wifi"). */
  skill?: string;
  /** True when the person has just finished that task. */
  taskDone?: boolean;
  /** "Tap here": what to press in the photo. Untrusted; checked with cleanTarget. */
  target?: unknown;
  /** A note the person may choose to send to family. Untrusted; checked with cleanFamilyNote. */
  familyNote?: string;
  /** Already checked by the client (see src/ai/target.ts). */
  scam?: ScamCheck;
  stepCheck?: StepCheck;
  document?: DocumentInfo;
}

/** Why there is no AI: nothing set up, or the server's key was refused. */
export type AIUnavailableReason = "not-configured" | "ai-auth";

export interface AIProvider {
  /**
   * Returns null when no AI is configured (the assistant then uses its own words).
   * Rejects with AssistantError ("network", "timeout", "unknown") on failure.
   */
  interpret(request: InterpretRequest, signal?: AbortSignal): Promise<InterpretResult | null>;
  /** Optional: why `interpret` returned null, once known. */
  unavailableReason?(): AIUnavailableReason | null;
}

/** Used when nothing is configured: the assistant runs fully on the device. */
export const noProvider: AIProvider = {
  async interpret() {
    return null;
  },
};
