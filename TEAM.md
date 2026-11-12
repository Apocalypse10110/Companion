# Team

One app (Companion, Ice Hacks 2026), one repository, three developers, each with their own Claude Code
session and their own branch. Work merges to `main` through pull requests.

| Developer | Owns | Folders | Branch | Status |
| --- | --- | --- | --- | --- |
| A: Mobile UI and accessibility | Screens, design system, accessibility, onboarding, settings, conversation UI | `src/app/**`, `src/ui/**` | `feature/mobile-ui` | Merged (PR #1) |
| B: AI and voice | Speech in/out, intent understanding, context, AI providers, `/api/assistant` | `src/ai/**`, `src/voice/**`, `src/app/api/assistant/route.ts` | `feature/voice-ai` | PR open |
| C: Actions, integrations, infrastructure | `ActionService`, `PermissionsService`, contacts, calls, messages, reminders storage | `src/actions/**`, `src/permissions/**` | `feature/actions-integrations` | Not started in the repo yet |

Shared, change only by agreement: `src/contracts/**`, `src/integration/index.ts` (each developer edits only their own lines).

## Interfaces

- Contracts (source of truth): `src/contracts/`, explained in [docs/CONTRACTS.md](docs/CONTRACTS.md).
- What the assistant sends to actions: [docs/ACTION_SCHEMA.md](docs/ACTION_SCHEMA.md).
- AI and voice internals: [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md).
- UI: [docs/UI.md](docs/UI.md).

## Dependencies between us

| Needs | From | For |
| --- | --- | --- |
| `ActionService` handling `call`, `message`, `reminder`, `open-app`, `list-reminders`, `accessibility` | C | Every demo flow; cards currently say "I can't do this on this device yet" |
| Contact resolution ("daughter" -> one person, never guessing) | C | "Call my daughter" demo |
| A hook to change settings from an action | A + C | "Make the text bigger" demo |
| `confirmedActionId` (optional) | A | Spoken "yes" running the card |

Progress: [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md).
