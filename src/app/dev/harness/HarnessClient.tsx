"use client";

import { useMemo } from "react";
import { HomeScreen } from "@/ui/screens/HomeScreen";
import { Providers } from "@/ui/shell/Providers";
import { createDemoServices } from "@/ui/testing/fakeServices";
import { DEFAULT_SETTINGS } from "@/ui/settings/types";

export function HarnessClient() {
  const services = useMemo(() => createDemoServices(), []);
  return (
    <Providers services={services} initialSettings={{ ...DEFAULT_SETTINGS, onboardingComplete: true }}>
      <HomeScreen />
    </Providers>
  );
}
