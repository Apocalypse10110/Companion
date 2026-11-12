"use client";

import type { ReactNode } from "react";
import type { Services } from "@/contracts";
import { ServicesProvider } from "@/integration/ServicesProvider";
import { LiveAnnouncer } from "../a11y/LiveAnnouncer";
import { ConversationProvider } from "../conversation/ConversationProvider";
import { SettingsProvider } from "../settings/SettingsProvider";
import type { Settings } from "../settings/types";

/** Everything the screens depend on, in the right order. Tests can pass services and settings. */
export function Providers({
  children,
  services,
  initialSettings,
}: {
  children: ReactNode;
  services?: Services;
  initialSettings?: Settings;
}) {
  return (
    <SettingsProvider initial={initialSettings}>
      <ServicesProvider services={services}>
        <LiveAnnouncer>
          <ConversationProvider>{children}</ConversationProvider>
        </LiveAnnouncer>
      </ServicesProvider>
    </SettingsProvider>
  );
}
