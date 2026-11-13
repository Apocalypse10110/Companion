import { describe, expect, it, vi } from "vitest";
import { AssistantError, type AssistantReply, type AssistantRequest, type AssistantTurn } from "@/contracts";
import { createAssistant } from "./assistant";
import type { AIProvider } from "./providers/types";

const NOW = new Date(2026, 10, 11, 9, 0, 0);

function setup(provider?: AIProvider) {
  let n = 0;
  const assistant = createAssistant({ provider, now: () => NOW, newId: () => `id${++n}` });
  const history: AssistantTurn[] = [];
  async function say(text: string, extra: Partial<AssistantRequest> = {}): Promise<AssistantReply> {
    const reply = await assistant.send({
      text,
      source: "voice",
      history: [...history],
      language: "en-US",
      hints: { plainLanguage: true, willBeSpoken: true },
      ...extra,
    });
    history.push({ role: "user", text }, { role: "assistant", text: reply.text });
    return reply;
  }
  return { assistant, say, history };
}

describe("assistant: demo flows", () => {
  it("Call my daughter -> high-risk call proposal, confirmed by tap", async () => {
    const { say } = setup();
    const r = await say("Call my daughter.");
    expect(r.text).toBe('Would you like me to call your daughter? Tap "Yes, do it" to start the call.');
    expect(r.spokenText).toBe("Would you like me to call your daughter? Tap yes to start the call.");
    expect(r.proposedActions).toEqual([{ id: "id2", kind: "call", title: "Call your daughter", risk: "high", params: { contact: "daughter" } }]);
  });

  it("Make the text bigger -> low-risk accessibility action", async () => {
    const { say } = setup();
    const r = await say("Make the text bigger");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "accessibility", risk: "low", params: { setting: "textSize", value: "increase" }, title: "Make the text bigger" });
  });

  it("What's my latest reminder -> list-reminders action", async () => {
    const { say } = setup();
    const r = await say("What's my latest reminder?");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "list-reminders", risk: "low", params: { which: "next" } });
  });

  it("Remind me to take my medication at 8 -> reminder with a real time, said back in the second person", async () => {
    const { say } = setup();
    const r = await say("Remind me to take my medication at 8");
    expect(r.text).toBe("I'll remind you to take your medication today at 8:00 PM. Should I set that reminder?");
    expect(r.proposedActions?.[0]).toMatchObject({
      kind: "reminder",
      title: "Remind me to take your medication",
      description: "Today at 8:00 PM",
      params: { text: "Take my medication", at: new Date(2026, 10, 11, 20, 0).toISOString() },
    });
  });

  it("answers the time on the device", async () => {
    const { say } = setup();
    const r = await say("What time is it?");
    expect(r.text).toBe("It's 9:00 AM.");
    expect(r.spokenText).toBe("It's 9:00 in the morning.");
    expect(r.proposedActions).toBeUndefined();
  });

  it("keeps the person's capitals in a message", async () => {
    const { say } = setup();
    const r = await say("Send Emma a message saying I'll be home soon");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "message", risk: "high", title: "Send a message to Emma", params: { contact: "emma", body: "I'll be home soon" } });
  });
});

describe("assistant: conversation context", () => {
  it("Call Emma -> yes points to the card and keeps it pending", async () => {
    const { say } = setup();
    await say("Call Emma");
    const yes = await say("Yes");
    expect(yes.text).toBe('Okay. Please tap "Yes, do it" on the card above to call Emma.');
    expect(yes.proposedActions).toBeUndefined();
    const again = await say("yes please");
    expect(again.text).toContain("call Emma");
  });

  it("no cancels the offer", async () => {
    const { say } = setup();
    await say("Call Emma");
    expect((await say("No")).text).toBe("Okay, I won't do that.");
    expect((await say("Yes")).text).toContain("not sure");
  });

  it("asks who to call, then uses the answer", async () => {
    const { say } = setup();
    expect((await say("Call")).text).toBe("Who would you like to call?");
    const r = await say("My son please");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "call", params: { contact: "son" }, title: "Call your son" });
  });

  it("collects a message step by step, taking the body word for word", async () => {
    const { say } = setup();
    expect((await say("Send a message")).text).toBe("Who should I send the message to?");
    expect((await say("Emma")).text).toBe("What would you like the message to Emma to say?");
    const r = await say("Call me when you get home");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "message", params: { contact: "emma", body: "Call me when you get home" } });
  });

  it("asks when for a reminder, then understands the answer", async () => {
    const { say } = setup();
    const ask = await say("Remind me to call the bank");
    expect(ask.text).toContain("When should I remind you to call the bank?");
    const r = await say("tomorrow at 10");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "reminder", params: { at: new Date(2026, 10, 12, 10, 0).toISOString() } });
  });

  it("resolves her / them to the last person mentioned", async () => {
    const { say } = setup();
    await say("Call Emma");
    await say("No");
    const r = await say("Tell her I'm running late");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "message", params: { contact: "emma" } });
    const t = await say("Tell them yes");
    expect(t.proposedActions?.[0]).toMatchObject({ kind: "message", params: { contact: "emma", body: "Yes" } });
  });

  it("asks who when a pronoun has nothing to refer to", async () => {
    const { say } = setup();
    const r = await say("Call her");
    expect(r.text).toBe("Who would you like me to call? Please say their name.");
    expect(r.proposedActions).toBeUndefined();
  });

  it("finds the person from earlier history when the app was reopened", async () => {
    const { assistant } = setup();
    const r = await assistant.send({
      text: "Call him",
      source: "voice",
      history: [
        { role: "user", text: "Text John that I'm on my way" },
        { role: "assistant", text: "something said in an earlier session" },
      ],
      language: "en-US",
      hints: { plainLanguage: true, willBeSpoken: true },
    });
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "call", params: { contact: "john" } });
  });

  it("a new conversation forgets the old one", async () => {
    const { assistant, say } = setup();
    await say("Call Emma");
    const r = await assistant.send({ text: "yes", source: "voice", history: [], language: "en-US", hints: { plainLanguage: true, willBeSpoken: true } });
    expect(r.text).toContain("not sure");
  });

  it("quick actions start the right question", async () => {
    const { say } = setup();
    expect((await say("I want to make a call.", { source: "quick-action", quickActionId: "call" })).text).toBe("Who would you like to call?");
    expect((await say("Anna")).proposedActions?.[0]).toMatchObject({ kind: "call", params: { contact: "anna" } });
  });

  it("only offers one action at a time and never runs anything", async () => {
    const { say } = setup();
    const r = await say("Call my daughter");
    expect(r.proposedActions).toHaveLength(1);
  });
});

describe("assistant: honest about limits", () => {
  it("can't read messages, offers to open the Messages app", async () => {
    const { say } = setup();
    const r = await say("Read my latest message");
    expect(r.text).toContain("can't read your messages");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "open-app", params: { app: "messages" } });
  });

  it("checks the real weather (no AI needed), asking for the location first", async () => {
    const { say } = setup();
    const r = await say("What's the weather like?");
    expect(r.text).toContain("I'll need your location");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "weather", risk: "low" });
  });

  it("unknown things get a kind reply with suggestions", async () => {
    const { say } = setup();
    const r = await say("blorp the flibbet");
    expect(r.text).toContain("didn't quite understand");
    expect(r.suggestions?.length).toBeGreaterThan(0);
  });
});

describe("assistant: AI provider", () => {
  it("is only asked when the rules don't understand", async () => {
    const interpret = vi.fn(async () => null);
    const { say } = setup({ interpret });
    await say("Call my daughter");
    expect(interpret).not.toHaveBeenCalled();
    await say("Who wrote Pride and Prejudice?");
    expect(interpret).toHaveBeenCalledTimes(1);
  });

  it("uses a validated AI intent, but our own wording for actions", async () => {
    const { say } = setup({ interpret: async () => ({ intent: { intent: "CALL_CONTACT", parameters: { contact: "grandson" } }, reply: "Dialling now!!!" }) });
    const r = await say("could you get my grandson on the blower");
    expect(r.text).toContain("call your grandson");
    expect(r.proposedActions?.[0]).toMatchObject({ kind: "call", risk: "high", params: { contact: "grandson" } });
  });

  it("shows AI answers to questions", async () => {
    const { say } = setup({ interpret: async () => ({ intent: { name: "FIND_INFORMATION", params: { query: "x" } }, reply: "Jane Austen wrote it in 1813." }) });
    expect((await say("Who wrote Pride and Prejudice?")).text).toBe("Jane Austen wrote it in 1813.");
  });

  it("ignores made-up intents and dangerous fields from the AI", async () => {
    const { say } = setup({ interpret: async () => ({ intent: { name: "RUN_COMMAND", params: { cmd: "rm -rf /" } } }) });
    const r = await say("zap the thing with the stuff");
    expect(r.proposedActions).toBeUndefined();
    expect(r.text).toContain("didn't quite understand");
  });

  it("refuses AI-chosen apps that aren't allowed", async () => {
    const { say } = setup({ interpret: async () => ({ intent: { name: "OPEN_APPLICATION", params: { app: "bank-transfer" } } }) });
    expect((await say("open sesame")).proposedActions).toBeUndefined();
  });

  it("passes network errors on so the UI can say so", async () => {
    const { say } = setup({ interpret: async () => { throw new AssistantError("network"); } });
    await expect(say("Who wrote Pride and Prejudice?")).rejects.toMatchObject({ code: "network" });
  });

  it("falls back to its own words when the AI breaks", async () => {
    const { say } = setup({ interpret: async () => { throw new AssistantError("unknown", "bad json"); } });
    expect((await say("tell me something nice")).text).toBeTruthy();
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    const assistant = createAssistant({
      provider: { interpret: (_r, signal) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))) },
    });
    const p = assistant.send({ text: "Who is the king?", source: "text", history: [], language: "en-US", hints: { plainLanguage: true, willBeSpoken: false } }, { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
