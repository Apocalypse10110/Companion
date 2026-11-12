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

### Optional AI

The assistant works with no AI service at all (on-device understanding). To let it handle unusual
wording and general questions, copy `.env.example` to `.env.local` and set `AI_PROVIDER`
(`anthropic` or `openai-compatible`, e.g. a local Ollama). Keys stay on the server.

### Check it

```bash
npm test               # unit, behaviour, voice/AI and accessibility (axe) tests
npm run typecheck
npm run lint
npm run build && npm start   # then, in another terminal:
npm run test:ui        # real-browser check of every screen at largest text + high contrast
```

### Who owns what

| Area | Owner | Where |
| --- | --- | --- |
| Mobile UI, accessibility, onboarding, settings, conversation screen | Developer A | `src/app`, `src/ui` |
| Assistant (AI) and voice in/out | Developer B | `src/ai`, `src/voice` ([docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md)) |
| Phone actions, permissions, infrastructure | Developer C | implements contracts in `src/contracts` |

**To connect your part, change one line in [`src/integration/index.ts`](src/integration/index.ts).**
Until then the app shows honest "not connected yet" messages; it never fakes an answer.

- [TEAM.md](TEAM.md): who owns what, branches, dependencies
- [docs/CONTRACTS.md](docs/CONTRACTS.md): the interfaces between the three parts (proposed, please review)
- [docs/ACTION_SCHEMA.md](docs/ACTION_SCHEMA.md): exactly what the assistant asks the action engine to do
- [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md): voice, intents, context, AI providers and key handling
- [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md): what's done, blocked and next
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): module boundaries and how it fits together
- [docs/UI.md](docs/UI.md): design system, components, accessibility rules, screens
- [docs/HANDOFF-DEV-A.md](docs/HANDOFF-DEV-A.md): status, decisions, gotchas and next steps for the UI (read first in a new session)
