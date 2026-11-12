# Handoff: Developer A (mobile UI and accessibility)

Read this first if you are picking up Developer A's work, for example in a new Claude Code session.
Last updated: 2026-11-11.

## The one-paragraph version

Companion is one mobile web app (Next.js 16, React 19, TypeScript, Tailwind CSS v4), installable on
Android as a PWA, built for Ice Hacks 2026 (Nov 8–15). Developer A owns the UI: every screen, the design
system, accessibility, onboarding, settings and the conversation interface. That work is **done and
tested** on branch `feature/mobile-ui`. It is **not yet connected** to Developer B's assistant and voice
or Developer C's phone actions and permissions, because neither had pushed anything when A started. A
wrote the shared interfaces (contracts) so they can plug in with a one-line change each.

## Status

| Area | State |
| --- | --- |
| Screens: Home, History, Onboarding, Settings (Text and looks, Voice, Accessibility, Privacy) | Done |
| Design system: 4 themes, 4 text sizes, bold, extra-large buttons, spacing, reduce motion | Done |
| Conversation engine (listen, think, speak, cancel, errors, retry, history) | Done |
| Action confirmations and just-in-time permissions | Done |
| Tests: 163 Vitest + real-browser layout check | All passing |
| Shared contracts (`src/contracts/`) | **Proposed, not yet agreed by B and C** |
| Connected to real assistant / voice / actions | **Not yet**: waiting on B and C |
| Merged to `main` | No: PR open from `feature/mobile-ui` |

## Start here (commands)

```bash
git checkout feature/mobile-ui
npm install
npm run dev                  # http://localhost:3000 (first visit opens the walkthrough)

npm test                     # 163 tests
npm run typecheck
npm run lint
npm run build && npm start   # then in another terminal:
npm run test:ui              # real-browser check; set CHROME_PATH if Playwright's Chromium isn't installed

# See the whole flow without B and C (scripted fake services):
NEXT_PUBLIC_COMPANION_HARNESS=1 npm run dev   # then open /dev/harness (404 without the variable)
```

Before saying a UI change is done, run `npm test`, `npm run typecheck`, `npm run lint`, and
`npm run test:ui` against a production build. `test:ui` catches layout bugs jsdom cannot see.

## Where things are

```
src/
  app/                      routes (A)        layout.tsx, page.tsx, history/, onboarding/, settings/*, manifest.ts, globals.css
  contracts/                shared            the interfaces between A, B and C. Change only by agreement.
  integration/index.ts      shared            THE place B and C swap in their services (one line each)
  integration/unconfigured.ts                 honest "not connected yet" placeholders
  ui/
    settings/               A                 types, storage, apply-to-page, pre-paint script, provider
    conversation/           A                 state machine (ConversationProvider), reducer, history storage, chat UI
    components/             A                 Button, MicButton, Toggle, ChoiceGroup, Stepper, Card/Banner, ConfirmDialog, ...
    screens/                A                 Home, History, Onboarding, settings/*
    shell/                  A                 AppFrame (header, nav, first-run redirect), BottomNav, Providers
    a11y/                   A                 LiveAnnouncer (screen-reader live regions), haptics
    testing/                A                 fake services, render helper. Never imported by production code.
docs/  CONTRACTS.md  ARCHITECTURE.md  UI.md  HANDOFF-DEV-A.md (this file)
scripts/ui-check.mjs        real-browser layout check
```

## How B and C connect (the integration step)

1. Implement the interface from `src/contracts/` in your own folder (`src/ai`, `src/voice` for B;
   `src/actions`, `src/permissions` for C).
2. In `src/integration/index.ts`, replace your placeholder line, for example
   `assistant: myAssistant, // Developer B`.
3. Run `npm test`. The UI tests use fake services, so they keep passing. Then try it on a real phone.

Rules the contracts promise (full list in `docs/CONTRACTS.md`):
- `AssistantService.send` rejects with `AssistantError` (`unavailable`, `network`, `timeout`, `unknown`). The UI turns each into a kind message with Try again.
- `VoiceInputHandlers.onFinal` comes at most once and before `onEnd`, and `onEnd` comes exactly once.
- `ActionService.execute` never throws. It returns `{ ok, message, needsPermission? }`.
- `PermissionsService.check` never shows a prompt. Only `request` does.
- The UI never performs an action itself. `risk: "high"` actions are always confirmed by the person.

## Decisions already made (and why)

- **One web app, not native.** Mobile-first PWA; there is no desktop app.
- **No fake functionality.** Unconnected services report "not connected yet". The demo harness is dev-only (404 unless the flag is set).
- **Atkinson Hyperlegible font**, self-hosted via `@fontsource`, designed for low-vision readers.
- **All sizes in `rem`**, so text size also scales spacing and touch targets. Minimum target is 56px, or 72px with extra-large buttons.
- **The mic button never moves.** Loudness is a halo behind it, because moving targets are hard to hit with a shaky hand.
- **Steppers, not sliders**, for speed and volume (big labelled Slower/Faster buttons).
- **Settings apply before first paint** via an inline script in `layout.tsx`. A test keeps it in sync with the React code.
- **No clock or random values during render**, because Next 16 Cache Components prerenders pages. The first blank conversation has the fixed id `"initial"` and gets a real id on the first message ("claim").
- **History is device-only** (`localStorage`), saved only if "Remember my conversations" is on, and erasing leaves no key behind.
- **Product name** is in one place: `BRAND` in `src/ui/components/BrandMark.tsx`.

## Gotchas

- **Next.js 16 differs from older docs.** Read `node_modules/next/dist/docs/` before using a Next API (see `AGENTS.md`).
- **Page sections must not shrink.** `ScrollPage` and the home scroller use `*:shrink-0`. Without it, settings rows get squashed and their switches overlap the next row. jsdom can't see this; `npm run test:ui` can.
- **axe in jsdom can't check colour contrast.** Contrast is tested separately by `tokens.test.ts`, which reads the real CSS. If you add a colour token, add it to all four theme blocks in `globals.css`. The test will fail if you miss one.
- **The always-present `role="alert"` live region** means `queryByRole("alert")` always finds something in tests. Query by text instead.
- **`next dev` validates instant navigation** and logs an error if a page renders nothing on the server. That is why `AppFrame` always renders the page, with the splash as an overlay.

## Next steps (in priority order)

1. **Get B and C to review `docs/CONTRACTS.md`** and agree or propose changes, before they build too much.
2. **Merge the PR** once someone has looked at it.
3. **Integrate** each service as it lands, then test on a real Android phone: install as a PWA, microphone permission flow, TalkBack, the largest system font size.
4. **Agree on one product pitch.** The README on `main` says step-by-step tech support; the Developer A prompt says a Rabbit R1-style voice assistant with calls and messages. The UI works for both, but Devpost needs one story.
5. **Nice to have:** an offline screen (service worker), a "repeat that" quick action, and a caregiver-contact quick action, if C adds that action.
