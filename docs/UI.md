# Mobile UI and design system (Developer A)

## Screens

| Route | Screen | What it does |
| --- | --- | --- |
| `/` | Home | Greeting, the big microphone, typing, quick buttons, the conversation |
| `/history` | History | Saved conversations: read, continue, delete |
| `/settings` | Settings | Four sections, below |
| `/settings/display` | Text and looks | Text size (4 steps), bold, theme, high contrast, extra-large buttons, spacing, quick buttons |
| `/settings/voice` | Voice | Read answers aloud, speed, volume, voice choice, "Hear an example" |
| `/settings/accessibility` | Accessibility | Reduce motion, screen-reader announcements, vibration, reset all |
| `/settings/privacy` | Privacy and safety | Ask before doing things, remember conversations, erase |
| `/onboarding` | Welcome | 5 short steps; shown automatically on first visit; skippable |

## The microphone button

One button that does the obvious next thing. Its visible words and its screen-reader name are the same:

| Phase | Says | Tapping it |
| --- | --- | --- |
| idle | Tap to talk | starts listening (explains first if the microphone hasn't been allowed) |
| listening | Listening. Tap when done | sends what was heard |
| thinking | Thinking. Tap to cancel | cancels the request |
| speaking | Speaking. Tap to stop | stops reading aloud |

The button never moves or resizes (a moving target is hard to hit). The words beside it sit in fixed slots, and what is being heard floats above the panel,
so the panel is the same height in every state. Loudness is shown by a halo behind it,
which disappears with reduce motion.

## Design tokens

All in [`src/app/globals.css`](../src/app/globals.css). Four colour sets: warm light, warm dark, and a
high-contrast version of each. Orange is the brand (mic, "on", current place); actions are deep warm ink. Every text/background pair and every control border is checked against WCAG by
`tokens.test.ts`, which reads the real CSS (normal themes: AA; high-contrast: AAA for text).

| Tailwind class | Meaning |
| --- | --- |
| `bg-bg`, `bg-surface`, `bg-surface-2` | page, card, inset |
| `text-ink`, `text-muted` | main text, secondary text |
| `bg-primary` / `text-on-primary` | main action and selected state |
| `bg-accent` / `text-on-accent` | the microphone and brand |
| `text-accent-ink` | orange for words and icons (links, row icons, current tab); passes AA on every surface |
| `*-soft` | tinted backgrounds for messages and banners |
| `bw` | standard border (1px, 2px in high contrast) |
| `bwc` | form-control border (always 3:1 contrast) |
| `min-h-[var(--target)]` | minimum touch target: 56px, 72px with extra-large buttons, grows with text |

Settings are applied as `data-*` attributes on `<html>` (`theme`, `contrast`, `motion`, `bold`, `buttons`,
`spacing`) plus `--text-scale`. An inline script applies them before first paint, so there is no flash.
A test checks that script and the React code always agree.

## Components (`src/ui/components`)

`Button`, `MicButton`, `Toggle` (a switch row that says On/Off in words), `ChoiceGroup` (real radio
buttons), `Stepper` (two big labelled buttons instead of a slider), `Card`, `Banner` (icon + word per tone,
never colour alone), `ConfirmDialog` (native `<dialog>`), `ListLink`, `PageHeader`, `ScrollPage`, `BrandMark`.

## Accessibility checklist (all enforced by tests or the browser check)

- Text scales 1x to 1.65x and everything (spacing, targets) scales with it; pinch-zoom is never blocked.
- No horizontal scrolling and no tappable thing under 44px, at 360px wide with the largest text.
- Every control has a visible text label; icons are decorative.
- One `h1` per page; skip link; focus moves to the new page or step; big visible focus ring.
- One polite and one assertive live region announce Listening, Thinking, replies and results.
- Reduce motion follows the phone, or can be forced on or off.
- Permissions are asked one at a time, only when needed, after a plain explanation.
- High-risk actions (calling, messaging, money, deleting) are always confirmed, whatever the settings say.
- Errors say what happened and what to do, with Try again. Cancelling is never treated as an error.

## Looking at the UI without B and C

`NEXT_PUBLIC_COMPANION_HARNESS=1 npm run dev`, then open `/dev/harness`. It plays a scripted conversation
(listening, a reply, a "Call Anna" confirmation). Without that variable the page returns 404, so it never ships.
The scripted services live in `src/ui/testing/` and are never imported by production code.
