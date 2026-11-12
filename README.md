# Companion

### Technical Support for Older Adults

Technology can be confusing, especially when you're not used to it. Something as simple as setting up a phone, fixing a computer issue, or figuring out a new app can quickly become frustrating.

We created Companion to make those everyday problems easier.

Companion is an AI-powered assistant designed to help older adults with technology. Users can ask questions in plain language and get simple, step-by-step instructions without having to navigate confusing menus or search through endless tutorials.

Our goal is simple: help older adults feel more comfortable using technology, stay independent, and keep in touch with the people who matter most.

Technology should bring people together, not leave anyone behind.

---

## For the team

One mobile web app (Next.js 16, React 19, TypeScript, Tailwind CSS v4), installable on Android as a PWA.
Built for **Ice Hacks 2026**.

### Run it

```bash
npm install
npm run dev            # http://localhost:3000  (first visit opens the welcome walkthrough)
```

### Check it

```bash
npm test               # 163 unit, behaviour and accessibility (axe) tests
npm run typecheck
npm run lint
npm run build && npm start   # then, in another terminal:
npm run test:ui        # real-browser check of every screen at largest text + high contrast
```

### Who owns what

| Area | Owner | Where |
| --- | --- | --- |
| Mobile UI, accessibility, onboarding, settings, conversation screen | Developer A | `src/app`, `src/ui` |
| Assistant (AI) and voice in/out | Developer B | implements contracts in `src/contracts` |
| Phone actions, permissions, infrastructure | Developer C | implements contracts in `src/contracts` |

**To connect your part, change one line in [`src/integration/index.ts`](src/integration/index.ts).**
Until then the app shows honest "not connected yet" messages; it never fakes an answer.

- [docs/CONTRACTS.md](docs/CONTRACTS.md): the interfaces between the three parts (proposed, please review)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): module boundaries and how it fits together
- [docs/UI.md](docs/UI.md): design system, components, accessibility rules, screens
