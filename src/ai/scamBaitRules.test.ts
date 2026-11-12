import { describe, expect, it, vi } from "vitest";
import { handleScamBait } from "./server/scamBait";
import { nextLine } from "@/ui/screens/ScamBaitScreen";

const thread = [{ from: "scammer" as const, text: "Your parcel is held. Call 07700 900123 to pay £1.45" }];

function post(headers: Record<string, string>) {
  return new Request("https://companion.example/api/scam-bait", {
    method: "POST",
    headers: { "content-type": "application/json", host: "companion.example", ...headers },
    body: JSON.stringify({ thread }),
  });
}

describe("Scam Bait follows the app's rules", () => {
  it("only Companion's own pages may use the AI key (other websites get 403)", async () => {
    const write = vi.fn(async () => "Oh dear, let me find my glasses.");
    const res = await handleScamBait(post({ origin: "https://evil.example" }), write);
    expect(res.status).toBe(403);
    expect(write).not.toHaveBeenCalled();
    expect((await handleScamBait(post({ origin: "https://companion.example" }), write)).status).toBe(200);
  });

  it("phone numbers in the scam messages never leave the phone", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ reply: "Hello dear" }));
    await nextLine(thread, fetchImpl as unknown as typeof fetch);
    const body = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
    expect(body).not.toMatch(/07700|900123/);
    expect(body).toContain("[phone number]");
  });
});
