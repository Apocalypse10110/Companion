import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkCalendar, readEmail } from "@/actions/accounts";
import { listAccounts } from "./server/handlers";
import { isSampleOn, sampleEvents, setSampleOn } from "./sample";

const NOW = new Date(2026, 10, 13, 9, 0, 0);
const neverFetch = vi.fn(async () => {
  throw new Error("must not call the server in sample mode");
}) as unknown as typeof fetch;

beforeEach(() => localStorage.clear());

describe("sample inbox and calendar", () => {
  it("is off by default and remembered when turned on", () => {
    expect(isSampleOn()).toBe(false);
    setSampleOn(true);
    expect(isSampleOn()).toBe(true);
  });

  it("reads sample emails, clearly labelled, without touching the server", async () => {
    setSampleOn(true);
    const r = await readEmail(neverFetch, NOW);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/^This is the sample inbox\. You have 3 unread emails\. The latest is from Sarah, about "Lunch on Sunday\?"/);
  });

  it("reads the sample calendar for tomorrow, labelled", async () => {
    setSampleOn(true);
    const r = await checkCalendar("tomorrow", neverFetch, NOW, "en-GB");
    expect(r.message).toMatch(/^This is the sample calendar\. You have 1 thing on your calendar tomorrow\. Dentist, at 10:30/);
  });

  it("sample events fall in the right days", () => {
    const days = sampleEvents(NOW).map((e) => new Date(e.start).getDate());
    expect(days).toEqual([13, 14, 15, 17]);
  });

  it("when nothing is connected, it points to the sample", async () => {
    const r = await readEmail((async () => new Response("{}", { status: 409 })) as unknown as typeof fetch, NOW);
    expect(r.message).toContain("sample inbox");
  });
});

describe("Spotify needs no sign-in to work", () => {
  it("shows as working without keys, not 'not set up'", async () => {
    const list = await listAccounts(new Request("https://x.example/api/accounts"), { ACCOUNTS_SECRET: "x".repeat(40) }).json();
    expect(list.find((a: { id: string }) => a.id === "spotify")).toMatchObject({ state: "unavailable", worksWithoutSignIn: true });
    expect(list.find((a: { id: string }) => a.id === "spotify").message).toMatch(/Works without signing in/);
  });
});
