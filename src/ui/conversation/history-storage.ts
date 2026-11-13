import { safeStorage } from "../settings/storage";
import type { ActionCard, ChatMessage, Conversation } from "./types";

export const HISTORY_KEY = "companion.history.v1";
export const MAX_CONVERSATIONS = 50;
export const MAX_MESSAGES = 200;

/** Only real conversation is saved. Temporary errors and hints are not. */
export function toSavable(conversations: Conversation[]): Conversation[] {
  return conversations
    .map((c) => ({
      ...c,
      messages: c.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-MAX_MESSAGES)
        // Full-size photos stay in memory: too big for the device's storage, and private.
        .map((m) => (m.photo || m.pointAt || m.document ? { ...m, photo: undefined, pointAt: undefined, document: undefined } : m)),
    }))
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
}

function isMessage(m: unknown): m is ChatMessage {
  if (typeof m !== "object" || m === null) return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.role === "user" || o.role === "assistant") &&
    typeof o.text === "string" &&
    typeof o.createdAt === "number"
  );
}

/** An old proposal must never be runnable again: anything unfinished becomes "dismissed". */
function freeze(card: ActionCard): ActionCard {
  return card.status === "proposed" || card.status === "running"
    ? { ...card, status: "dismissed", resultMessage: undefined }
    : card;
}

export function loadConversations(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Conversation[] {
  try {
    const raw = storage?.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Conversation[] = [];
    for (const c of parsed) {
      if (typeof c !== "object" || c === null) continue;
      const o = c as Record<string, unknown>;
      if (typeof o.id !== "string" || !Array.isArray(o.messages)) continue;
      const messages = o.messages.filter(isMessage).map((m) => ({
        ...m,
        actions: m.actions?.map(freeze),
        suggestions: undefined,
      }));
      if (messages.length === 0) continue;
      out.push({
        id: o.id,
        createdAt: typeof o.createdAt === "number" ? o.createdAt : messages[0].createdAt,
        updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : messages[messages.length - 1].createdAt,
        messages,
      });
    }
    return out.slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

export function saveConversations(
  conversations: Conversation[],
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined = safeStorage(),
): void {
  try {
    const savable = toSavable(conversations);
    // Nothing to keep: leave no trace on the device at all.
    if (savable.length === 0) storage?.removeItem(HISTORY_KEY);
    else storage?.setItem(HISTORY_KEY, JSON.stringify(savable));
  } catch {
    /* Storage full or blocked. The conversation still works for this visit. */
  }
}

export function clearSavedConversations(storage: Pick<Storage, "removeItem"> | undefined = safeStorage()): void {
  try {
    storage?.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
