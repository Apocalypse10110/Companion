import type { ActionCard, ChatMessage, Conversation, Phase } from "./types";

/**
 * The empty conversation waiting for the first message. It has a fixed id and no time on
 * purpose: reading the clock or a random number while rendering is not allowed, because a
 * server render would freeze the value. The first message "claims" a real id and time.
 */
export const INITIAL_ID = "initial";

export interface State {
  conversations: Conversation[];
  activeId: string;
  phase: Phase;
  /** Words heard so far, while listening. */
  interim: string;
  /** Microphone loudness 0..1. */
  level: number;
  /** Reply text arriving, if the assistant streams. */
  partial: string;
  /** Which message is being read aloud. */
  speakingId: string | null;
  /** Saved history has been read from the device. */
  hydrated: boolean;
}

export type Action =
  | { type: "hydrate"; saved: Conversation[] }
  | { type: "add"; message: ChatMessage }
  | { type: "remove"; id: string }
  | { type: "card"; messageId: string; actionId: string; patch: Partial<ActionCard> }
  | { type: "phase"; phase: Phase }
  | { type: "interim"; text: string }
  | { type: "level"; level: number }
  | { type: "partial"; text: string }
  | { type: "speaking"; id: string | null }
  | { type: "claim"; id: string; now: number }
  | { type: "new" }
  | { type: "open"; id: string }
  | { type: "delete"; id: string }
  | { type: "clear" };

/** A blank conversation. Pure: no clock, no randomness. */
export function blankConversation(): Conversation {
  return { id: INITIAL_ID, createdAt: 0, updatedAt: 0, messages: [] };
}

/** Drop any blank placeholder so there is never more than one. */
function withoutBlank(list: Conversation[]): Conversation[] {
  return list.filter((c) => !(c.id === INITIAL_ID && c.messages.length === 0));
}

export function initState(): State {
  const first = blankConversation();
  return {
    conversations: [first],
    activeId: first.id,
    phase: "idle",
    interim: "",
    level: 0,
    partial: "",
    speakingId: null,
    hydrated: false,
  };
}

export function activeConversation(state: State): Conversation {
  return state.conversations.find((c) => c.id === state.activeId) ?? state.conversations[0];
}

function mapActive(state: State, fn: (c: Conversation) => Conversation): State {
  return {
    ...state,
    conversations: state.conversations.map((c) => (c.id === state.activeId ? fn(c) : c)),
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate": {
      const known = new Set(state.conversations.map((c) => c.id));
      const saved = action.saved.filter((c) => !known.has(c.id) && c.id !== INITIAL_ID);
      return { ...state, conversations: [...state.conversations, ...saved], hydrated: true };
    }
    case "add":
      return mapActive(state, (c) => {
        // A new question clears out old hints and error boxes so the thread stays calm.
        const kept =
          action.message.role === "user"
            ? c.messages.filter((m) => m.role !== "error" && m.role !== "notice")
            : c.messages;
        return { ...c, messages: [...kept, action.message], updatedAt: action.message.createdAt };
      });
    case "remove":
      return mapActive(state, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== action.id) }));
    case "card":
      return mapActive(state, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id !== action.messageId
            ? m
            : {
                ...m,
                actions: m.actions?.map((card) =>
                  card.action.id === action.actionId ? { ...card, ...action.patch } : card,
                ),
              },
        ),
      }));
    case "phase":
      return { ...state, phase: action.phase };
    case "interim":
      return { ...state, interim: action.text };
    case "level":
      return { ...state, level: action.level };
    case "partial":
      return { ...state, partial: action.text };
    case "speaking":
      return { ...state, speakingId: action.id };
    case "claim": {
      if (state.activeId !== INITIAL_ID) return state;
      return {
        ...state,
        activeId: action.id,
        conversations: state.conversations.map((c) =>
          c.id === INITIAL_ID ? { ...c, id: action.id, createdAt: action.now, updatedAt: action.now } : c,
        ),
      };
    }
    case "new": {
      const current = activeConversation(state);
      if (current.messages.length === 0) return state;
      const fresh = blankConversation();
      return { ...state, conversations: [fresh, ...withoutBlank(state.conversations)], activeId: fresh.id };
    }
    case "open":
      return state.conversations.some((c) => c.id === action.id) ? { ...state, activeId: action.id } : state;
    case "delete": {
      const rest = withoutBlank(state.conversations.filter((c) => c.id !== action.id));
      if (action.id !== state.activeId) return { ...state, conversations: rest.length ? rest : [blankConversation()], activeId: rest.length ? state.activeId : INITIAL_ID };
      const fresh = blankConversation();
      return { ...state, conversations: [fresh, ...rest], activeId: fresh.id };
    }
    case "clear": {
      const fresh = blankConversation();
      return { ...state, conversations: [fresh], activeId: fresh.id };
    }
  }
}
