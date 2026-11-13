# Development status

Last updated: 2026-11-13. Branch: `claude/hopeful-noether-xqx6oc`.

## Working end to end

| Area | What works | Where |
| --- | --- | --- |
| Home | Greeting, three large actions (Ask, Show me, Live Help), read a bill, scam check, continue learning, family help | `src/ui/screens/HomeScreen.tsx` |
| Ask | Voice or typing, one step at a time, suggestions, "Repeat that" | `src/ui/conversation`, `src/voice` |
| Show me + Tap here | Photo or screenshot, plain explanation, high-contrast ring on the thing to press (validated twice, dropped when unsure), "I can't find it on my screen" | `TapHere.tsx`, `src/ai/target.ts` |
| Check my step | "I've done it", "Show me again", "That didn't work", or a photo the AI checks (`stepCheck`) | `CheckStep.tsx` |
| Help that fades | Five levels per skill, attempts and independent finishes tracked, ring hidden for practised tasks, help always available | `src/ai/skills.ts`, `src/ai/assistant.ts` |
| My Skills | Learning / Practising / Nearly there / Learned, last done, practise again, print card, remove | `src/ui/skills` |
| Fridge Card | "Save this lesson" writes a printable card (AI, or from the conversation offline); print stylesheet | `src/ui/lessons`, `/lesson` |
| Live Help | Gemini Live with ephemeral tokens: camera + voice, spoken replies, interruption, captions, reconnect, model fallback, Show Me fallback | `src/live`, `src/ui/live`, `/api/live/token` |
| Safety | Paste or photograph a message: STOP / Be careful / no warning signs / can't tell, reasons, how to check safely, share with family | `src/ui/safety`, `/safety` |
| Call Shield | Listens to a call on another phone's speaker, flags scam signs live, full check on request | `/safety/listen` |
| Scam Bait | Doris replies to real scam texts (the person sends); practice round with a labelled pretend scammer | `/scam-bait` |
| Point at a bill | Organisation, amount, due date, reference, unclear fields flagged; confirmed reminder; never pays | `DocumentCard.tsx` |
| Help Card | Note from the AI (in the reply or on request), send to someone in People via the confirm card, or the share sheet after a confirmation | `FamilyNote.tsx`, `FamilyShareOffer.tsx` |
| Settings | Text and looks, voice and language, how much to explain, people, reminders, permissions, accounts, privacy | `src/ui/screens/settings` |

## Checks run on Nov 13

- `npm test`: 543 tests pass (unit, behaviour, accessibility with axe, server handlers).
- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- `npm run test:ui` against a production build: every screen (including My Skills, Safety, Call Shield, Live
  Help, lesson card) passes at the largest text with dark high contrast at 360×640, and at normal settings.
- Real browser with the AI replies stubbed: photo → Tap here ring + Check my step, Safety → scam warning,
  bill photo → bill card. The print preview of a lesson card renders as one black-and-white A4 page.

## Not verified yet (needs a key, a device or a deploy)

- Real Gemini answers for the new fields (`stepCheck`, `document`, `scamReasons`, `confidence`): there was no
  `GEMINI_API_KEY` in the build environment. Run `npm run test:e2e` and `npm run eval:scams` with a key.
- Live Help against the real Gemini Live API, and the default Live model names (`GEMINI_LIVE_MODEL`).
- Real iPhone and Android phones: camera, microphone, Live Help audio, share sheet, printing.

## Before judging

1. Set `GEMINI_API_KEY` (paid tier, with a budget) in Vercel for Production and Preview; optionally
   `GEMINI_LIVE_MODEL`.
2. Open `/status` and `/api/assistant` on the deployment.
3. Try Live Help on a phone; if it fails, check the Live model name in Google AI Studio.
4. `BASE_URL=<deployment> npm run test:e2e`.

## Known limits (by platform)

- A web app can't read SMS or call history, can't open the Camera, Photos or Settings apps, can't see the
  phone's own screen, and can't hear phone calls on the phone it runs on.
- Reminders alert only while Companion is open or recently in the background.
- Firefox has no speech recognition (typing works; Call Shield doesn't).
- Rate limits are kept in memory per server instance.
