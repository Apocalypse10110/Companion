import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { unconfiguredServices } from "@/integration/unconfigured";
import { renderApp } from "../testing/render";
import { createFakeServices } from "../testing/fakeServices";
import { ConnectionsSettings } from "./settings/ConnectionsSettings";

const row = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;

describe("connected accounts", () => {
  it("without Developer C's service, Calendar and Gmail are listed honestly as not available yet", async () => {
    const { controls } = createFakeServices();
    renderApp(<ConnectionsSettings />, { services: unconfiguredServices, controls });
    await screen.findByRole("heading", { name: "Google Calendar" });
    for (const name of ["Google Calendar", "Gmail"]) {
      expect(within(row(name)).getByText("Not available yet")).toBeInTheDocument();
      // No button that would pretend to sign in.
      expect(within(row(name)).queryByRole("button")).toBeNull();
    }
  });

  it("shows which account is connected, in words", async () => {
    renderApp(<ConnectionsSettings />);
    await screen.findByRole("heading", { name: "Google Calendar" });
    expect(within(row("Google Calendar")).getByText("Connected")).toBeInTheDocument();
    expect(within(row("Google Calendar")).getByText("anna.smith@example.com")).toBeInTheDocument();
    expect(within(row("Gmail")).getByText("Not connected")).toBeInTheDocument();
  });

  it("connecting starts the sign-in once, from a tap, and reports the result", async () => {
    const { controls } = renderApp(<ConnectionsSettings />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Connect Gmail" }));
    expect(controls.connectRequests).toEqual(["gmail"]);
    await waitFor(() => expect(within(row("Gmail")).getByText("anna.smith@example.com")).toBeInTheDocument());
    expect(within(row("Gmail")).getByText(/Gmail is connected\./)).toBeInTheDocument();
  });

  it("closing the sign-in is not an error, and a failure offers to try again", async () => {
    const { controls } = renderApp(<ConnectionsSettings />);
    const user = userEvent.setup();
    controls.setNextConnectOutcome("cancel");
    await user.click(await screen.findByRole("button", { name: "Connect Gmail" }));
    expect(await within(row("Gmail")).findByText(/Nothing was changed/)).toBeInTheDocument();
    expect(within(row("Gmail")).queryByText("That didn't work.")).toBeNull();

    controls.setNextConnectOutcome("fail");
    await user.click(screen.getByRole("button", { name: "Connect Gmail" }));
    expect(await within(row("Gmail")).findByText(/couldn't reach Google/)).toBeInTheDocument();
    expect(within(row("Gmail")).getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeEnabled();
  });

  it("disconnecting asks first, and No keeps it connected", async () => {
    const { controls } = renderApp(<ConnectionsSettings />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "No, keep it connected" }));
    expect(controls.disconnectRequests).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(screen.getByRole("button", { name: "Yes, disconnect" }));
    expect(controls.disconnectRequests).toEqual(["google-calendar"]);
    await waitFor(() => expect(within(row("Google Calendar")).getByText("Not connected")).toBeInTheDocument());
  });
});
