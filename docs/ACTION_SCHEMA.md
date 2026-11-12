# Action schema (proposed by Developer B, for Developer C)

**Status: PROPOSED.** The `ProposedAction` shape itself is the shared contract in
`src/contracts/actions.ts`. This page fixes what the assistant puts in `kind` and `params`, so
Developer C's `ActionService` knows exactly what it will receive. Additive changes are welcome; please
discuss before renaming anything.

Every action is produced in one place, `src/ai/assistant.ts`, from an intent that already passed
`validateIntent` (`src/ai/intents/schema.ts`). The UI shows `title` and `description` and asks the
person before running. `risk: "high"` is always confirmed, whatever the settings.

| Intent | `kind` | `params` | `risk` | Example `title` |
| --- | --- | --- | --- | --- |
| CALL_CONTACT | `call` | `{ contact: string }` | high | Call your daughter |
| SEND_MESSAGE | `message` | `{ contact: string, body: string }` | high | Send a message to Emma |
| OPEN_APPLICATION | `open-app` | `{ app: AppName, destination?: string, query?: string }` | low | Open Photos |
| READ_MESSAGES | `open-app` | `{ app: "messages" }` | low | Open Messages |
| CREATE_REMINDER | `reminder` | `{ text: string, at: ISO-8601 string, recurrence?: "daily" \| "weekly" }` | low | Remind me to take your medication |
| LIST_REMINDERS | `list-reminders` | `{ which: "next" \| "today" \| "all" }` | low | Read my next reminder |
| CHANGE_ACCESSIBILITY | `accessibility` | `{ setting, value }` (below) | low | Make the text bigger |

`call`, `message`, `reminder`, `open-app` are already in the contract's `ActionKind`. `list-reminders`
and `accessibility` are new strings, which the contract allows (`string & {}`); the UI shows a generic
card for them. Proposed additive change: add both to `ActionKind`.

## Details for each kind

**`contact`** is what the person said: a name ("emma", lower-case from speech) or a relationship
("daughter", "son", "doctor"). The assistant never resolves or guesses. C should resolve it against
contacts and configured relationship labels, and if there are zero or several matches return
`{ ok: false, message: "I found two people called Emma. ..." }` rather than choose.

**`body`** is the message in the person's words, capitalised ("I'm running late").

**`app`** is one of `photos, camera, phone, messages, calendar, clock, settings, maps, contacts, email, browser`.
For `maps`, `destination` is a place name or `"home"`. For `browser`, `query` may be a search ("weather").

**`at`** is an absolute ISO time already computed on the device from the person's words
("at 8" said at 9 am = 8 pm today). `text` is in the person's words ("Take my medication").

**`list-reminders`**: C reads stored reminders and returns them in `ActionResult.message` as one or two
spoken-friendly sentences, e.g. "Your next reminder is to take your medication, today at 8 PM." The UI
shows and speaks that message, which completes the "latest reminder" demo.

**`accessibility`** settings and values (mirror `src/ui/settings/types.ts`):

| `setting` | `value` | Meaning |
| --- | --- | --- |
| `textSize` | `increase`, `decrease`, `standard`, `large`, `larger`, `largest` | one step or a size |
| `highContrast` | `on`, `off` | |
| `theme` | `light`, `dark`, `system` | |
| `boldText` | `on`, `off` | |
| `motion` | `reduce`, `full` | |
| `extraLargeButtons` | `on`, `off` | |
| `speechRate` | `slower`, `faster`, `normal` | ±0.1 within 0.6-1.4 |
| `volume` | `louder`, `quieter` | ±0.2 within 0.2-1 |
| `speakReplies` | `on`, `off` | |

These change the app's own settings, which live in Developer A's `SettingsProvider`. Executing them
needs a small hook from A (for example, the `ActionService` receiving an `updateSettings` function, or the
UI handling `kind: "accessibility"` itself). To be agreed between A and C; this is what makes the
"make the text bigger" demo change the screen.
