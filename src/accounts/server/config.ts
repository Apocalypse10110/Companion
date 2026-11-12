/**
 * Connected accounts (server only): which accounts exist, how to sign in to each, and whether this
 * server has been set up for it. Client IDs and secrets come from environment variables and never
 * reach the phone. Owner: Developer C/D.
 *
 *   ACCOUNTS_SECRET                      32+ random characters; encrypts the sign-in cookies
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET       Gmail + Google Calendar
 *   MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET Outlook mail + calendar
 *   SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET     Spotify (search works with these alone)
 */

export type AccountId = "gmail" | "google-calendar" | "outlook" | "spotify";
export const ACCOUNT_IDS: AccountId[] = ["gmail", "google-calendar", "outlook", "spotify"];

export interface ProviderConfig {
  id: AccountId;
  name: string;
  family: "google" | "microsoft" | "spotify";
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Extra query parameters for the sign-in page. */
  extraAuthParams?: Record<string, string>;
  /** Spotify wants the client secret as HTTP Basic auth, the others in the body. */
  basicAuth?: boolean;
  clientId?: string;
  clientSecret?: string;
}

export type Env = Record<string, string | undefined>;

export function providerConfig(id: AccountId, env: Env = process.env): ProviderConfig {
  switch (id) {
    case "gmail":
    case "google-calendar":
      return {
        id,
        name: id === "gmail" ? "Gmail" : "Google Calendar",
        family: "google",
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: [
          "openid",
          "email",
          id === "gmail" ? "https://www.googleapis.com/auth/gmail.readonly" : "https://www.googleapis.com/auth/calendar.readonly",
        ],
        // offline + consent: get a refresh token so the person stays connected.
        extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      };
    case "outlook":
      return {
        id,
        name: "Outlook",
        family: "microsoft",
        authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scopes: ["openid", "email", "offline_access", "User.Read", "Mail.Read", "Calendars.Read"],
        extraAuthParams: { prompt: "select_account" },
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
      };
    case "spotify":
      return {
        id,
        name: "Spotify",
        family: "spotify",
        authorizeUrl: "https://accounts.spotify.com/authorize",
        tokenUrl: "https://accounts.spotify.com/api/token",
        scopes: ["user-read-email", "user-read-playback-state", "user-modify-playback-state"],
        basicAuth: true,
        clientId: env.SPOTIFY_CLIENT_ID,
        clientSecret: env.SPOTIFY_CLIENT_SECRET,
      };
  }
}

export function isAccountId(value: string): value is AccountId {
  return (ACCOUNT_IDS as string[]).includes(value);
}

/** True when sign-in can work on this server: client keys plus the cookie secret. */
export function isConfigured(id: AccountId, env: Env = process.env): boolean {
  const c = providerConfig(id, env);
  return Boolean(c.clientId && c.clientSecret && (env.ACCOUNTS_SECRET ?? "").length >= 32);
}
