import { describe, expect, it, vi } from "vitest";
import { STALL_LINES, busyMinutes, isSafeBaitLine, parseThread, stallLine } from "./scamBait";
import { geminiWriter, handleScamBait } from "./server/scamBait";

const post = (body: unknown) =>
  new Request("http://x/api/scam-bait", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const thread = [{ from: "scammer", text: "Your parcel is on hold. Pay £1.99 at the link." }];

describe("Doris never gives anything real", () => {
  it.each([
    "My card number is 4111 1111 1111 1111",
    "Call me on 07700-900-123",
    "The code is 4821",
    "Go to www.example.com",
    "Visit https://example.org",
    "email me at doris@example.com",
    "My PIN is the cat's birthday",
  ])("rejects: %s", (line) => expect(isSafeBaitLine(line)).toBe(false));

  it("accepts a harmless stall", () => {
    expect(isSafeBaitLine("Oh dear, I'm 81 and I can't find my glasses. Which button is it?")).toBe(true);
  });

  it("every fallback line is safe", () => {
    for (const l of STALL_LINES) expect(isSafeBaitLine(l)).toBe(true);
  });
});

describe("thread handling", () => {
  it("must end with the scammer's message", () => {
    expect(parseThread([{ from: "doris", text: "hi" }])).toBeNull();
    expect(parseThread("nope")).toBeNull();
    expect(parseThread([{ from: "scammer", text: "  hello\nthere " }])).toEqual([{ from: "scammer", text: "hello there" }]);
  });

  it("stall lines move on as the game goes", () => {
    expect(stallLine([{ from: "scammer", text: "x" }])).toBe(STALL_LINES[0]);
    expect(stallLine([{ from: "scammer", text: "x" }, { from: "doris", text: "y" }, { from: "scammer", text: "z" }])).toBe(STALL_LINES[1]);
  });

  it("counts minutes from the scammer's first message to their last", () => {
    expect(busyMinutes([0])).toBe(0);
    expect(busyMinutes([0, 14 * 60_000 + 10_000])).toBe(14);
  });
});

describe("/api/scam-bait", () => {
  it("uses the AI's line when it is safe", async () => {
    const res = await handleScamBait(post({ thread }), async () => "Oh hello dear! Is this about my wool?");
    expect(await res.json()).toEqual({ reply: "Oh hello dear! Is this about my wool?", source: "ai" });
  });

  it("swaps an unsafe line for a stall", async () => {
    const res = await handleScamBait(post({ thread }), async () => "Sure, my card is 4111 1111 1111 1111");
    expect(await res.json()).toEqual({ reply: STALL_LINES[0], source: "lines" });
  });

  it("works with no AI at all", async () => {
    const res = await handleScamBait(post({ thread }), null);
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("lines");
  });

  it("rejects a bad body", async () => {
    expect((await handleScamBait(post({ thread: [] }), null)).status).toBe(400);
  });

  it("asks Gemini with Doris's rules and reads its JSON", async () => {
    const generateContent = vi.fn(async () => ({ text: '{"reply":"Hold on dear, the kettle!"}' }));
    const write = geminiWriter({}, { models: { generateContent } } as never)!;
    expect(await write([{ from: "scammer", text: "Pay now" }])).toBe("Hold on dear, the kettle!");
    const call = (generateContent.mock.calls[0] as unknown as [{ config: { systemInstruction: string } }])[0];
    expect(call.config.systemInstruction).toMatch(/Never, ever/);
  });

  it("has no writer without a key", () => {
    expect(geminiWriter({})).toBeNull();
  });
});
