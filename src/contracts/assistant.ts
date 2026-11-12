/**
 * CONTRACT: assistant
 * Proposed by Developer A (mobile UI). Implemented by Developer B.
 */

import type { ProposedAction } from "./actions";

export type RequestSource = "voice" | "text" | "quick-action" | "photo";

export type QuickActionId = "call" | "messages" | "reminders" | "help";

export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

/** A photo the person took or picked ("Show me"). Already shrunk on the device. */
export interface AssistantImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** Base64, no "data:" prefix. Kept under about 1 MB. */
  data: string;
}

export interface AssistantRequest {
  /** What the person said or typed. For quick actions, a plain sentence such as "I want to make a call". */
  text: string;
  source: RequestSource;
  /** Set when source is "quick-action". */
  quickActionId?: QuickActionId;
  /** Set when source is "photo": what the person wants help with in the picture. */
  image?: AssistantImage;
  /** Recent turns, oldest first, so the assistant has context. Capped by the UI. */
  history: AssistantTurn[];
  /** BCP 47 language tag, for example "en-US". */
  language: string;
  /**
   * Presentation hints so replies suit this person.
   * Developer B should keep replies short and plain when `plainLanguage` is true.
   */
  hints: {
    plainLanguage: true;
    /** The reply will be read aloud, so avoid emoji, tables and links. */
    willBeSpoken: boolean;
  };
}

export interface AssistantReply {
  /** Unique id for this reply. */
  id: string;
  /** What appears on screen. */
  text: string;
  /** What is read aloud, if different from `text` (for example, without symbols). */
  spokenText?: string;
  /** Things the assistant would like to do. The person confirms each one. */
  proposedActions?: ProposedAction[];
  /** Short tappable suggestions shown under the reply. Max 3 are shown. */
  suggestions?: string[];
}

export type AssistantErrorCode =
  /** The assistant has not been connected or configured. */
  | "unavailable"
  /** No internet or the server could not be reached. */
  | "network"
  /** Took too long. */
  | "timeout"
  /** Anything else. */
  | "unknown";

/** Throw (reject with) this from `send` so the UI can show a friendly message. */
export class AssistantError extends Error {
  readonly code: AssistantErrorCode;
  constructor(code: AssistantErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AssistantError";
    this.code = code;
  }
}

export interface AssistantSendOptions {
  /** Aborted when the person taps Cancel. Stop work and reject. */
  signal?: AbortSignal;
  /** Optional: call with the full text so far to show the reply as it arrives. */
  onPartialText?: (textSoFar: string) => void;
}

export interface AssistantService {
  /** Resolves with the full reply. Rejects with AssistantError on failure. */
  send(request: AssistantRequest, options?: AssistantSendOptions): Promise<AssistantReply>;
}
