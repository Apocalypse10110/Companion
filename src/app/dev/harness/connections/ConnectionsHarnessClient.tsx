"use client";

import { useMemo } from "react";
import { ConnectionsSettings } from "@/ui/screens/settings/ConnectionsSettings";
import { Providers } from "@/ui/shell/Providers";
import { createDemoServices } from "@/ui/testing/fakeServices";
import { DEFAULT_SETTINGS } from "@/ui/settings/types";

export function ConnectionsHarnessClient() {
  const services = useMemo(() => createDemoServices(), []);
  return (
    <Providers services={services} initialSettings={{ ...DEFAULT_SETTINGS, onboardingComplete: true }}>
      <ConnectionsSettings />
    </Providers>
  );
}
