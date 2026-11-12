# Development status

Last updated: 2026-11-12 by Developers C and D. Branch: `main`.

## Done and working end to end

- **UI (A):** every screen, design system, accessibility (large text, high contrast, screen reader, reduced motion), onboarding, settings, conversation.
- **Voice (B):** speech in (Web Speech recognition) and speech out (speechSynthesis), "Repeat that".
- **Assistant (B + C):**
  - On-device rules for clear requests.
  - Gemini on the server for help, questions and photos, with structured JSON output, a model fallback chain, and replies in about 2 s.
  - Conversation context and suggested replies.
  - Help that fades: it lets the person try first on tasks they've already learned.
- **Show Me (C):** photo or screenshot, then a plain explanation and one step at a time. Calls out scam texts and pop-ups.
- **Phone actions (C):**
  - Call and text by handing over to the dialer and Messages (`tel:`/`sms:` with number and text filled in).
  - Maps, email and web search.
  - Reminders with notification, on-screen and spoken alerts.
  - Reading reminders back.
  - Voice-driven settings ("make the text bigger").
- **People, permissions (C):**
  - Saved People, plus Android's contact picker.
  - Microphone, notifications and camera permissions, asked only when needed.
  - "Phone and permissions" screen showing what works on this device.
- **Privacy:** in-app summary and [PRIVACY.md](PRIVACY.md). There are no accounts and no database.
- **Device (D):** details in [DEVICE.md](DEVICE.md).
  - Live camera for Show Me: back and front, take, retake, send.
  - On computers, "Show my screen".
  - Sharing a screenshot or text to the installed Android app.
  - Contacts: the Android picker, and contact-card import on iPhone.
  - Phone numbers are removed before anything goes to the AI.
  - Device permissions dashboard.
  - Reminders management: add, edit, done, past, details, repeat, notification switch.
  - Reminder times from Gemini are worked out on the phone.
  - Coming back after a call reopens the conversation with a welcome back.
  - Home-screen shortcuts.
- **Tests:** about 390 unit and behaviour tests, a real-browser layout check of every screen, and a real-browser e2e run of every demo workflow against live Gemini.

## Before judging

1. **Enable billing on the Gemini key and set a budget** (README → Gemini quota). The free tier ran out during testing; the fallback models covered it.
2. Set `GEMINI_API_KEY` in Vercel and redeploy; check `/api/assistant`.
3. Put the live URL at the top of the README.
4. Run `BASE_URL=<live url> npm run test:e2e`.
5. Test on a real iPhone and Android phone:
   - microphone prompt,
   - Show Me with the camera and with a screenshot,
   - call and text hand-off,
   - Add to Home Screen,
   - the largest system font and TalkBack/VoiceOver.

## Known limits (by platform, not by choice)

- A web app can't read SMS or call history, can't open the Camera, Photos or Settings apps (it explains how to find them instead), and can't see the phone's own screen (Show Me uses a photo or screenshot).
- Reminders alert only while Companion is open or recently in the background. There is no push server. On iPhone, notifications need the app added to the Home Screen.
- Firefox has no speech recognition (typing works). The on-device rules are English-only. Other languages go through Gemini.
- The rate limit is kept in memory per server instance (fine for a demo, not for scale).
- Google sign-in for Calendar and Gmail isn't built; that screen honestly says "Not available yet".

## Next, if time allows

- A status page and health check.
- An eval scorecard of red-team prompts.
- A "Help Card" that texts a summary of the problem to a family member.
- The Bank Call Shield.
