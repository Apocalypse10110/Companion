/**
 * THE ONE PLACE where the UI is wired to the other developers' work.
 *
 * Developer B: replace `assistant`, `voiceInput`, `voiceOutput`.
 * Developer C: replace `actions`, `permissions`.
 *
 * Each is a one-line change. Do not edit anything under src/ui or src/app
 * to connect your service. If the contract doesn't fit, open a discussion
 * (see docs/CONTRACTS.md) rather than changing the UI.
 */

import type { Services } from "@/contracts";
import { assistant } from "@/ai";
import { voiceInput, voiceOutput } from "@/voice";
import { unconfiguredServices } from "./unconfigured";

export const services: Services = {
  assistant, // Developer B
  voiceInput, // Developer B
  voiceOutput, // Developer B
  actions: unconfiguredServices.actions, // Developer C
  permissions: unconfiguredServices.permissions, // Developer C
};
