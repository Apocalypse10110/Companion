# Device features (Developer D)

What Companion can do with the phone itself, on iPhone (Safari) and Android (Chrome), and where the
platform stops a website. Everything listed as working is covered by `npm test` and `npm run test:e2e`.
Real-phone checks are still needed (see the end).

## Camera and "Show me"

| | iPhone | Android | Computer |
| --- | --- | --- | --- |
| Live camera with preview (`src/phone/camera.ts`, `src/ui/conversation/CameraSheet.tsx`) | Yes | Yes | Yes (webcam) |
| Back and front camera, switch between them | Yes | Yes | If there are two |
| Take photo, check it, **Take it again**, **Use this photo** | Yes | Yes | Yes |
| Choose a photo or screenshot instead (no permission needed) | Yes | Yes | Yes |
| Share a screenshot **to** Companion from Photos (`share_target` in `src/app/manifest.ts`, `public/sw.js`) | No (Safari has no share target) | Yes, once installed | No |
| Show my screen (one picture of a chosen window) | No | No | Yes (Chrome, Edge, Firefox) |

How it works:

- **The camera only runs while it's needed.** It turns off after the photo is taken, when the camera screen closes, or when the person leaves the app (a call, the home button). Coming back offers "Turn the camera on".
- **Problems get a plain answer.** If the camera is refused, missing or busy, the person is told so, with how to turn it on and an alternative.
- **Nothing is captured or sent without a tap.** Photos are shrunk on the phone (1280 px JPEG, location data removed) before Gemini sees them.
- **Companion can't see other apps' screens on a phone.** The person takes a screenshot and picks it, or shares it to Companion on Android.

## Contacts

- **Android:** the Contact Picker shows the person's own contacts list. They pick one person; Companion never sees the rest. It's offered in Settings → People, and when "call my daughter" doesn't know who that is yet.
- **iPhone:** Safari has no contact access at all. In Contacts, the person taps a contact, then **Share Contact**, then **Save to Files**. In Companion they tap **Settings → People → Import a contact card** (`src/people/vcard.ts`), which reads only the name and phone numbers.
- **Where people are kept:** only in this phone's browser storage (`localStorage`, key `companion.people.v1`). They are never sent to our server or to Gemini, and never committed to git.
- **Numbers typed into the chat:** phone numbers are replaced with `[phone number]` on the phone before any text goes to the AI (`src/ai/providers/redact.ts`). Calling still works, because calls are understood on the phone.

## Device permissions (Settings → Device permissions)

`src/permissions/catalog.ts` lists each permission with what Companion uses it for, its current status, a button to allow it (only where the browser can ask), how to turn it back on in the phone's settings, and an alternative.

| Permission | What a website can do |
| --- | --- |
| Microphone, camera, notifications | Check and ask (`src/permissions/index.ts`) |
| Speech recognition | Use it (Safari, Chrome); there is no separate permission |
| Contacts | Android: pick one at a time. iPhone: import a contact card |
| Photos | No permission needed: the person picks one photo |
| Screen sharing | Computers only |
| Location | Not used by Companion |
| Calendar, Bluetooth, Wi-Fi | No access for websites. Companion offers reminders and step-by-step guidance instead |

Permissions are asked for at the moment they're needed, never all at once during onboarding. The list is re-checked when the person comes back from the phone's Settings.

## Phone settings (Wi-Fi, Bluetooth, brightness, sound and so on)

A website can't change phone settings or open a specific Settings page:

- iPhone blocks `App-prefs:` links from Safari.
- Android Chrome only opens apps that accept web links, and the Settings screens don't.

So Companion does the strongest honest thing:

- **Its own settings change directly by voice.** Text size, contrast, bold text, speech speed and volume, read aloud.
- **For the phone's settings, Gemini guides one step at a time.** It says what each thing looks like and checks with the person after each step. Show Me can confirm they're on the right screen.
- **It never says a phone setting was changed,** because it can't know.

## Calls and coming back (`src/phone/handoff.ts`)

1. "Call my daughter" leads to a confirm card. Then the dialer opens with the number filled in, and the person presses Call.
2. Just before handing over, Companion records who the call is for. As the page is left, it saves which conversation and screen were open (the conversation itself is already saved on the phone).
3. When the person comes back, the conversation is reopened and Companion says: "Welcome back. I hope your call with Anna went well. We can carry on where we left off…". This works even if the phone reloaded Companion during the call.

Limits:

- A website can't bring itself back to the front when a call ends, and can't see the call state. The person switches back: on iPhone, the "◀ Safari"/Companion link at the top left or a swipe up; on Android, Back or Recents.
- A native Android app could listen for the call ending (`READ_PHONE_STATE`), but that is a Play Store app, not a website.

## Quick access and start-up

- **Home screen app.** The Device permissions screen explains installing for each phone (Safari: Share, then Add to Home Screen; Chrome: Install app). Once installed, Companion opens full-screen like an app.
- **Android shortcuts.** Press and hold the icon for **Talk to Companion** and **Show me with a photo**, which opens the camera straight away.
- **iPhone.** Websites can't start when the phone turns on, can't add a Lock Screen widget, and can't run in the background. The closest is the Home Screen icon on the first page or in the dock. An iOS **Shortcuts** "Open URL" action can also be put on the Lock Screen through a Shortcuts widget.
- **Android start-up.** Websites can't start at boot either. A native wrapper (see below) could use `BOOT_COMPLETED` and a persistent notification.

## Reminders (`src/actions/reminders.ts`, Settings → Reminders)

- **Create** by voice ("remind me to take my pills at 8", "every Tuesday…") or in Settings.
- **Manage in Settings:** edit, delete, mark done; see "Coming up" and "Past" (done or missed).
- **Each reminder has:** a title, details, a day, a time, a repeat (once, daily or weekly), a phone-notification switch, and a done state.
- **Times from Gemini** are given in the person's words and worked out on the phone. If a time is unclear, Companion asks.
- **Saving is checked.** A reminder is read back from storage before anyone is told it's saved.
- **When one is due:** a phone notification (if allowed and switched on) plus an on-screen and spoken alert, with Done or Remind me in 10 minutes.
- **Limit:** alerts only fire while Companion is open or recently in the background. Reliable closed-app alerts need Web Push (a server with VAPID keys and a scheduler) or a native app; neither is built.

## Native app (Capacitor): investigated, not shipped

Capacitor could wrap Companion as a native app that loads the live site, adding:
- native local notifications (reminders when the app is closed),
- the Android call-state listener and boot start,
- a native contacts plugin for iPhone,
- Settings deep links on Android.

It's not shipped because:
- judges use the public URL (no store install), and
- this machine has no Android SDK or Xcode to build and test it, so it would be untested code.

It's the right next step after the hackathon.

## Still to check on real phones

- The camera opening and the retake reopening the camera. Headless Chrome's fake camera can't be reopened after it has played, so this was only checked up to "Take it again".
- Back/front camera switching.
- The contact picker (Android).
- A contact card import from iPhone Contacts.
- A screenshot shared to the installed Android app.
- The home-screen shortcuts.
- The dialer hand-off and "welcome back".
- Reminder notifications on the installed app.
