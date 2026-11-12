import type {
  PermissionName,
  ProposedAction,
  QuickActionId,
  RequestSource,
} from "@/contracts";

/** What the assistant is doing right now. Drives the microphone button. */
export type Phase = "idle" | "listening" | "thinking" | "speaking";

export type ActionStatus =
  | "proposed" // waiting for the person to say yes
  | "running"
  | "done"
  | "failed"
  | "dismissed" // the person said no (or it is from an old conversation)
  | "unsupported"; // this device cannot do it

export interface ActionCard {
  action: ProposedAction;
  status: ActionStatus;
  resultMessage?: string;
  needsPermission?: PermissionName;
}

/**
 * user / assistant: real conversation, saved to history.
 * error / notice: temporary helpers (something went wrong, a hint). Never saved.
 */
export type MessageRole = "user" | "assistant" | "error" | "notice";

export interface RetryInfo {
  text: string;
  source: RequestSource;
  quickActionId?: QuickActionId;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: number;
  source?: RequestSource;
  /** What is read aloud, when different from `text`. */
  spokenText?: string;
  actions?: ActionCard[];
  suggestions?: string[];
  /** On an error: what to resend when the person taps "Try again". */
  retry?: RetryInfo;
  /** On a notice: a permission this message offers to ask for. */
  permission?: PermissionName;
}

export interface Conversation {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export const QUICK_ACTIONS: ReadonlyArray<{ id: QuickActionId; label: string; sentence: string }> = [
  { id: "call", label: "Call", sentence: "I want to make a call." },
  { id: "messages", label: "Messages", sentence: "I want to see or send a message." },
  { id: "reminders", label: "Reminders", sentence: "I want to set or hear a reminder." },
  { id: "help", label: "Help", sentence: "I need some help." },
];

/** Plain examples of what to say. Shown on the empty home screen. */
export const SAY_EXAMPLES: readonly string[] = [
  "Call my daughter",
  "Remind me to take my pills at 8",
  "I need help",
];

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
