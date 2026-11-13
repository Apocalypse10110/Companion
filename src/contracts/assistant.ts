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

/**
 * What a photo or message is being sent for. "help" is the default Show Me.
 * "check": the person did the last step and sends a photo so Companion can check it.
 * "scam": "is this real?" for a message, call or pop-up. "document": read a bill or letter.
 */
export type AssistantMode = "help" | "check" | "scam" | "document";

export interface AssistantRequest {
  /** What the person said or typed. For quick actions, a plain sentence such as "I want to make a call". */
  text: string;
  source: RequestSource;
  /** Set when source is "quick-action". */
  quickActionId?: QuickActionId;
  /** Set when source is "photo": what the person wants help with in the picture. */
  image?: AssistantImage;
  /** What this request is for (default "help"). */
  mode?: AssistantMode;
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
    /** How much the person likes explained (Settings). Default "normal". */
    detail?: "short" | "normal" | "detailed";
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
  /**
   * Companion is teaching a task ("connect to wifi"). "new": first time, shown as a lesson.
   * "practice": done before, so they try first. "learned": just finished it.
   */
  lesson?: { skill: string; stage: "new" | "practice" | "learned" };
  /** "Tap here": the thing to press in the photo the person just sent, drawn as a ring on it. */
  pointAt?: PointAt;
  /**
   * A short note, in the person's own voice, that they can choose to send to a family member
   * ("I got a text saying my parcel is on hold. Companion thinks it's a scam."). Offered when they
   * seem stuck or after a scam warning. Never sent without the person confirming.
   */
  familyNote?: string;
  /** For a message, call, pop-up or letter: how it looks, and why. Never a guarantee. */
  scam?: ScamCheck;
  /** "Check my step": did the photo show the step was done? Only set when a photo was checked. */
  stepCheck?: StepCheck;
  /** "Point at a bill": what could be read from a bill or letter. Values are as seen, never guessed. */
  document?: DocumentInfo;
}

export type ScamVerdict = "scam" | "suspicious" | "safe" | "unsure";

export interface ScamCheck {
  verdict: ScamVerdict;
  /** Plain reasons ("The link isn't the delivery company's website"). Up to 4. */
  reasons: string[];
}

export type StepCheck = "done" | "not-yet" | "unsure";

export interface DocumentInfo {
  /** Who it's from, as printed. */
  organization?: string;
  /** Amount due as printed, e.g. "$84.20". */
  amount?: string;
  /** Due date as YYYY-MM-DD, only when clearly printed. */
  dueDate?: string;
  reference?: string;
  /** What the letter asks them to do, in plain words. */
  summary?: string;
  /** Fields that were hard to read, so the person checks them. */
  unclear: string[];
}

/** Where to tap in a photo. Box is [ymin, xmin, ymax, xmax], in thousandths of the photo's height and width. */
export interface PointAt {
  /** What it is, in words ("Manage Storage", "the grey gear"). */
  label: string;
  box: [number, number, number, number];
  /**
   * The person has done this task before: the ring starts hidden and they are asked to find it
   * themselves first, with a "Show me where" button. Help that fades.
   */
  hidden?: boolean;
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
