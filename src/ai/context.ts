/**
 * What the assistant remembers between turns of one conversation: the action it last offered,
 * the person it last talked about, and any question it is waiting on ("Who should I call?").
 *
 * The UI sends recent turns with every request but not this state, so it lives here. It is
 * thrown away whenever the history doesn't match what we last said (new or reopened conversation).
 *
 * Owner: Developer B.
 */

import type { AssistantTurn, ProposedAction } from "@/contracts";
import { classify } from "./intents/rules";
import { validateIntent, type Intent } from "./intents/schema";
import { PRONOUNS } from "./intents/rules";

export type Slot = "contact" | "body" | "text" | "at";

export interface ConversationContext {
  /** The last action offered and not yet answered. */
  pending?: { intent: Intent; action: ProposedAction };
  /** A question we asked and are waiting to hear the answer to. */
  awaiting?: { intent: Intent; slot: Slot };
  /** The last person mentioned by name or relationship, for "her", "him", "them". */
  lastContact?: string;
  /** What we last replied, to check the conversation is still the same one. */
  lastReplyText?: string;
}

export class ContextStore {
  private ctx: ConversationContext = {};

  /** Returns the context for this request, starting fresh if the history doesn't follow on from our last reply. */
  restore(history: AssistantTurn[]): ConversationContext {
    const lastAssistant = [...history].reverse().find((t) => t.role === "assistant");
    if (!lastAssistant || lastAssistant.text !== this.ctx.lastReplyText) {
      this.ctx = { lastContact: contactFromHistory(history) };
    }
    return this.ctx;
  }

  save(next: ConversationContext): void {
    this.ctx = next;
  }

  reset(): void {
    this.ctx = {};
  }
}

/** Look back through what the person said for the last person they mentioned. */
export function contactFromHistory(history: AssistantTurn[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== "user") continue;
    const raw = classify(turn.text);
    const intent = raw ? validateIntent(raw) : null;
    const c = intent?.params.contact;
    if (c && !PRONOUNS.test(c)) return c;
  }
  return undefined;
}
