# AI and voice architecture (Developer B)

Developer B owns `src/ai/**`, `src/voice/**` and the single route file `src/app/api/assistant/route.ts`.
These implement three shared contracts from `src/contracts/`: `AssistantService`, `VoiceInputService`,
`VoiceOutputService`. They are connected in `src/integration/index.ts`.

## The pipeline

```
tap mic ─▶ VoiceInputService (Web Speech API) ─▶ "Call my daughter"
                                                     │
                                       AssistantService.send()
                                                     │
          ┌──────────────────────────────────────────┼─────────────────────────────┐
          │ 1. context: yes / no, "her", answers to our questions ("Who?" -> "Emma") │
          │ 2. on-device rules (src/ai/intents/rules.ts)        ◀── always available │
          │ 3. help, questions, photos, unclear: Gemini via /api/assistant          │
          │ 4. validateIntent(): allowlisted intents, apps, settings, capped text   │
          │ 5. reply text + ONE ProposedAction (kind, params, risk)                 │
          └──────────────────────────────────────────┼─────────────────────────────┘
                                                     │
                     UI shows the reply and an action card. Person taps "Yes, do it".
                                                     │
                            Developer C: ActionService.execute(action)
                                                     │
                     UI shows and speaks the result ─▶ VoiceOutputService (speechSynthesis)
```

The assistant **never executes anything**. It only proposes. An AI model can never reach the action
engine directly: its output is untrusted JSON that goes through the same `validateIntent` as the
local rules, and the wording on every action card is ours, not the model's.

## Files

| File | What it does |
| --- | --- |
| `src/ai/intents/schema.ts` | Intent names, allowlists, `validateIntent` |
| `src/ai/intents/rules.ts` | On-device classifier: polite-phrase stripping, patterns per intent |
| `src/ai/intents/time.ts` | "at 8", "tomorrow at 3", "in 20 minutes", "every day at 9" -> `Date` |
| `src/ai/context.ts` | Pending offer, last person mentioned, question we're waiting on |
| `src/ai/assistant.ts` | `createAssistant()`: the `AssistantService` |
| `src/ai/words.ts` | "your daughter", "take your pills", keeping the person's capitals |
| `src/ai/providers/` | `AIProvider` interface, `noProvider`, `createRemoteProvider` (calls `/api/assistant`) |
| `src/ai/server/` | Server-only: route handler, Anthropic and OpenAI-compatible adapters, prompt + JSON schema |
| `src/voice/webSpeechInput.ts` | `VoiceInputService` on `SpeechRecognition` |
| `src/voice/webSpeechOutput.ts` | `VoiceOutputService` on `speechSynthesis` |
| `src/voice/speakable.ts` | Removes symbols/links/emoji; splits long text into sentence chunks |

## Intents

`CALL_CONTACT, SEND_MESSAGE, READ_MESSAGES, OPEN_APPLICATION, CHANGE_ACCESSIBILITY, CREATE_REMINDER,
LIST_REMINDERS, CHECK_WEATHER, READ_TIME, FIND_INFORMATION, HELP, CONFIRM, DENY, UNKNOWN`.
How each becomes a `ProposedAction` is in [ACTION_SCHEMA.md](./ACTION_SCHEMA.md).

| Intent | Without AI | With AI |
| --- | --- | --- |
| Call, message, reminders, accessibility, open app | Full (rules) | Also understands unusual wording |
| Read the time / date | Full, answered on device | Same |
| Read messages | Honest: a web app can't read SMS. Offers to open Messages | Same |
| Weather | Honest: can't check. Offers to open the browser | Model may answer or say it can't (no live data) |
| General questions / help | Fixed help text | Short plain-language answer |

## Conversation context

- **Yes / no.** "Call Emma" -> card. "Yes" -> "Please tap *Yes, do it* on the card above to call Emma."
  A spoken yes cannot run the action yet, because the UI only runs actions on a tap (safety rule).
  See the `confirmedActionId` proposal in [CONTRACTS.md](./CONTRACTS.md).
- **Questions.** "Call" -> "Who would you like to call?" -> "my son please" -> card. Same for message
  recipient and text, reminder text and time. While waiting for message text, *anything* said is taken
  as the message ("call me later" is not treated as a call).
- **Pronouns.** her / him / them / that person -> the last person mentioned. If there is none, the
  assistant asks. It never guesses between people; resolving "daughter" to a real contact is C's job.
- **Reset.** Context is kept only while the history the UI sends ends with our last reply. A new or
  reopened conversation starts clean (it can still recover the last person named from the history).

## Voice

**Input** uses the browser's speech recognition (`SpeechRecognition` / `webkitSpeechRecognition`).
On Android Chrome that is Google's recogniser: free, no key, real system microphone indicator.
One sentence per tap; live text via `onInterim`; `onFinal` at most once and before `onEnd`; `onEnd`
exactly once even if the browser never fires `end`. Timeouts: 8 s with nothing heard (`no-speech`),
stops 2.5 s after the person goes quiet, 30 s hard cap. The loudness halo uses the real microphone
level only off Android (opening the mic twice can stop recognition on Android); otherwise no level is
sent and the UI shows "Listening" in words. Nothing is ever simulated.

**Output** uses `speechSynthesis`, with the person's speed, volume and voice from Settings. Text is
cleaned (`speakable`) and spoken in sentence chunks so long answers don't stall and Cancel is instant.
`speak()` resolves on finish or cancel and rejects only on a real engine error.

## AI providers and keys

Configured only on the server (see `.env.example`):

| `AI_PROVIDER` | Needs | Notes |
| --- | --- | --- |
| *(empty)* | nothing | On-device only. `/api/assistant` answers 503 and the client stops asking. |
| `anthropic` | `AI_API_KEY` (or `ANTHROPIC_API_KEY`) | Official SDK, structured JSON output, `effort: low`, default model `claude-opus-5-5` (set `AI_MODEL` to change), server-side refusal fallback enabled |
| `openai-compatible` | `AI_BASE_URL`, `AI_MODEL` | Any `/chat/completions` server: Ollama (`http://localhost:11434/v1`), LM Studio, vLLM, llama.cpp |
| `openai` | `AI_API_KEY`, `AI_MODEL` | `openai-compatible` with the OpenAI URL |

**Why the key is on the server.** Anything shipped inside a web app or APK can be read by anyone who
installs it, and a leaked key can be used to run up a bill or abuse the account. So the phone never
gets the key: it calls this app's own `/api/assistant`, which adds the key. The route also accepts only
same-origin requests, caps body size (16 KB) and history (12 turns), rate-limits (30/min per caller),
times out after 20 s, logs no request content, and validates the model's intent before returning it.
Do not put keys in `NEXT_PUBLIC_*` variables. If you build a static/offline APK with no server, leave
AI unset: the on-device assistant still works.

## Tests

| File | Covers |
| --- | --- |
| `src/ai/intents/rules.test.ts` | ~80 phrasings, including every example in the brief |
| `src/ai/intents/schema.test.ts` | Validator: unknown intents, extra fields, allowlists, caps |
| `src/ai/intents/time.test.ts` | Time parsing and how times are said back |
| `src/ai/assistant.test.ts` | Demo flows, context (yes/no, slots, pronouns, reset), honest limits, AI provider safety, cancel |
| `src/ai/server/handler.test.ts` | Route: 503/403/400/413/429/502/504, validation, adapters, client provider |
| `src/voice/voice.test.ts` | Recognition callback order and once-only, errors, timeouts; speech chunks, voice choice, cancel, errors |

## Known limitations

- Speech recognition needs Chrome/Edge/Safari; Firefox has none (the UI offers typing). On Android it may need internet.
- Speech output voices and quality depend on the phone.
- Rules are English-only; other languages need the AI provider.
- A spoken "yes" can't run an action until the UI adopts `confirmedActionId` (proposed).
- Weather and reading SMS are not possible from a web app without extra services or OS roles.
- Context lives in memory on the device and resets on reload (recovering the last-named person from history).

## Updates by Developer C (Nov 12)

- **Gemini is the default provider** (`src/ai/server/gemini.ts`, official `@google/genai` SDK). It is used when `GEMINI_API_KEY` is set and `AI_PROVIDER` is empty. Models are tried in order when one is overloaded or out of quota. Gemini 3 models use low thinking (about 2 s replies).
- **The AI leads conversation.** HELP, FIND_INFORMATION, UNKNOWN, weather, and a "yes" or "no" with nothing pending go to the AI with the history. Clear actions stay on the device.
- **Schema additions:** `suggestions` (up to 3 tap replies), `skill` (task being taught), `taskDone`. All are validated server side.
- **Show Me:** `AssistantRequest.image` (JPEG, base64, shrunk on the device). It always goes to the AI. The Anthropic and OpenAI-compatible adapters also accept it.
- **Help that fades:** finished tasks are stored in `src/ai/skills.ts` and sent as `skills`. The prompt switches from giving the step to letting them try first, with hints.
- **Errors:**
  - A refused key gives 503 `ai-auth`; the client then uses on-device mode and says "can't reach my online helper".
  - Quota gives 429 `ai-busy`.
  - Overloaded models give 502.
  - `GET /api/assistant` reports `{configured, provider, problem}`.

