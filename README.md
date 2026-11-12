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

### AI (Gemini for testing)

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` (from https://aistudio.google.com/apikey).
That's all: Gemini is used by default when the key is set. The key is read only on the server
(`/api/assistant`); it is never sent to the phone, and `.env.local` is never committed.

- **On Vercel:** Project → Settings → Environment Variables → add `GEMINI_API_KEY`, then redeploy.
- **Check it's on:** open `/api/assistant` in a browser → `{"configured":true,"provider":"gemini"}`,
  or in the app: Settings → Phone and permissions → "Answer questions with my online helper".
- **Switching provider later:** set `AI_PROVIDER` to `anthropic` or `openai-compatible` (e.g. a local
  Ollama). See `.env.example`. With no AI at all, the app still works on the device (simple rules).

### What works on a phone (and what can't)

| Feature | iPhone (Safari) | Android (Chrome) |
| --- | --- | --- |
| Talk to it / read replies aloud | Yes | Yes |
| "Call my daughter" | Opens the dialer with the number; you tap Call | Same |
| "Text Anna I'm late" | Opens Messages with the text ready; you tap Send | Same |
| Who "my daughter" is | Settings → People | Settings → People, or pick from contacts when asked |
| Reminders | On screen + spoken while Companion is open; notifications only once added to the Home Screen | Notifications while Companion is open or recently in the background |
| Maps, email, web search | Yes | Yes |
| Open Camera / Photos / Settings | No (no web app can); it explains how to find them | Same |
| Read SMS or call history | No (phones never allow it); it offers to open Messages | Same |

### Check it

```bash
npm test               # unit, behaviour, voice/AI and accessibility (axe) tests
npm run typecheck
npm run lint
npm run build && npm start   # then, in another terminal:
npm run test:ui        # real-browser check of every screen at largest text + high contrast
npm run test:e2e       # real-browser run of the demo workflows (AI, voice, calls, reminders, offline)
```

### Who owns what

| Area | Owner | Where |
| --- | --- | --- |
| Mobile UI, accessibility, onboarding, settings, conversation screen | Developer A | `src/app`, `src/ui` |
| Assistant (AI) and voice in/out | Developer B | `src/ai`, `src/voice` ([docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md)) |
| Phone actions, permissions, integration, Gemini | Developer C | `src/actions`, `src/permissions`, `src/people`, `src/phone`, `src/integration`, `src/ai/server/gemini.ts` |

**To connect your part, change one line in [`src/integration/index.ts`](src/integration/index.ts).**
Until then the app shows honest "not connected yet" messages; it never fakes an answer.

- [TEAM.md](TEAM.md): who owns what, branches, dependencies
- [docs/CONTRACTS.md](docs/CONTRACTS.md): the interfaces between the three parts (proposed, please review)
- [docs/ACTION_SCHEMA.md](docs/ACTION_SCHEMA.md): exactly what the assistant asks the action engine to do
- [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md): voice, intents, context, AI providers and key handling
- [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md): what's done, blocked and next
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): module boundaries and how it fits together
- [docs/UI.md](docs/UI.md): design system, components, accessibility rules, screens
