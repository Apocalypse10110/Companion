import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { handleSummarize } from "@/ai/server/summarize";
import { cleanLesson, forgetAllLessons, loadLessons, saveLesson } from "@/lessons/store";
import { CheckStep } from "./conversation/CheckStep";
import { reminderTime, reminderTitle } from "./conversation/DocumentCard";
import { labelStyle } from "./conversation/TapHere";
import { LessonCard } from "./lessons/LessonCardScreen";
import { lessonFromTurns } from "./lessons/SaveLessonButton";
import { ScamVerdict } from "./safety/ScamVerdict";
import { skillSummary } from "./skills/SkillsScreen";

describe("Check my step", () => {
  it("offers the three answers and a photo check", async () => {
    const user = userEvent.setup();
    const replies: string[] = [];
    render(<CheckStep onReply={(t) => replies.push(t)} onCheckPhoto={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "I've done it" }));
    await user.click(screen.getByRole("button", { name: "Show me again" }));
    await user.click(screen.getByRole("button", { name: "That didn't work" }));
    expect(replies).toEqual(["I've done it", "Show me again", "That didn't work"]);
    expect(screen.getByRole("button", { name: "Check my screen with a photo" })).toBeInTheDocument();
  });
});

describe("Scam warning", () => {
  it("a scam: STOP, the reasons, and how to check safely", () => {
    render(<ScamVerdict check={{ verdict: "scam", reasons: ["It asks for a fee through a link"] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("STOP. This message may be a scam.");
    expect(screen.getByText("It asks for a fee through a link")).toBeInTheDocument();
    expect(screen.getByText("How to check safely")).toBeInTheDocument();
  });

  it("never calls a message definitely safe", () => {
    render(<ScamVerdict check={{ verdict: "safe", reasons: [] }} />);
    expect(screen.getByText("I didn't find warning signs.")).toBeInTheDocument();
    expect(screen.getByText(/doesn't prove it's genuine/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Point at a bill", () => {
  it("reminds the day before at 10, or on the day if that's passed", () => {
    const now = new Date("2026-11-13T09:00:00");
    expect(reminderTime("2026-11-20", now)?.toString()).toBe(new Date("2026-11-19T10:00:00").toString());
    expect(reminderTime("2026-11-14", new Date("2026-11-13T11:00:00"))?.toString()).toBe(new Date("2026-11-14T10:00:00").toString());
    expect(reminderTime("2026-11-01", now)).toBeNull();
  });

  it("names the reminder from what was read", () => {
    expect(reminderTitle({ organization: "City Power", amount: "$84.20", unclear: [] })).toBe("Pay City Power bill ($84.20)");
    expect(reminderTitle({ unclear: [] })).toBe("Pay the bill");
  });
});

describe("Tap here label", () => {
  it("goes below the ring, or above it near the bottom", () => {
    expect(labelStyle([100, 100, 200, 300])).toHaveProperty("top");
    expect(labelStyle([850, 100, 950, 300])).toHaveProperty("bottom");
  });
});

describe("Fridge Card", () => {
  it("prints a title, numbered steps and the 'help again' line", () => {
    render(<LessonCard lesson={{ id: "1", skill: "connect to wifi", title: "How to connect to Wi-Fi", steps: ["Open Settings.", "Tap Wi-Fi."], troubleshooting: ["Restart the router."], createdAt: "" }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How to connect to Wi-Fi");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/I can help again any time/)).toBeInTheDocument();
  });

  it("checks lessons and keeps one per skill", () => {
    forgetAllLessons();
    expect(cleanLesson({ title: "x", steps: [] })).toBeNull();
    saveLesson({ skill: "send a photo", title: "A", steps: ["1"], troubleshooting: [] });
    saveLesson({ skill: "send a photo", title: "B", steps: ["1"], troubleshooting: [] });
    expect(loadLessons().map((l) => l.title)).toEqual(["B"]);
  });

  it("without the AI, a card is made from Companion's own steps", () => {
    const card = lessonFromTurns("send a photo", [
      { role: "user", text: "how?" },
      { role: "assistant", text: "Open Photos." },
    ]);
    expect(card.steps).toEqual(["Open Photos."]);
  });

  it("the summarize route refuses other sites and checks what the AI wrote", async () => {
    const post = (body: unknown, origin = "http://localhost:3000") =>
      new Request("http://localhost:3000/api/summarize", { method: "POST", headers: { origin, host: "localhost:3000" }, body: JSON.stringify(body) });
    const history = [{ role: "user", text: "wifi?" }, { role: "assistant", text: "Open Settings." }];
    expect((await handleSummarize(post({ kind: "lesson", history }, "https://evil.example"), vi.fn())).status).toBe(403);
    expect((await handleSummarize(post({ kind: "lesson", history }), null)).status).toBe(503);
    const good = await handleSummarize(post({ kind: "lesson", history }), async () => ({ title: "How to connect", steps: ["Open Settings."] }));
    expect(await good.json()).toEqual({ title: "How to connect", steps: ["Open Settings."], troubleshooting: [] });
    const badNote = await handleSummarize(post({ kind: "family", history }), async () => ({ note: "Call me on 07700 900123 now" }));
    expect(badNote.status).toBe(502);
  });
});

describe("My Skills wording", () => {
  it("is encouraging and has no scores", () => {
    expect(skillSummary({ name: "x", times: 0, firstLearned: "", lastDone: "" })).toMatch(/everyone starts/);
    const learned = skillSummary({ name: "x", times: 4, independent: 3, firstLearned: "", lastDone: new Date().toISOString() });
    expect(learned).toBe("Done on your own 3 times. Last done today.");
  });
});
