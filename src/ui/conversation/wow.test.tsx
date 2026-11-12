import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { addPerson, loadPeople, removePerson } from "@/people/store";
import { HomeScreen } from "../screens/HomeScreen";
import { renderApp } from "../testing/render";
import { pickHelpers } from "./FamilyNote";
import { TapHere, ringStyle } from "./TapHere";

const PHOTO = "data:image/jpeg;base64,AAAA";

describe("Tap here", () => {
  it("places the ring over the box, with a little room around it", () => {
    expect(ringStyle([500, 200, 600, 800])).toEqual({ top: "47.5%", left: "17.5%", width: "65%", height: "15%" });
    // Never past the edge of the photo.
    expect(ringStyle([0, 0, 990, 40])).toMatchObject({ top: "0%", left: "0%", height: "100%" });
  });

  it("shows the ring and says what to tap", () => {
    render(<TapHere photo={PHOTO} pointAt={{ label: "Manage Storage", box: [800, 100, 880, 900] }} />);
    expect(screen.getByTestId("tap-here-ring")).toBeInTheDocument();
    expect(screen.getByText("Tap here: Manage Storage")).toBeInTheDocument();
    expect(screen.getByAltText(/A ring marks where to tap: Manage Storage/)).toBeInTheDocument();
  });

  it("a task done before: they try first, then 'Show me where' reveals the ring", async () => {
    const user = userEvent.setup();
    const revealed: string[] = [];
    render(<TapHere photo={PHOTO} pointAt={{ label: "Settings", box: [100, 100, 200, 200], hidden: true }} onReveal={(l) => revealed.push(l)} />);
    expect(screen.queryByTestId("tap-here-ring")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show me where" }));
    expect(screen.getByTestId("tap-here-ring")).toBeInTheDocument();
    expect(revealed).toEqual(["Settings"]);
  });
});

describe("Help Card to family", () => {
  afterEach(() => loadPeople().forEach((p) => removePerson(p.id)));

  it("puts family first", () => {
    const people = [
      { id: "1", name: "Dr Lee", relationship: "doctor", phone: "1" },
      { id: "2", name: "Anna", relationship: "daughter", phone: "2" },
      { id: "3", name: "Bob", phone: "3" },
    ];
    expect(pickHelpers(people).map((p) => p.name)).toEqual(["Anna", "Dr Lee", "Bob"]);
  });

  it("offers the note, and sending it goes through the normal confirm card", async () => {
    addPerson({ name: "Anna", phone: "07700900123", relationship: "daughter" });
    const user = userEvent.setup();
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    await user.click(screen.getByRole("button", { name: "Type instead" }));
    await user.type(screen.getByLabelText("Type your message"), "I got a text about a parcel");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () =>
      controls.resolveAssistant({
        id: "r1",
        text: "That looks like a scam. Don't tap anything in it.",
        familyNote: "I got a text saying my parcel is on hold. Companion thinks it's a scam. I didn't tap anything.",
      }),
    );

    expect(screen.getByText("Let your family know?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send to Anna (daughter)" }));

    // Nothing is sent yet: a confirm card shows the exact words.
    expect(controls.executed).toHaveLength(0);
    expect(screen.getByText("Send a message to Anna")).toBeInTheDocument();
    expect(screen.getAllByText(/my parcel is on hold/).length).toBeGreaterThan(1);
  });

  it("with nobody saved, it points to People", async () => {
    const user = userEvent.setup();
    const { controls } = renderApp(<HomeScreen />, { settings: { speakReplies: false } });
    await user.click(screen.getByRole("button", { name: "Type instead" }));
    await user.type(screen.getByLabelText("Type your message"), "help");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => controls.resolveAssistant({ id: "r1", text: "Let's try again.", familyNote: "I'm stuck setting up my email." }));
    expect(screen.getByRole("link", { name: "Add a person" })).toHaveAttribute("href", "/settings/people");
  });
});
