/**
 * CONTRACT: permissions
 * Proposed by Developer A (mobile UI). Implemented by Developer C.
 *
 * The UI never asks the browser/OS for a permission directly. It asks this
 * service, and only at the moment a feature needs it (never all at once).
 */

/** Permissions the UI may ask for. Add new names here (and document them). */
/** "camera" is checked and requested by Developer C's service; nothing in the app needs it yet. */
export type PermissionName = "microphone" | "notifications" | "camera";

export type PermissionState =
  /** The user has allowed it. */
  | "granted"
  /** The user has refused it. Re-asking will not show a prompt. */
  | "denied"
  /** Not decided yet. Asking will show the system prompt. */
  | "prompt"
  /** This device or browser cannot do this at all. */
  | "unsupported";

export interface PermissionsService {
  /** Read the current state without showing any prompt. */
  check(name: PermissionName): Promise<PermissionState>;
  /** Show the system prompt (if it can be shown) and return the new state. */
  request(name: PermissionName): Promise<PermissionState>;
}
