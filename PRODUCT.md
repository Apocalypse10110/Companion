# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A mobile-first web app installed on Android as a PWA. It is one app with no desktop or native version. A native wrapper, if one is added later, does not change this.

## Users

The primary users are older adults and people with disabilities (motor, vision, hearing or cognitive), and both groups carry equal weight. These are people who find a standard smartphone hard to use: text is too small, targets are too small or move, menus are deep, and the jargon is opaque. They may have a shaky hand, low vision, use TalkBack or a large system font size, or simply have little confidence with technology. They use Companion on their own phone, often alone, to get everyday things done without asking someone else for help.

## Product Purpose

**Companion teaches older adults how to use their technology, until they can do it themselves.**

Ask it how to do anything ("How do I connect to Wi-Fi?", "What does this pop-up mean?", "How do I send a photo?"), or show it a photo of what's confusing. It teaches, one plain step at a time. It says what to look for and why, and checks after each step.

- **The first time, it teaches.** The reply is marked as a lesson ("Teaching you: Connect to Wi-Fi"). Each step comes with a short why, and on a photo a ring shows exactly where to tap. The person can choose "Let me try it myself" at any point.
- **The help fades as they learn.** Each task moves through five levels in **My Skills** (full guidance, shorter steps, "do you remember?", try it and check, learned). For a practised task Companion asks them to try first, gives a hint only if asked, and shows the ring only after "Show me where". Help is always available.
- **It checks each step.** "I've done it", "Show me again", "That didn't work", or a photo of the screen, which it checks before moving on.
- **It also does things,** always with confirmation: calls and texts (the person presses Call or Send), FaceTime, reminders, weather, bigger text.
- **It keeps them safe.** It spots scams in texts and pop-ups (measured: 10 of 10 unseen scams caught, 0 false alarms), and can send a plain note to a family member.

Success means the person learns to do it alone. They need Companion less each time, not more.

## Positioning

**"Siri answers your question. Companion stays until you can do it yourself."**

General assistants answer and forget. They repeat the same answer forever, use jargon, and assume you know where things are. Companion is a patient teacher built for people mainstream technology leaves behind:
- it teaches step by step, with photos of the person's own screen or device,
- it remembers what they've learned so its help fades,
- it is designed for low vision, unsteady hands and screen readers.

Risky actions always need confirmation, and it never claims to have done something it didn't.

## Operating Context

- The app is used on an Android phone, held in the hand, often with TalkBack or the largest system font size switched on.
- Interaction is voice-first: the person taps a large microphone, speaks, hears the reply and sees it as text. Typed input is available as an alternative.
- The core flow is: speak → speech becomes text → intent → action request → confirmation (always for high-risk actions) → the phone performs it → a spoken and written result.
- Permissions are requested only when they are needed, with a plain-language explanation. They are never requested all at once at first launch.
- The team: Developer A (this workspace's owner) owns the UI, design system, accessibility, onboarding, settings and conversation interface. Developer B owns speech recognition, text-to-speech, AI and intents. Developer C owns phone actions, permissions, storage and integration. Developer A does not build B's or C's systems; they plug into shared contracts (`src/contracts/`, swapped in via `src/integration/index.ts`).

## Capabilities and Constraints

- **Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4. 
- **Screens:** Home (Ask, Show me, Live Help, conversation and mic), My Skills, Safety (message check, Call Shield, Scam Bait), Live Help, lesson cards, History, Onboarding, and Settings (Text and looks, Voice and language, Accessibility, People, Reminders, Privacy).
- **Quick actions:** Call, Messages, Reminders and Help. These depend on Developer C's actions.
- **Settings must really change behavior:** 4 themes (including high contrast, dark and light), 4 text sizes, bold text, extra-large buttons, reduce motion, speech speed, volume and voice.
- **Sizing:** all sizes are in `rem`, so text size also scales spacing and touch targets. The minimum target is 56px, or 72px with extra-large buttons.
- **The microphone never moves.** Loudness is shown as a halo behind it.
- **Speed and volume use steppers, not sliders.**
- **Settings apply before first paint.**
- **No fake functionality.** Unconnected services say "not connected yet", and the scripted demo harness is dev-only.
- **History is device-only.** It is saved only if "Remember my conversations" is on, and erasing it leaves nothing behind.
- **Status:** the assistant (Gemini), voice, phone actions, Show Me with Tap here rings, Check my step, help that fades, Live Help (Gemini Live), scam checks, bills, lesson cards and the offline page are built. See `docs/DEVELOPMENT_STATUS.md` for what has and hasn't been verified.

## Brand Commitments

- **Name:** Companion, everywhere users or judges see it. Ice Hacks is only the hackathon. The name lives in one place: `BRAND` in `src/ui/components/BrandMark.tsx`.
- **Voice:** friendly, patient, respectful, calm and clear. Use short sentences and no technical language. Errors are kind and always offer a way forward ("Try again").
- **Typeface:** Atkinson Hyperlegible (self-hosted via `@fontsource`), chosen for low-vision readers.

## Evidence on Hand

- **Documentation:** `HANDOFF-DEV-A.md` and `PROMPT-DEV-A/B/C.txt` sit in the project folder but are git-ignored (local team notes, not in the repo). Docs in the repo: `docs/CONTRACTS.md`, `ARCHITECTURE.md` and `UI.md`.
- **Tests:** 543 Vitest tests and a real-browser layout check of every screen (`scripts/ui-check.mjs`), all passing.
- **What doesn't exist yet:** user testing, testimonials, usage data or a recorded real-device demo. Future work must not invent them.

## Product Principles

1. **Accessibility is the product, not a feature.** Design for the least steady hand, the weakest eyesight and the screen-reader user first.
2. **Act, then explain.** Doing the task for the person comes first; teaching is there when they ask.
3. **The person stays in control.** Risky actions are always confirmed, nothing happens silently, and anything in progress can be cancelled.
4. **Never pretend.** Report exactly what happened: "opened your messages" is not "sent", and "not connected yet" is not a fake success.
5. **Calm and predictable.** Controls don't move, wording is plain, and every error has a next step.

## Accessibility & Inclusion

- WCAG AA contrast in every theme. Contrast is enforced by a token test against the real CSS.
- Full screen-reader support (TalkBack): labelled controls and live regions announce state changes.
- Respect reduce motion. Support the largest system font size without breaking layout.
- Large, stable touch targets (56px minimum, 72px with extra-large buttons).
- Spoken feedback alongside visible text, so the app does not rely on either sight or hearing alone.
