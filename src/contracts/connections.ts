/**
 * CONTRACT: connections (accounts such as Google Calendar and Gmail)
 * Proposed by Developer A (mobile UI). Implemented by Developer C.
 *
 * The UI lists the person's accounts, shows plainly whether each is connected,
 * and lets them connect or disconnect one. Developer C owns everything behind
 * that: the sign-in (for example Google OAuth), storing tokens, and reading or
 * writing calendar events and email when the assistant asks for it.
 *
 * The UI never sees tokens or passwords.
 */

/** Known accounts. The UI shows a generic row for any other id. */
export type ConnectionId = "google-calendar" | "gmail" | "outlook" | "spotify" | (string & {});

export type ConnectionState =
  /** Linked and working. `account` says which account. */
  | "connected"
  /** Can be connected, but is not. */
  | "disconnected"
  /** Linked before, but needs the person to sign in again (expired or revoked). */
  | "needs-attention"
  /** This app or device cannot connect it yet. The UI shows "not available yet". */
  | "unavailable";

export interface ConnectionInfo {
  id: ConnectionId;
  /** Plain name the person knows. Example: "Google Calendar". */
  name: string;
  state: ConnectionState;
  /** Which account, once connected. Example: "anna.smith@gmail.com". */
  account?: string;
  /** True when the feature already works with no sign-in (for example Spotify search). */
  worksWithoutSignIn?: boolean;
  /** Optional plain sentence about the current state, shown under the name. */
  message?: string;
}

export interface ConnectionResult {
  ok: boolean;
  /** The account after the attempt (always returned, also on failure). */
  connection: ConnectionInfo;
  /** Plain sentence shown (and announced) afterwards. Example: "Your calendar is connected." */
  message: string;
  /** True when the person closed or cancelled the sign-in. Not treated as an error. */
  cancelled?: boolean;
}

export interface ConnectionsService {
  /** Every account the app knows about, connected or not. Must not show any sign-in. */
  list(): Promise<ConnectionInfo[]>;
  /**
   * Start the sign-in for one account. Only ever called from a tap.
   * May open a sign-in window or page. Must not throw: report failure in the result.
   */
  connect(id: ConnectionId, options?: { signal?: AbortSignal }): Promise<ConnectionResult>;
  /** Unlink one account and forget its tokens on this device. Must not throw. */
  disconnect(id: ConnectionId): Promise<ConnectionResult>;
}
