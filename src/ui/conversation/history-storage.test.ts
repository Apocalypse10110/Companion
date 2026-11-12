import { describe, expect, it } from "vitest";
import { HISTORY_KEY, MAX_CONVERSATIONS, MAX_MESSAGES, clearSavedConversations, loadConversations, saveConversations, toSavable } from "./history-storage";
import type { ChatMessage, Conversation } from "./types";

const m = (over: Partial<ChatMessage>): ChatMessage => ({ id: "x", role: "user", text: "t", createdAt: 1, ...over });
const convo = (id: string, messages: ChatMessage[], updatedAt = 1): Conversation => ({ id, createdAt: 1, updatedAt, messages });

describe("history storage", () => {
  it("saves only real conversation, never temporary errors or hints, and skips empty conversations", () => {
    const out = toSavable([
      convo("a", [m({ id: "1" }), m({ id: "2", role: "assistant" }), m({ id: "3", role: "error" }), m({ id: "4", role: "notice" })]),
      convo("empty", []),
      convo("onlyNotice", [m({ role: "notice" })]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].messages.map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("orders newest first and caps sizes", () => {
    const many = Array.from({ length: MAX_CONVERSATIONS + 5 }, (_, i) => convo(`c${i}`, [m({ id: `m${i}` })], i));
    const out = toSavable(many);
    expect(out).toHaveLength(MAX_CONVERSATIONS);
    expect(out[0].id).toBe(`c${MAX_CONVERSATIONS + 4}`);
    const long = convo("long", Array.from({ length: MAX_MESSAGES + 10 }, (_, i) => m({ id: `${i}` })));
    expect(toSavable([long])[0].messages).toHaveLength(MAX_MESSAGES);
  });

  it("an old proposal can never be run again after reload", () => {
    const action = { id: "a", kind: "call", title: "Call", risk: "high" as const, params: {} };
    saveConversations([
      convo("c", [
        m({
          id: "r",
          role: "assistant",
          actions: [
            { action, status: "proposed" },
            { action: { ...action, id: "b" }, status: "running" },
            { action: { ...action, id: "c" }, status: "done", resultMessage: "Called." },
          ],
          suggestions: ["Try this"],
        }),
      ]),
    ]);
    const cards = loadConversations()[0].messages[0].actions!;
    expect(cards.map((c) => c.status)).toEqual(["dismissed", "dismissed", "done"]);
    expect(loadConversations()[0].messages[0].suggestions).toBeUndefined();
  });

  it("survives corrupted or malformed storage", () => {
    window.localStorage.setItem(HISTORY_KEY, "{nope");
    expect(loadConversations()).toEqual([]);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([null, 3, { id: 1 }, { id: "ok", messages: [{ bad: true }] }, { id: "good", messages: [m({ id: "k" })] }]));
    expect(loadConversations().map((c) => c.id)).toEqual(["good"]);
  });

  it("clear removes the key", () => {
    saveConversations([convo("a", [m({})])]);
    expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull();
    clearSavedConversations();
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});
