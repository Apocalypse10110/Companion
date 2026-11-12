# Connected accounts: setup

Companion can connect to **Gmail**, **Google Calendar**, **Outlook** (mail and calendar) and **Spotify**.
The code is complete. Each service needs an app registered once, by someone on the team, with its keys
added to Vercel. Until then, Settings → Connected accounts honestly says "hasn't been set up yet".

Voice commands:
- "read my email"
- "what's on my calendar tomorrow?"
- "what do I have today?" (reads reminders and calendar events)
- "play some Frank Sinatra"

## 0. The cookie secret (needed for all of them)

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Add the result as `ACCOUNTS_SECRET` in Vercel (Production). If you change it later, everyone has to sign in again.

## Redirect addresses

Register these exact addresses with each service. Replace `YOUR-SITE` with the Vercel domain.

| Account | Redirect URI |
| --- | --- |
| Gmail | `https://YOUR-SITE/api/accounts/gmail/callback` |
| Google Calendar | `https://YOUR-SITE/api/accounts/google-calendar/callback` |
| Outlook | `https://YOUR-SITE/api/accounts/outlook/callback` |
| Spotify | `https://YOUR-SITE/api/accounts/spotify/callback` |

For local testing, also add `http://localhost:3000/api/accounts/<id>/callback`. Spotify requires `http://127.0.0.1:3000/...` instead of `localhost`.

## 1. Google (Gmail and Google Calendar), about 15 minutes

1. Go to https://console.cloud.google.com and create a project called "Companion".
2. **APIs & Services → Library:** enable **Gmail API** and **Google Calendar API**.
3. **OAuth consent screen:**
   1. Choose External, app name Companion, and add your support email.
   2. Under Scopes, add `gmail.readonly`, `calendar.readonly`, `openid` and `email`.
   3. Under Test users, add the Google accounts of everyone who will demo it, including any judge account you know.
4. **Credentials → Create credentials → OAuth client ID:**
   1. Choose Web application.
   2. Add both Google redirect URIs above.
   3. Copy the ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Important limit:** `gmail.readonly` is a Google "restricted" scope. Until Google reviews the app (weeks, with a security assessment), only the **test users** you list can sign in, up to 100. People not on the list see "access blocked". For the hackathon, demo with a listed account. Calendar only (`calendar.readonly`) is "sensitive", not restricted, and has the same test-user rule until verified.

## 2. Microsoft (Outlook), about 10 minutes

1. Go to https://entra.microsoft.com → **App registrations → New registration**.
2. Name it Companion. For supported accounts, choose *Accounts in any organizational directory and personal Microsoft accounts*.
3. Redirect URI: platform **Web**, using the Outlook URI above.
4. **Certificates & secrets → New client secret.** Copy the *Value* into `MICROSOFT_CLIENT_SECRET`. Copy the Application (client) ID into `MICROSOFT_CLIENT_ID`.
5. **API permissions → Microsoft Graph → Delegated:** add `User.Read`, `Mail.Read`, `Calendars.Read` and `offline_access`.

Personal Outlook and Hotmail accounts can then sign in straight away. Work accounts may need their admin's approval.

## 3. Spotify, about 5 minutes

1. Go to https://developer.spotify.com/dashboard → **Create app**. Choose Web API and add the Spotify redirect URI.
2. Copy the Client ID and secret into `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
3. Under User Management, add the Spotify accounts that will demo it (development mode allows 25).

What works at each level:

| Setup | "Play some Frank Sinatra" |
| --- | --- |
| No Spotify keys | Opens Spotify's search for "Frank Sinatra" (works for everyone) |
| Keys, person not signed in | Finds the best song or playlist and opens it in Spotify; the person taps play |
| Signed in, **Spotify Premium**, Spotify open on a device | Starts playing by itself ("Playing Fly Me to the Moon by Frank Sinatra") |

Spotify only lets apps start playback for Premium users, and only on a device where Spotify is open.

## After adding keys

Redeploy on Vercel. In the app, open Settings → Connected accounts. Each account should now show a
**Connect** button, which goes to Google, Microsoft or Spotify, then comes back saying "connected".

## How it's kept safe

- **Sign-in:** standard OAuth with PKCE and a state check, so a forged sign-in link is refused. Passwords are only ever typed on Google's, Microsoft's or Spotify's own pages.
- **Tokens:** kept in an encrypted (AES-256-GCM), httpOnly cookie that only Companion's server can open. The phone's JavaScript can't read it. There's no database.
- **Read-only:** email and calendar access is read-only. Companion never sends, deletes or changes anything.
- **Email and calendar stay private:** they're summarised on the phone for reading aloud and are **never sent to the AI**.
- **Disconnecting:** removes the cookie, and Google is asked to revoke access.
