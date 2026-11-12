# Development status

Last updated: 2026-11-11 by Developer B.

## Completed

- **A (UI):** all screens, design system, accessibility, onboarding, settings, conversation engine, 163 tests. Merged to `main`.
- **B (AI and voice):** speech recognition, text-to-speech, on-device intent rules, validation, conversation
  context, optional server AI (Anthropic or OpenAI-compatible), wired into the app. Branch `feature/voice-ai`.

## Current work

- B: PR `feature/voice-ai` -> `main` awaiting review.

## Blocked / pending integration

- **Actions (C):** nothing pushed yet, so action cards show "I can't do this on this device yet".
  Needed for calling, messages, reminders, opening apps. Schema: `docs/ACTION_SCHEMA.md`.
- **Text-size by voice:** needs a settings hook (A + C).
- **Spoken yes:** needs `confirmedActionId` in the UI (A), optional.

## Known bugs / limits

- Firefox has no speech recognition (typing works). Android recognition may need internet.
- On-device rules are English-only.
- `tsc --noEmit` on a fresh clone reports `LayoutProps` missing until `next build`/`next dev` generates route types (pre-existing).

## Next steps

1. Review and merge `feature/voice-ai`.
2. C implements `ActionService` and `PermissionsService` against `docs/ACTION_SCHEMA.md`.
3. Agree the additive contract changes in `docs/CONTRACTS.md`.
4. Test on a real Android phone (PWA install, microphone prompt, TalkBack, speech voices).
