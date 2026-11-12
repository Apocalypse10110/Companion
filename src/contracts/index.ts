/**
 * Shared contracts between the three developers.
 *
 *   Developer A (mobile UI)   -> consumes every service below
 *   Developer B (AI + voice)  -> implements AssistantService, VoiceInputService, VoiceOutputService
 *   Developer C (actions)     -> implements ActionService, PermissionsService, ConnectionsService
 *
 * Change these files only by agreement. See docs/CONTRACTS.md.
 */

export * from "./actions";
export * from "./assistant";
export * from "./connections";
export * from "./permissions";
export * from "./voice";

import type { ActionService } from "./actions";
import type { AssistantService } from "./assistant";
import type { ConnectionsService } from "./connections";
import type { PermissionsService } from "./permissions";
import type { VoiceInputService, VoiceOutputService } from "./voice";

/** Everything the UI needs from the other developers, in one object. */
export interface Services {
  assistant: AssistantService;
  voiceInput: VoiceInputService;
  voiceOutput: VoiceOutputService;
  actions: ActionService;
  permissions: PermissionsService;
  /** Linked accounts such as Google Calendar and Gmail. */
  connections: ConnectionsService;
}
