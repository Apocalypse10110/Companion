# Shared contracts (proposed by Developer A)

These are the interfaces between the mobile UI and the other two developers.
The source of truth is the TypeScript in [`src/contracts/`](../src/contracts). This page explains them.

**Status: PROPOSED.** The repository had no shared contracts when Developer A started, so A wrote
them. Developers B and C: please read, then either accept them or edit the files in `src/contracts/`
in a PR that Developer A reviews. Until then, the UI is built against exactly these shapes.

## Who implements what

| Contract | File | Implemented by |
| --- | --- | --- |
| `AssistantService` | `src/contracts/assistant.ts` | Developer B |
| `VoiceInputService`, `VoiceOutputService` | `src/contracts/voice.ts` | Developer B |
| `ActionService` | `src/contracts/actions.ts` | Developer C |
| `PermissionsService` | `src/contracts/permissions.ts` | Developer C |

## How to connect your work (one line each)

Open `src/integration/index.ts` and swap the placeholder:

```ts
export const services: Services = {
  assistant: myAssistant,        // Developer B
  voiceInput: myVoiceInput,      // Developer B
  voiceOutput: myVoiceOutput,    // Developer B
  actions: myActions,            // Developer C
  permissions: myPermissions,    // Developer C
};
```

Until swapped, the UI shows honest "not connected yet" messages. It never fakes an answer.

## What the UI promises

- It calls `permissions.request()` only when a feature needs it, never all at once at start-up.
- It calls `voiceInput.start()` only from a tap (browsers require this).
- It passes the person's **speech speed, volume and voice** to `voiceOutput.speak()` on every call.
- It never performs an action itself. It shows each `ProposedAction` to the person first.
  `risk: "high"` actions are **always** confirmed, even when the person turned confirmations off.
- It shows `AssistantReply.text` on screen and speaks `spokenText ?? text` when speaking is on.
- It keeps at most 12 recent turns in `AssistantRequest.history`.

## What the UI needs from you

**Developer B (assistant and voice)**
- `send()` resolves with a full `AssistantReply`, or rejects with `AssistantError` (`unavailable`, `network`, `timeout`, `unknown`).
- Replies should be short, plain and free of emoji/markup, because many will be read aloud (`request.hints`).
- `VoiceInputHandlers.onEnd` must be called **exactly once** per `start()`. `onError` may precede it.
- `speak()` resolves when speech finishes or is cancelled. `cancel()` is always safe to call.

**Developer C (actions and permissions)**
- `ActionService.execute()` must never throw. Report failure with `{ ok: false, message }`.
- `message` is a sentence for an older adult, for example "Calling Anna now."
- If an action fails only because of a missing permission, set `needsPermission` so the UI can explain and offer to ask.
- `PermissionsService.check()` must never show a prompt. `request()` may.

## Changing a contract

1. Open a PR that edits `src/contracts/*` and this file together.
2. Tag the other two developers. All three must agree before merge.
3. Developer A updates the UI in the same or the next PR.

Additive changes (a new optional field, a new `PermissionName`) are the safe kind.

## Developer B's response (2026-11-11)

B **accepts** `AssistantService`, `VoiceInputService` and `VoiceOutputService` as written and has
implemented them unchanged (`src/ai`, `src/voice`, connected in `src/integration/index.ts`).
What B puts inside `ProposedAction.kind` / `params` is in [ACTION_SCHEMA.md](./ACTION_SCHEMA.md).

Proposed **additive** changes, for A and C to agree:

1. Add `"list-reminders"` and `"accessibility"` to `ActionKind` (B already sends them; they type-check today via `string & {}`).
2. `AssistantReply.confirmedActionId?: string`: set when the person says "yes" to an offer that is still
   on screen. The UI could then run that existing card (it would stay the UI's decision; high-risk could
   still require a tap). Until then B answers "Please tap *Yes, do it* on the card above".
3. A way to execute `accessibility` actions against `SettingsProvider` (owned by A), needed for the
   "make the text bigger" demo. See ACTION_SCHEMA.md.
