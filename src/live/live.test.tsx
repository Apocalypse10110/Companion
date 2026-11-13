import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LIVE_MODELS, handleLiveToken, liveModels } from "@/ai/server/live";
import { LiveScreen } from "@/ui/live/LiveScreen";
import { renderApp } from "@/ui/testing/render";
import { base64ToBytes, bytesToBase64, fitWithin, pcm16ToFloat, rateOf } from "./pcm";
import { fetchLiveToken } from "./session";

const post = (body: unknown = {}, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/live/token", { method: "POST", headers: { origin, host: "localhost:3000" }, body: JSON.stringify(body) });

describe("Live Help token (server)", () => {
  it("never answers other sites, and says when it's not set up", async () => {
    expect((await handleLiveToken(post({}, "https://evil.example"), vi.fn(), DEFAULT_LIVE_MODELS)).status).toBe(403);
    expect((await handleLiveToken(post(), null, DEFAULT_LIVE_MODELS)).status).toBe(503);
  });

  it("returns only a short-lived token, locked to the chosen model", async () => {
    const make = vi.fn(async (model: string) => ({ token: "auth_tokens/abc", expiresAt: "2026-11-13T10:15:00Z", model }));
    const res = await handleLiveToken(post({ attempt: 1 }), make, ["a-live", "b-live"]);
    expect(make).toHaveBeenCalledWith("b-live");
    const body = await res.json();
    expect(body).toEqual({ token: "auth_tokens/abc", model: "b-live", expiresAt: "2026-11-13T10:15:00Z", hasFallback: false });
    expect(JSON.stringify(body)).not.toMatch(/AIza/);
  });

  it("refuses an attempt past the last model", async () => {
    expect((await handleLiveToken(post({ attempt: 5 }), vi.fn(), ["a"])).status).toBe(400);
  });

  it("a key error is not passed on", async () => {
    const res = await handleLiveToken(post(), async () => { throw Object.assign(new Error("API key not valid AIzaSECRET"), { status: 400 }); }, ["a"]);
    expect(JSON.stringify(await res.json())).not.toMatch(/AIza/);
  });

  it("reads GEMINI_LIVE_MODEL as a list, ignoring junk", () => {
    expect(liveModels({ GEMINI_LIVE_MODEL: "x-live, bad model!, y-live" })).toEqual(["x-live", "y-live"]);
    expect(liveModels({})).toEqual(DEFAULT_LIVE_MODELS);
  });
});

describe("Live Help token (phone)", () => {
  it("turns server answers into plain problems", async () => {
    const reply = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    await expect(fetchLiveToken(0, reply(503))).rejects.toMatchObject({ problem: "not-configured" });
    await expect(fetchLiveToken(0, reply(429))).rejects.toMatchObject({ problem: "busy" });
    await expect(fetchLiveToken(0, reply(200, { token: "AIzaPermanent", model: "m" }))).rejects.toMatchObject({ problem: "unknown" });
    await expect(fetchLiveToken(0, reply(200, { token: "auth_tokens/x", model: "m", hasFallback: true }))).resolves.toMatchObject({ model: "m", hasFallback: true });
  });
});

describe("audio helpers", () => {
  it("round-trips base64 and decodes 16-bit PCM", () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(Array.from(pcm16ToFloat(bytes))).toEqual([0.5, -0.5]);
  });

  it("reads the sample rate and fits frames", () => {
    expect(rateOf("audio/pcm;rate=24000")).toBe(24000);
    expect(rateOf("audio/pcm")).toBe(24000);
    expect(fitWithin(1920, 1080, 768)).toEqual({ width: 768, height: 432 });
    expect(fitWithin(300, 200, 768)).toEqual({ width: 300, height: 200 });
  });
});

describe("Live Help screen", () => {
  it("in a browser that can't do it, offers Show Me instead", async () => {
    await act(async () => {
      renderApp(<LiveScreen />);
    });
    expect(screen.getByRole("button", { name: "Start Live Help" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Use Show Me with a photo instead" })).toBeEnabled();
  });

  it("a camera that won't start falls back to Show Me, with the reason", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn(async () => { throw Object.assign(new Error("no"), { name: "NotAllowedError" }); }) },
      configurable: true,
    });
    const g = globalThis as Record<string, unknown>;
    g.AudioContext = class {};
    g.AudioWorkletNode = class {};
    await act(async () => {
      renderApp(<LiveScreen />);
    });
    await user.click(screen.getByRole("button", { name: "Start Live Help" }));
    expect(await screen.findByText("Live Help isn't available right now. Let's use Show Me instead.", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Show Me" })).toBeInTheDocument();
    delete g.AudioContext;
    delete g.AudioWorkletNode;
  });
});

