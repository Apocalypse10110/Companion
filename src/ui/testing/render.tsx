import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Services } from "@/contracts";
import { Providers } from "../shell/Providers";
import { DEFAULT_SETTINGS, type Settings } from "../settings/types";
import { createFakeServices, type FakeControls } from "./fakeServices";

/** Render a screen with all providers, scripted services and chosen settings. */
export function renderApp(
  ui: ReactElement,
  options: {
    services?: Services;
    controls?: FakeControls;
    settings?: Partial<Settings>;
    voiceInput?: boolean;
    voiceOutput?: boolean;
  } = {},
): RenderResult & { controls: FakeControls; services: Services } {
  const fake = options.services && options.controls ? { services: options.services, controls: options.controls } : createFakeServices({ voiceInput: options.voiceInput, voiceOutput: options.voiceOutput });
  const result = render(
    <Providers services={fake.services} initialSettings={{ ...DEFAULT_SETTINGS, onboardingComplete: true, ...options.settings }}>
      {ui}
    </Providers>,
  );
  return Object.assign(result, { controls: fake.controls, services: fake.services });
}
