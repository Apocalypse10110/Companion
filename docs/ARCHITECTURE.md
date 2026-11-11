# Architecture

Companion is **one** mobile-first web app (Next.js App Router, React, TypeScript, Tailwind CSS v4),
installable on a phone as a PWA. There is no desktop app.

## Module ownership

| Path | Owner | Notes |
| --- | --- | --- |
| `src/app/**` | Developer A | Routes, layout, manifest |
| `src/ui/**` | Developer A | Design system, screens, state, accessibility |
| `src/contracts/**` | Shared (A proposed) | Change only by agreement. See [CONTRACTS.md](./CONTRACTS.md) |
| `src/integration/index.ts` | Shared | B and C each change their own lines to connect |
| `src/ai/**`, `src/voice/**` | Developer B | Not touched by A |
| `src/actions/**`, `src/permissions/**` | Developer C | Not touched by A |

Developer A will not edit B's or C's folders. B and C should not edit `src/ui/**` or `src/app/**`;
ask A, or open a PR for A to review.

## How the pieces fit

```
  person  --tap/speak/type-->  src/ui  --calls-->  contracts  <--implemented by-->  B and C
                                  |
                                  +-- settings (text size, theme, contrast, motion, voice, privacy)
                                  +-- conversation (state machine + history)
                                  +-- screens, components, accessibility helpers
```

- `src/ui/settings` holds every preference, saves it on the device, and applies it to the page
  (`<html>` data attributes and CSS variables) before first paint, so there is no flash.
- `src/ui/conversation` is a state machine: `idle -> listening -> thinking -> speaking -> idle`,
  with error and cancel paths. It is the only code that calls the voice, assistant and action services.
- `src/ui/components` is the reusable, accessible component set. Screens only compose these.
- `src/ui/a11y` has the screen-reader announcer and focus helpers.

## Accessibility rules every screen follows

1. Touch targets are at least 56 CSS px (72 px when "Extra large buttons" is on), and grow with text size.
2. All sizes are in `rem`, so the person's text-size choice scales everything, including spacing.
3. Colour is never the only signal. States always have words or icons too.
4. Every control has a visible text label. Icon-only controls are not used for primary actions.
5. Changes that matter are announced through one polite live region (`LiveAnnouncer`).
6. Motion respects "Reduce motion" (setting or the device preference) and the app is fully usable without it.
7. Contrast meets WCAG AA in all four theme/contrast combinations; "High contrast" targets AAA.

## Persistence

Everything is stored locally on the device (`localStorage`). Nothing is sent anywhere by the UI itself.
Conversation history is saved only if the person leaves "Remember my conversations" on, and can be erased
from Settings > Privacy.

| Key | Contents |
| --- | --- |
| `companion.settings.v1` | Preferences |
| `companion.history.v1` | Saved conversations (only when enabled) |

## Running and testing

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # component + accessibility tests (Vitest, Testing Library, axe)
npm run lint
npm run build
```
