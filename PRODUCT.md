# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A mobile-first web app installed on Android as a PWA. It is one app with no desktop or native version. A native wrapper, if one is added later, does not change this.

## Users

The primary users are older adults and people with disabilities (motor, vision, hearing or cognitive), and both groups carry equal weight. These are people who find a standard smartphone hard to use: text is too small, targets are too small or move, menus are deep, and the jargon is opaque. They may have a shaky hand, low vision, use TalkBack or a large system font size, or simply have little confidence with technology. They use Companion on their own phone, often alone, to get everyday things done without asking someone else for help.

## Product Purpose

Companion is a voice-first assistant that makes a smartphone easier to use. It is built for Ice Hacks 2026 (Nov 8–15).

- **First, it does things for the person.** They speak naturally ("Call my daughter", "Remind me about my appointment tomorrow", "Make the text bigger", "Open my photos") and Companion carries out supported phone actions.
- **Second, it explains.** When asked ("Help me use my phone"), it guides the person through a task one plain step at a time.

Success means the person can say what they want in their own words, understand what Companion is about to do, confirm it, and hear a clear result. They should never be stranded by an error they can't recover from.

## Positioning

Companion is a Rabbit R1-style "speak and it acts" assistant built from the ground up for people mainstream assistants leave behind. Every surface is designed for low vision, unsteady hands and screen readers. Risky actions always need the person's confirmation, and the app never claims to have done something the phone did not actually do.

## Operating Context

- The app is used on an Android phone, held in the hand, often with TalkBack or the largest system font size switched on.
- Interaction is voice-first: the person taps a large microphone, speaks, hears the reply and sees it as text. Typed input is available as an alternative.
- The core flow is: speak → speech becomes text → intent → action request → confirmation (always for high-risk actions) → the phone performs it → a spoken and written result.
- Permissions are requested only when they are needed, with a plain-language explanation. They are never requested all at once at first launch.
- The team: Developer A (this workspace's owner) owns the UI, design system, accessibility, onboarding, settings and conversation interface. Developer B owns speech recognition, text-to-speech, AI and intents. Developer C owns phone actions, permissions, storage and integration. Developer A does not build B's or C's systems; they plug into shared contracts (`src/contracts/`, swapped in via `src/integration/index.ts`).

## Capabilities and Constraints

- **Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4. The UI work is on branch `feature/mobile-ui`.
- **Screens:** Home (conversation and mic), History, Onboarding, and Settings (Text and looks, Voice, Accessibility, Privacy).
- **Quick actions:** Call, Messages, Reminders and Help. These depend on Developer C's actions.
- **Settings must really change behavior:** 4 themes (including high contrast, dark and light), 4 text sizes, bold text, extra-large buttons, reduce motion, speech speed, volume and voice.
- **Sizing:** all sizes are in `rem`, so text size also scales spacing and touch targets. The minimum target is 56px, or 72px with extra-large buttons.
- **The microphone never moves.** Loudness is shown as a halo behind it.
- **Speed and volume use steppers, not sliders.**
- **Settings apply before first paint.**
- **No fake functionality.** Unconnected services say "not connected yet", and the scripted demo harness is dev-only.
- **History is device-only.** It is saved only if "Remember my conversations" is on, and erasing it leaves nothing behind.
- **Undecided or pending:**
  - The shared contracts are proposed and not yet agreed with B and C.
  - The real assistant, voice and actions are not yet connected.
  - The PR is not yet merged.
  - Offline screen, a "repeat that" quick action and a caregiver-contact quick action are nice-to-haves.

## Brand Commitments

- **Name:** Companion, everywhere users or judges see it. Ice Hacks is only the hackathon. The name lives in one place: `BRAND` in `src/ui/components/BrandMark.tsx`.
- **Voice:** friendly, patient, respectful, calm and clear. Use short sentences and no technical language. Errors are kind and always offer a way forward ("Try again").
- **Typeface:** Atkinson Hyperlegible (self-hosted via `@fontsource`), chosen for low-vision readers.

## Evidence on Hand

- **Documentation:** `HANDOFF-DEV-A.md`, `PROMPT-DEV-A.txt`, `PROMPT-DEV-B.txt` and `PROMPT-DEV-C.txt`. Docs on the branch: `docs/CONTRACTS.md`, `ARCHITECTURE.md` and `UI.md`.
- **Tests:** 163 Vitest tests and a real-browser layout check (`scripts/ui-check.mjs`), all passing on `feature/mobile-ui`.
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
