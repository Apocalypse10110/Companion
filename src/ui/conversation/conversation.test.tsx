import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AssistantError } from "@/contracts";
import { HomeScreen } from "../screens/HomeScreen";
import { createFakeServices } from "../testing/fakeServices";
import { renderApp } from "../testing/render";

const reply = (over = {}) => ({ id: "r1", text: "Sure, I can help.", ...over });
const call = { id: "a1", kind: "call", title: "Call Anna", risk: "high" as const, params: { to: "anna" } };
const lowRisk = { id: "a2", kind: "reminder", title: "Remind me at 8", risk: "low" as const, params: {} };

async function typeAndSend(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Type instead" }));
  await user.type(screen.getByLabelText("Type your message"), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
  return user;
}

describe("talking to the assistant", () => {
  it("voice: listen, show live words, send what was heard, show and speak the reply with the person's voice settings", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<HomeScreen />, { settings: { speechRate: 0.7, volume: 0.6, voiceId: "v2" } });

    await user.click(screen.getByRole("button", { name: "Tap to talk" }));
    expect(controls.micStarts).toBe(1);
    expect(screen.getByRole("button", { name: "Listening. Tap when done" })).toBeInTheDocument();

    act(() => controls.emitInterim("Call my"));
    expect(screen.getByTestId("interim")).toHaveTextContent("Call my");

    act(() => controls.emitFinal("Call my daughter"));
    await user.click(screen.getByRole("button", { name: "Listening. Tap when done" }));

    expect(controls.requests[0]).toMatchObject({ text: "Call my daughter", source: "voice", hints: { plainLanguage: true, willBeSpoken: true } });
    expect(screen.getByRole("button", { name: "Thinking. Tap to cancel" })).toBeInTheDocument();

    await act(async () => controls.resolveAssistant(reply({ spokenText: "Sure thing." })));
    expect(screen.getByText("Sure, I can help.")).toBeInTheDocument();
    await waitFor(() => expect(controls.spoken).toHaveLength(1));
    expect(controls.spoken[0]).toMatchObject({ text: "Sure thing.", options: { rate: 0.7, volume: 0.6, voiceId: "v2" } });
    expect(screen.getByRole("button", { name: "Speaking. Tap to stop" })).toBeInTheDocument();

    await act(async () => controls.finishSpeaking());
    expect(screen.getByRole("button", { name: "Tap to talk" })).toBeInTheDocument();
  });

  it("does not speak when the person turned reading aloud off", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    await typeAndSend("hello");
    expect(controls.requests[0].hints.willBeSpoken).toBe(false);
    await act(async () => controls.resolveAssistant(reply()));
    expect(screen.getByText("Sure, I can help.")).toBeInTheDocument();
    expect(controls.spoken).toHaveLength(0);
  });

  it("hearing nothing gives a kind message instead of sending an empty request", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<HomeScreen />);
    await user.click(screen.getByRole("button", { name: "Tap to talk" }));
    act(() => controls.endMic());
    expect(controls.requests).toHaveLength(0);
    expect(screen.getByText(/I didn't hear anything/)).toBeInTheDocument();
  });

  it("microphone not yet allowed: explains first, asks only when the person agrees, then listens", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<HomeScreen />);
    controls.setPermission("microphone", "prompt");

    await user.click(screen.getByRole("button", { name: "Tap to talk" }));
    expect(controls.micStarts).toBe(0);
    expect(controls.permissionRequests).toHaveLength(0);
    expect(await screen.findByText(/I need to use your microphone/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Allow microphone" }));
    await waitFor(() => expect(controls.micStarts).toBe(1));
    expect(controls.permissionRequests).toEqual(["microphone"]);
  });

  it("microphone refused: explains how to fix it and never prompts", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<HomeScreen />);
    controls.setPermission("microphone", "denied");
    await user.click(screen.getByRole("button", { name: "Tap to talk" }));
    expect(await screen.findByText(/microphone is turned off/)).toBeInTheDocument();
    expect(controls.micStarts).toBe(0);
    expect(controls.permissionRequests).toHaveLength(0);
  });

  it("no voice support on this device: opens typing straight away", () => {
    renderApp(<HomeScreen />, { voiceInput: false });
    expect(screen.getByLabelText("Type your message")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tap to talk" })).not.toBeInTheDocument();
    expect(screen.getByText(/Talking isn.t available on this device yet/)).toBeInTheDocument();
  });

  it("quick action sends a plain sentence tagged with its id", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<HomeScreen />);
    await user.click(screen.getByRole("button", { name: "Reminders" }));
    expect(controls.requests[0]).toMatchObject({ source: "quick-action", quickActionId: "reminders", text: "I want to set or hear a reminder." });
  });

  it("sends earlier turns as history", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("first");
    await act(async () => controls.resolveAssistant(reply({ text: "one" })));
    await user.type(screen.getByLabelText("Type your message"), "second");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(controls.requests[1].history).toEqual([
      { role: "user", text: "first" },
      { role: "assistant", text: "one" },
    ]);
  });
});

describe("errors and cancelling", () => {
  it("assistant not connected: friendly message, and Try again resends the same thing", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("help me");
    await act(async () => controls.rejectAssistant(new AssistantError("unavailable")));
    const alert = screen.getByText(/I'm not connected yet/).closest("[role=alert]") as HTMLElement;
    expect(alert).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(controls.requests).toHaveLength(2);
    expect(controls.requests[1].text).toBe("help me");
    expect(screen.queryByText(/I'm not connected yet/)).not.toBeInTheDocument();
  });

  it("network error and unknown errors get their own wording", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("a");
    await act(async () => controls.rejectAssistant(new AssistantError("network")));
    expect(screen.getByText(/can't reach the internet/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Type your message"), "b");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => controls.rejectAssistant(new Error("boom")));
    expect(screen.getByText(/Something went wrong on my side/)).toBeInTheDocument();
  });

  it("Cancel stops waiting and shows no error", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("slow thing");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Thinking…")).not.toBeInTheDocument());
    expect(screen.queryByText(/I couldn't do that|went wrong|taking too long/)).not.toBeInTheDocument();
    // A late answer from the cancelled request is ignored.
    await act(async () => controls.resolveAssistant(reply({ text: "too late" })));
    expect(screen.queryByText("too late")).not.toBeInTheDocument();
  });
});

describe("actions are always the person's choice", () => {
  it("high-risk action waits for Yes and runs exactly once", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("call anna");
    await act(async () => controls.resolveAssistant(reply({ proposedActions: [call] })));
    expect(screen.getByText("Should I do this?")).toBeInTheDocument();
    expect(controls.executed).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Yes, do it: Call Anna" }));
    expect(await screen.findByText(/Done\. Done: Call Anna\./)).toBeInTheDocument();
    expect(controls.executed).toEqual([call]);
    expect(screen.queryByRole("button", { name: /Yes, do it/ })).not.toBeInTheDocument();
  });

  it("No thanks never runs it", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("call anna");
    await act(async () => controls.resolveAssistant(reply({ proposedActions: [call] })));
    await user.click(screen.getByRole("button", { name: "No thanks: Call Anna" }));
    expect(screen.getByText("You said no. I did not do this.")).toBeInTheDocument();
    expect(controls.executed).toHaveLength(0);
  });

  it("with asking turned off, low-risk runs by itself but high-risk still asks", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false, confirmActions: false } });
    await typeAndSend("do both");
    await act(async () => controls.resolveAssistant(reply({ proposedActions: [call, lowRisk] })));
    await waitFor(() => expect(controls.executed).toEqual([lowRisk]));
    expect(screen.getByRole("button", { name: "Yes, do it: Call Anna" })).toBeInTheDocument();
  });

  it("failure because of a missing permission offers to ask, then retries", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("remind me");
    await act(async () => controls.resolveAssistant(reply({ proposedActions: [lowRisk] })));
    controls.setNextActionResult({ ok: false, message: "I need permission to send reminders.", needsPermission: "notifications" });
    await user.click(screen.getByRole("button", { name: "Yes, do it: Remind me at 8" }));
    expect(await screen.findByText("I need permission to send reminders.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Allow notifications" }));
    await waitFor(() => expect(controls.executed).toHaveLength(2));
    expect(controls.permissionRequests).toEqual(["notifications"]);
  });

  it("actions this device can't do are shown as unavailable, with no Yes button", async () => {
    const fake = createFakeServices({ supportedActions: ["reminder"] });
    renderApp(<HomeScreen />, { ...fake, settings: { speakReplies: false } });
    await typeAndSend("call");
    await act(async () => fake.controls.resolveAssistant(reply({ proposedActions: [call] })));
    expect(screen.getByText(/can't do this on this device yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yes, do it/ })).not.toBeInTheDocument();
  });
});

describe("screen reader announcements", () => {
  it("announces listening and the reply in the live region, and stays quiet when turned off", async () => {
    const user = userEvent.setup();
    const { controls, unmount } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    await user.click(screen.getByRole("button", { name: "Tap to talk" }));
    await waitFor(() => expect(screen.getByTestId("live-polite")).toHaveTextContent("Listening."));
    act(() => controls.emitFinal("hi"));
    act(() => controls.endMic());
    await act(async () => controls.resolveAssistant(reply()));
    await waitFor(() => expect(screen.getByTestId("live-polite")).toHaveTextContent("Sure, I can help."));
    unmount();

    const quiet = renderApp(<HomeScreen />, { settings: { announcements: false } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Tap to talk" }));
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.getByTestId("live-polite")).toHaveTextContent("");
    quiet.unmount();
  });
});

describe("leaving the screen", () => {
  it("unmounting closes the microphone", async () => {
    const user = userEvent.setup();
    const { controls, unmount } = renderApp(<HomeScreen />);
    await user.click(screen.getByRole("button", { name: "Tap to talk" }));
    unmount();
    expect(controls.micAborts).toBe(1);
  });
});

describe("repeat that", () => {
  it("reads the latest reply aloud again, and is offered only once there is one", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    expect(screen.queryByRole("button", { name: "Repeat that" })).toBeNull();
    const user = await typeAndSend("first");
    await act(async () => controls.resolveAssistant({ id: "r1", text: "First answer." }));
    await user.type(screen.getByLabelText("Type your message"), "second");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => controls.resolveAssistant({ id: "r2", text: "Second answer.", spokenText: "Second, spoken." }));

    await user.click(screen.getByRole("button", { name: "Repeat that" }));
    await waitFor(() => expect(controls.spoken).toHaveLength(1));
    expect(controls.spoken[0].text).toBe("Second, spoken.");
  });

  it("is still there while a yes/no question waits, so the question can be heard again", async () => {
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = await typeAndSend("call anna");
    await act(async () =>
      controls.resolveAssistant({ id: "r", text: "Shall I call Anna?", proposedActions: [{ id: "a", kind: "call", title: "Call Anna", risk: "high", params: {} }] }),
    );
    expect(screen.queryByRole("button", { name: "Start a new conversation" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Repeat that" }));
    await waitFor(() => expect(controls.spoken.map((s) => s.text)).toEqual(["Shall I call Anna?"]));
  });

  it("is not offered when the device cannot speak", async () => {
    const { controls } = renderApp(<HomeScreen />, { voiceOutput: false });
    await typeAndSend("hello");
    await act(async () => controls.resolveAssistant({ id: "r", text: "Hi." }));
    expect(screen.queryByRole("button", { name: "Repeat that" })).toBeNull();
  });
});
