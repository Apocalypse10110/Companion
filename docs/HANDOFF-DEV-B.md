# Handoff: Developer B (AI and voice)

Read this first if you are picking up Developer B's work in a new session. Last updated: 2026-11-11.

## One paragraph

B implemented the three contracts A proposed, unchanged: `AssistantService` (`src/ai`),
`VoiceInputService` and `VoiceOutputService` (`src/voice`), and connected them in
`src/integration/index.ts`. Understanding runs on the device with plain rules, so it works offline
and for free; an optional server AI (Anthropic or any OpenAI-compatible server, including local
Ollama) handles unusual wording and general questions. The assistant only *proposes* actions; C's
`ActionService` performs them after the person taps. Work is on `feature/voice-ai`, PR to `main`.

## Commands

```bash
git checkout feature/voice-ai && npm install
npm test                    # all tests, including src/ai and src/voice
npx vitest run src/ai src/voice
npm run build && npm start  # then type or talk on http://localhost:3000
cp .env.example .env.local  # optional: set AI_PROVIDER etc.
```

## Decisions (and why)

- **Rules first, AI second.** Fast, predictable and free for the demo phrases; AI only when rules fail.
- **One validator for everything** (`validateIntent`). AI output is untrusted; unknown intents, apps or settings are dropped.
- **Our wording on action cards**, never the model's, so a model can't mislabel what a button does.
- **Never guess people.** B passes the person's words ("daughter"); C resolves or asks.
- **Key on the server only**, behind a same-origin, rate-limited, size-capped route.
- **Default Claude model `claude-opus-5-5` at `effort: low`**, with server-side refusal fallback on. Change with `AI_MODEL`.
- **Web Speech API** for both directions: real, free, no key, native microphone indicator on Android.
- **No level meter on Android**, because opening the mic twice can break recognition; the UI shows "Listening" in words instead of a fake level.

## Gotchas

- `@anthropic-ai/sdk` refuses to load in a browser-like environment. Keep `src/ai/server/**` out of client imports (`src/ai/index.ts` only exports client-safe code). Tests mock the SDK.
- The UI sends history without our pending state; context resets when the last assistant turn isn't our last reply.
- `npx tsc --noEmit` on a fresh clone complains about `LayoutProps` until Next generates types (run `npm run build` once). Not ours.
- Headless Chromium for e2e: `npx playwright-core install chromium-headless-shell` (no Chrome on the dev Mac).

## ECC (Everything Claude Code)

The brief asks to use an existing ECC installation. On this machine there is none: `~/.claude/plugins`
has only `clangd-lsp`, and there are no ECC agents, skills, commands, hooks or rules. Nothing was
installed or changed. Instead B used built-in Claude Code capabilities: plan mode for the plan, the
`claude-api` skill for the Anthropic adapter (current model IDs, structured output, fallbacks), and
the project's own test, lint, build and headless-browser checks.

## Next steps

1. Merge the PR after review.
2. With C: agree `docs/ACTION_SCHEMA.md`, then test every flow with real actions.
3. With A: `confirmedActionId` (spoken yes) and the accessibility-settings hook.
4. On a real Android phone: recognition accuracy for older voices, speech voice choice, timeouts.
5. Possible: more languages in rules; weather via a free API through the server route.
