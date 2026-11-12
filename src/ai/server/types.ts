import type { AssistantTurn } from "@/contracts";

export interface InterpretInput {
  text: string;
  history: AssistantTurn[];
  language: string;
  now: string;
  lastAssistantText?: string;
}

/** A server-side AI adapter. Returns untrusted raw output; the client validates it. */
export interface ServerInterpreter {
  name: string;
  interpret(input: InterpretInput, signal?: AbortSignal): Promise<{ intent: unknown; reply?: string } | null>;
}
