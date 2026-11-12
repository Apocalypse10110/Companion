import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { HISTORY_KEY } from "../conversation/history-storage";
import { SETTINGS_KEY } from "../settings/storage";
import { AppFrame } from "../shell/AppFrame";
import { nav } from "../testing/mocks";
import { renderApp } from "../testing/render";
import { HistoryScreen } from "./HistoryScreen";
import { HomeScreen } from "./HomeScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { AccessibilitySettings } from "./settings/AccessibilitySettings";
import { DisplaySettings } from "./settings/DisplaySettings";
import { PrivacySettings } from "./settings/PrivacySettings";
import { SettingsHome } from "./settings/SettingsHome";
import { VoiceSettings } from "./settings/VoiceSettings";

const root = () => document.documentElement;
const saved = () => JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}");
// jsdom cannot compute colours; contrast is covered by tokens.test.ts against the real CSS.
const scan = (el: Element) => axe(el, { rules: { "color-contrast": { enabled: false } } });

describe("every screen passes an automated accessibility scan", () => {
  const screens: Array<[string, ReactElement, string]> = [
    ["Home", <HomeScreen key="h" />, "/"],
    ["History", <HistoryScreen key="hi" />, "/history"],
    ["Settings", <SettingsHome key="s" />, "/settings"],
    ["Display", <DisplaySettings key="d" />, "/settings/display"],
    ["Voice", <VoiceSettings key="v" />, "/settings/voice"],
    ["Accessibility", <AccessibilitySettings key="a" />, "/settings/accessibility"],
    ["Privacy", <PrivacySettings key="p" />, "/settings/privacy"],
    ["Onboarding", <OnboardingScreen key="o" />, "/onboarding"],
  ];
  for (const [name, ui, path] of screens) {
    it(`${name} (inside the app frame, high contrast + largest text)`, async () => {
      nav.pathname = path;
      const { container } = renderApp(<AppFrame>{ui}</AppFrame>, { settings: { highContrast: true, textSize: "largest", theme: "dark" } });
      await waitFor(() => expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1));
      expect(await scan(container)).toHaveNoViolations();
    });
  }

  it("a full conversation with a confirmation card and an error passes too", async () => {
    const { container, controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Type instead" }));
    await user.type(screen.getByLabelText("Type your message"), "call");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => controls.resolveAssistant({ id: "r", text: "Okay.", suggestions: ["More"], proposedActions: [{ id: "a", kind: "call", title: "Call Anna", risk: "high", params: {} }] }));
    await user.type(screen.getByLabelText("Type your message"), "again");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => controls.rejectAssistant(new Error("x")));
    expect(await scan(container)).toHaveNoViolations();
  });
});

describe("settings change real behaviour", () => {
  it("text size, bold, theme, contrast, buttons and spacing all apply to the page and are saved", async () => {
    const user = userEvent.setup();
    renderApp(<DisplaySettings />);
    await waitFor(() => expect(root().style.getPropertyValue("--text-scale")).toBe("1.2"));

    await user.click(screen.getByRole("radio", { name: /Largest/ }));
    expect(root().style.getPropertyValue("--text-scale")).toBe("1.65");

    await user.click(screen.getByRole("radio", { name: /^Dark/ }));
    expect(root().dataset.theme).toBe("dark");

    for (const [label, attr, value] of [
      ["Bold text", "bold", "true"],
      ["High contrast", "contrast", "high"],
      ["Extra large buttons", "buttons", "xl"],
      ["Extra space", "spacing", "normal"], // on by default, so this turns it off
    ] as const) {
      await user.click(screen.getByRole("switch", { name: label }));
      expect(root().dataset[attr]).toBe(value);
    }
    expect(saved()).toMatchObject({ textSize: "largest", theme: "dark", boldText: true, highContrast: true, extraLargeButtons: true, roomySpacing: false });
  });

  it("switches report On/Off in words and in aria-checked", async () => {
    const user = userEvent.setup();
    renderApp(<DisplaySettings />);
    const sw = screen.getByRole("switch", { name: "Bold text" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveTextContent("Off");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveTextContent("On");
  });

  it("hiding quick buttons removes them from the home screen", () => {
    const { unmount } = renderApp(<HomeScreen />);
    expect(screen.getByRole("button", { name: "Call" })).toBeInTheDocument();
    unmount();
    renderApp(<HomeScreen />, { settings: { showQuickActions: false } });
    expect(screen.queryByRole("button", { name: "Call" })).not.toBeInTheDocument();
  });

  it("reduce motion applies to the page and removes the animated listening rings", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp(<AccessibilitySettings />);
    await user.click(screen.getByRole("radio", { name: /Less movement/ }));
    expect(root().dataset.motion).toBe("reduce");
    unmount();

    const { container } = renderApp(<HomeScreen />, { settings: { motion: "reduce" } });
    await user.click(screen.getByRole("button", { name: "Tap to talk" }));
    expect(screen.getByRole("button", { name: "Listening. Tap when done" })).toBeInTheDocument();
    expect(container.querySelector("[data-testid=mic-halo]")).toBeNull();
  });

  it("speed and volume steppers change values within limits, speak in words, and are used for the sample", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<VoiceSettings />, { settings: { speechRate: 0.9, volume: 1 } });
    expect(screen.getByText("A little slow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Slower" }));
    await user.click(screen.getByRole("button", { name: "Slower" }));
    await user.click(screen.getByRole("button", { name: "Slower" }));
    expect(screen.getByText("Slow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slower" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Louder" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Quieter" }));
    expect(screen.getByText("80 percent")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hear an example" }));
    expect(controls.spoken[0].options).toMatchObject({ rate: 0.6, volume: 0.8 });
    expect(saved()).toMatchObject({ speechRate: 0.6, volume: 0.8 });
  });

  it("voice picker appears only when voices exist, and saves the choice", async () => {
    const { createFakeServices } = await import("../testing/fakeServices");
    const fake = createFakeServices({ voices: [{ id: "v1", label: "Clear voice", language: "en-US" }] });
    const user = userEvent.setup();
    renderApp(<VoiceSettings />, fake);
    await user.click(await screen.findByRole("radio", { name: /Clear voice/ }));
    expect(saved().voiceId).toBe("v1");
  });

  it("voice output not connected: says so and disables the sample", () => {
    renderApp(<VoiceSettings />, { voiceOutput: false });
    expect(screen.getByText(/Reading aloud isn't connected yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hear an example" })).toBeDisabled();
  });

  it("reset puts display settings back after confirming, but keeps onboarding done", async () => {
    const user = userEvent.setup();
    renderApp(<AccessibilitySettings />, { settings: { motion: "reduce", haptics: false } });
    await user.click(screen.getByRole("button", { name: "Put all settings back to normal" }));
    await user.click(screen.getByRole("button", { name: "Yes, put them back" }));
    expect(saved()).toMatchObject({ motion: "system", haptics: true, onboardingComplete: true });
  });
});

describe("navigation", () => {
  it("bottom nav has three labelled links and marks the current page", () => {
    nav.pathname = "/settings/voice";
    renderApp(<AppFrame><p>x</p></AppFrame>);
    const navEl = screen.getByRole("navigation", { name: "Main" });
    const links = within(navEl).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Home", "History", "Settings"]);
    expect(within(navEl).getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(within(navEl).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("has a skip link to the main content", () => {
    renderApp(<AppFrame><p>x</p></AppFrame>);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
    expect(document.getElementById("main")).toBeInTheDocument();
  });

  it("first visit sends the person to onboarding; afterwards it does not", async () => {
    renderApp(<AppFrame><p>x</p></AppFrame>, { settings: { onboardingComplete: false } });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/onboarding"));
    nav.replace.mockClear();
    renderApp(<AppFrame><p>y</p></AppFrame>);
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("settings sub-pages have a labelled Back link", () => {
    renderApp(<DisplaySettings />);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });
});

describe("onboarding", () => {
  it("walks through 5 steps, moves focus to each heading, and only asks for the microphone on its step when tapped", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<OnboardingScreen />, { settings: { onboardingComplete: false } });
    controls.setPermission("microphone", "prompt");
    expect(screen.getByTestId("progress")).toHaveTextContent("Step 1 of 5");

    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(screen.getByRole("heading", { name: "How talking works" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Make it comfortable" })).toHaveFocus();

    await user.click(screen.getByRole("radio", { name: /Larger/ }));
    expect(root().style.getPropertyValue("--text-scale")).toBe("1.4");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(controls.permissionRequests).toHaveLength(0);
    await user.click(await screen.findByRole("button", { name: "Allow microphone" }));
    expect(controls.permissionRequests).toEqual(["microphone"]);
    expect(await screen.findByText(/Microphone is on/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Start using Companion" }));
    expect(saved()).toMatchObject({ onboardingComplete: true, textSize: "larger" });
    expect(nav.replace).toHaveBeenCalledWith("/");
  });

  it("Back works, and Skip finishes immediately without asking for anything", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<OnboardingScreen />, { settings: { onboardingComplete: false } });
    await user.click(screen.getByRole("button", { name: "Get started" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("progress")).toHaveTextContent("Step 1 of 5");
    await user.click(screen.getByRole("button", { name: "Skip the walkthrough" }));
    expect(saved().onboardingComplete).toBe(true);
    expect(controls.permissionRequests).toHaveLength(0);
  });

  it("a refused microphone is explained, and the step can be skipped", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<OnboardingScreen />, { settings: { onboardingComplete: false } });
    controls.setPermission("microphone", "prompt");
    controls.setNextPermissionResult("denied");
    for (const n of ["Get started", "Next", "Next"]) await user.click(screen.getByRole("button", { name: n }));
    await user.click(await screen.findByRole("button", { name: "Allow microphone" }));
    expect(await screen.findByText(/Microphone is off/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
  });
});

describe("history and privacy", () => {
  async function haveAConversation(settings = {}) {
    const r = renderApp(
      <>
        <HomeScreen />
        <HistoryScreen />
        <PrivacySettings />
      </>,
      { settings: { speakReplies: false, ...settings } },
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Type instead" }));
    await user.type(screen.getByLabelText("Type your message"), "Remind me about pills");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => r.controls.resolveAssistant({ id: "r", text: "Okay, reminder noted." }));
    return { ...r, user };
  }

  it("saves conversations on the device and lists them", async () => {
    await haveAConversation();
    await waitFor(() => expect(window.localStorage.getItem(HISTORY_KEY)).toContain("Remind me about pills"));
    expect(screen.getAllByText("Remind me about pills").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 conversation is saved/)).toBeInTheDocument();
  });

  it("does not save when remembering is off", async () => {
    await haveAConversation({ saveHistory: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(screen.getByText(/Not remembering new conversations/)).toBeInTheDocument();
  });

  it("erase asks first, then removes everything from the device", async () => {
    const { user } = await haveAConversation();
    await waitFor(() => expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull());
    await user.click(screen.getByRole("button", { name: "Erase saved conversations" }));
    await user.click(screen.getByRole("button", { name: "No, keep them" }));
    expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Erase saved conversations" }));
    await user.click(screen.getByRole("button", { name: "Yes, erase them" }));
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(screen.getByText("Erased. Nothing is saved on this phone now.")).toBeInTheDocument();
    expect(screen.queryByText("Okay, reminder noted.")).not.toBeInTheDocument();
  });

  it("turning remembering off with saved items asks whether to erase them too", async () => {
    const { user } = await haveAConversation();
    await user.click(screen.getByRole("switch", { name: "Remember my conversations" }));
    await user.click(screen.getByRole("button", { name: "Stop remembering, keep old ones" }));
    expect(saved().saveHistory).toBe(false);
    expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull();
  });

  it("a conversation can be deleted from History after confirming", async () => {
    const { user } = await haveAConversation();
    await user.click(screen.getByRole("button", { name: "Delete this conversation" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });
});
