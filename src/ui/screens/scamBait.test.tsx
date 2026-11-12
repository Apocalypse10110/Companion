import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../testing/render";
import { ScamBaitScreen } from "./ScamBaitScreen";

describe("Scam Bait screen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("paste a scam text, Doris answers, and nothing is sent for them", async () => {
    const fetchMock = vi.fn(async () => Response.json({ reply: "Oh hello dear, which parcel is it?", source: "ai" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderApp(<ScamBaitScreen />);

    expect(screen.getByText(/never sends anything for you/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Paste the scam message here"), "Your parcel is on hold");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Let Doris reply" }));
    });

    expect(await screen.findByText("Oh hello dear, which parcel is it?")).toBeInTheDocument();
    expect(screen.getByText("Scammer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy this reply" })).toBeInTheDocument();
    // No number given: no Messages button.
    expect(screen.queryByRole("button", { name: "Open in Messages" })).toBeNull();
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({
      thread: [{ from: "scammer", text: "Your parcel is on hold" }],
    });

    await user.click(screen.getByRole("button", { name: "I'm done" }));
    expect(screen.getByText(/forward their first message to/)).toBeInTheDocument();
  });

  it("offline, Doris still stalls", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const user = userEvent.setup();
    renderApp(<ScamBaitScreen />);
    await user.type(screen.getByLabelText("Paste the scam message here"), "Pay now");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Let Doris reply" }));
    });
    expect(await screen.findByText(/find my glasses/)).toBeInTheDocument();
  });
});
