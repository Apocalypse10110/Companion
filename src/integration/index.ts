/**
 * THE ONE PLACE where the UI is wired to the other developers' work.
 *
 * Developer B: replace `assistant`, `voiceInput`, `voiceOutput`.
 * Developer C: replace `actions`, `permissions`, `connections`.
 *
 * Each is a one-line change. Do not edit anything under src/ui or src/app
 * to connect your service. If the contract doesn't fit, open a discussion
 * (see docs/CONTRACTS.md) rather than changing the UI.
 */

import type { Services } from "@/contracts";
import { assistant } from "@/ai";
import { voiceInput, voiceOutput } from "@/voice";
import { actions } from "@/actions";
import { permissions } from "@/permissions";
import { unconfiguredServices } from "./unconfigured";

export const services: Services = {
  assistant, // Developer B
  voiceInput, // Developer B
  voiceOutput, // Developer B
  actions, // Developer C: calls, messages, apps, reminders, settings (src/actions)
  permissions, // Developer C: microphone, notifications, camera (src/permissions)
  // Google sign-in is not built yet; this honestly shows "Not available yet".
  connections: unconfiguredServices.connections, // Developer C
};
