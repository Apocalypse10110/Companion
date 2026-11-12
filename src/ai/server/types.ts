import type { AssistantTurn } from "@/contracts";

export interface InterpretInput {
  text: string;
  history: AssistantTurn[];
  language: string;
  now: string;
  lastAssistantText?: string;
}

/** What a server-side adapter returns. All of it is untrusted; the client validates it. */
export interface InterpretOutput {
  intent: unknown;
  reply?: string;
  /** Up to three short things the person might say next ("I see it", "I can't find it"). */
  suggestions?: string[];
}

/** A server-side AI adapter. Returns untrusted raw output; the client validates it. */
export interface ServerInterpreter {
  name: string;
  interpret(input: InterpretInput, signal?: AbortSignal): Promise<InterpretOutput | null>;
}

export type ProviderErrorCode =
  /** The key is missing, wrong or not allowed to use this model. Retrying won't help. */
  | "auth"
  /** The provider says we are sending too much (quota or rate limit). */
  | "rate-limit"
  /** Every model we tried is overloaded, missing or down. */
  | "unavailable"
  /** Anything else (bad output, unexpected status). */
  | "failed";

/** Thrown by adapters so the route can answer with the right status, without leaking details. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  constructor(code: ProviderErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ProviderError";
    this.code = code;
  }
}
