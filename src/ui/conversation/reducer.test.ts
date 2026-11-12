import { describe, expect, it } from "vitest";
import { INITIAL_ID, activeConversation, initState, reducer, type State } from "./reducer";
import type { ChatMessage } from "./types";

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({ id: "m1", role: "user", text: "hi", createdAt: 100, ...over });
const withMessage = (s: State, m = msg()) => reducer(s, { type: "add", message: m });

describe("conversation reducer", () => {
  it("starts with one blank placeholder conversation (no clock, no randomness)", () => {
    const s = initState();
    expect(s.conversations).toHaveLength(1);
    expect(s.activeId).toBe(INITIAL_ID);
    expect(s.conversations[0]).toMatchObject({ createdAt: 0, updatedAt: 0, messages: [] });
  });

  it("claim gives the placeholder a real id and time, only once", () => {
    let s = reducer(initState(), { type: "claim", id: "c1", now: 500 });
    expect(s.activeId).toBe("c1");
    expect(activeConversation(s)).toMatchObject({ id: "c1", createdAt: 500, updatedAt: 500 });
    s = reducer(s, { type: "claim", id: "c2", now: 900 });
    expect(s.activeId).toBe("c1");
  });

  it("adding a user message clears old errors and notices but keeps real turns", () => {
    let s = withMessage(initState(), msg({ id: "a", role: "assistant", text: "hello" }));
    s = withMessage(s, msg({ id: "e", role: "error", text: "oops" }));
    s = withMessage(s, msg({ id: "n", role: "notice", text: "fyi" }));
    s = withMessage(s, msg({ id: "u", role: "user", text: "again" }));
    expect(activeConversation(s).messages.map((m) => m.id)).toEqual(["a", "u"]);
  });

  it("updates one action card without touching others", () => {
    const action = (id: string) => ({ action: { id, kind: "call", title: id, risk: "low" as const, params: {} }, status: "proposed" as const });
    let s = withMessage(initState(), msg({ id: "r", role: "assistant", actions: [action("a1"), action("a2")] }));
    s = reducer(s, { type: "card", messageId: "r", actionId: "a1", patch: { status: "done", resultMessage: "ok" } });
    const cards = activeConversation(s).messages[0].actions!;
    expect(cards[0]).toMatchObject({ status: "done", resultMessage: "ok" });
    expect(cards[1].status).toBe("proposed");
  });

  it("new keeps the old conversation and opens a blank one; does nothing if already blank", () => {
    const blank = initState();
    expect(reducer(blank, { type: "new" })).toBe(blank);
    let s = reducer(blank, { type: "claim", id: "c1", now: 1 });
    s = withMessage(s);
    s = reducer(s, { type: "new" });
    expect(s.conversations.map((c) => c.id)).toEqual([INITIAL_ID, "c1"]);
    expect(s.activeId).toBe(INITIAL_ID);
  });

  it("never ends up with two blank placeholders", () => {
    let s = reducer(initState(), { type: "claim", id: "c1", now: 1 });
    s = withMessage(s);
    s = reducer(s, { type: "new" });
    s = reducer(s, { type: "open", id: "c1" }); // leaves a blank one behind
    s = reducer(s, { type: "new" });
    expect(s.conversations.filter((c) => c.id === INITIAL_ID)).toHaveLength(1);
  });

  it("hydrate adds saved conversations once and ignores a saved one that collides with the placeholder", () => {
    const saved = { id: "old", createdAt: 1, updatedAt: 2, messages: [msg()] };
    let s = reducer(initState(), { type: "hydrate", saved: [saved, { ...saved, id: INITIAL_ID }] });
    expect(s.conversations.map((c) => c.id)).toEqual([INITIAL_ID, "old"]);
    s = reducer(s, { type: "hydrate", saved: [saved] });
    expect(s.conversations).toHaveLength(2);
    expect(s.hydrated).toBe(true);
  });

  it("deleting the active conversation falls back to a blank one; deleting another keeps the active", () => {
    let s = reducer(initState(), { type: "hydrate", saved: [{ id: "old", createdAt: 1, updatedAt: 2, messages: [msg()] }] });
    s = reducer(s, { type: "claim", id: "now", now: 5 });
    s = withMessage(s);
    const afterOther = reducer(s, { type: "delete", id: "old" });
    expect(afterOther.activeId).toBe("now");
    const afterActive = reducer(s, { type: "delete", id: "now" });
    expect(afterActive.activeId).toBe(INITIAL_ID);
    expect(afterActive.conversations.some((c) => c.id === "now")).toBe(false);
  });

  it("clear wipes everything and leaves one blank conversation", () => {
    let s = reducer(initState(), { type: "claim", id: "c1", now: 1 });
    s = withMessage(s);
    s = reducer(s, { type: "clear" });
    expect(s.conversations).toHaveLength(1);
    expect(activeConversation(s).messages).toEqual([]);
  });
});
