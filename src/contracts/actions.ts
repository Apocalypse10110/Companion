/**
 * CONTRACT: actions
 * Proposed by Developer A (mobile UI). Implemented by Developer C.
 *
 * The assistant (Developer B) *proposes* actions. The UI shows them to the
 * person for confirmation. Developer C's ActionService *performs* them.
 * The UI never performs an action itself.
 */

import type { PermissionName } from "./permissions";

/** Known action kinds. The UI shows a generic card for any other string. */
export type ActionKind =
  | "call"
  | "message"
  | "reminder"
  | "open-app"
  | "help"
  /** Change one of Companion's own settings (text size, contrast...). See docs/ACTION_SCHEMA.md. */
  | "accessibility"
  /** Read stored reminders back. The result message is what gets shown and spoken. */
  | "list-reminders"
  | (string & {});

export interface ProposedAction {
  /** Unique id for this proposal. */
  id: string;
  kind: ActionKind;
  /** Short, plain sentence the person reads. Example: "Call Anna". */
  title: string;
  /** Optional extra detail. Example: "Mobile number ending in 4821". */
  description?: string;
  /**
   * "high" actions (spending money, contacting people, deleting things) are
   * ALWAYS confirmed by the person, even if they turned confirmations off.
   */
  risk: "low" | "high";
  /** Opaque to the UI. Passed straight back to ActionService.execute. */
  params: Record<string, unknown>;
}

export interface ActionResult {
  ok: boolean;
  /** Plain sentence shown (and spoken) afterwards. Example: "Calling Anna now." */
  message: string;
  /** Set when the action failed only because a permission is missing. */
  needsPermission?: PermissionName;
}

export interface ActionService {
  /** True if this device can perform this kind of action. */
  supports(kind: ActionKind): boolean;
  /** Perform the action. Must not throw: report failure through ActionResult. */
  execute(action: ProposedAction, options?: { signal?: AbortSignal }): Promise<ActionResult>;
}
