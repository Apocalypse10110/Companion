/**
 * Test doubles for the shared contracts. NEVER imported by production code.
 * Used by unit tests (manual control) and by the dev-only harness page (demo timing).
 */

import {
  AssistantError,
  type ActionResult,
  type AssistantReply,
  type AssistantRequest,
  type PermissionName,
  type PermissionState,
  type ProposedAction,
  type Services,
  type SpeakOptions,
  type VoiceInputError,
  type VoiceInputHandlers,
} from "@/contracts";

export interface FakeControls {
  /** Every request the assistant received. */
  requests: AssistantRequest[];
  /** Everything "spoken", with the options the UI passed. */
  spoken: Array<{ text: string; options: SpeakOptions }>;
  /** Actions that were executed. */
  executed: ProposedAction[];
  /** Permission prompts that were shown. */
  permissionRequests: PermissionName[];
  /** How many times the microphone was started / stopped. */
  micStarts: number;
  micAborts: number;

  // Manual mode
  resolveAssistant: (reply: AssistantReply) => void;
  rejectAssistant: (error: unknown) => void;
  emitInterim: (text: string) => void;
  emitFinal: (text: string) => void;
  failMic: (error: VoiceInputError) => void;
  endMic: () => void;
  finishSpeaking: () => void;
  setPermission: (name: PermissionName, state: PermissionState) => void;
  setNextActionResult: (result: ActionResult) => void;
  setNextPermissionResult: (state: PermissionState) => void;
}

interface Options {
  /** false makes the browser report no speech recognition. */
  voiceInput?: boolean;
  /** false makes the browser report no speech output. */
  voiceOutput?: boolean;
  voices?: Array<{ id: string; label: string; language: string }>;
  /** Anything not listed is treated as unsupported. Default: everything. */
  supportedActions?: string[] | "all";
}

/** Fully manual: nothing happens until a test calls a control. */
export function createFakeServices(options: Options = {}): { services: Services; controls: FakeControls } {
  const pendingReplies: Array<{ resolve: (r: AssistantReply) => void; reject: (e: unknown) => void; signal?: AbortSignal }> = [];
  let handlers: VoiceInputHandlers | null = null;
  let speakResolve: (() => void) | null = null;
  const permissionStates = new Map<PermissionName, PermissionState>();
  let nextActionResult: ActionResult | null = null;
  let nextPermissionResult: PermissionState | null = null;
  const supported = options.supportedActions ?? "all";

  const controls: FakeControls = {
    requests: [],
    spoken: [],
    executed: [],
    permissionRequests: [],
    micStarts: 0,
    micAborts: 0,
    resolveAssistant: (reply) => pendingReplies.shift()?.resolve(reply),
    rejectAssistant: (error) => pendingReplies.shift()?.reject(error),
    emitInterim: (t) => handlers?.onInterim?.(t),
    emitFinal: (t) => handlers?.onFinal(t),
    failMic: (e) => handlers?.onError(e),
    endMic: () => {
      const h = handlers;
      handlers = null;
      h?.onEnd();
    },
    finishSpeaking: () => {
      const r = speakResolve;
      speakResolve = null;
      r?.();
    },
    setPermission: (n, s) => void permissionStates.set(n, s),
    setNextActionResult: (r) => void (nextActionResult = r),
    setNextPermissionResult: (s) => void (nextPermissionResult = s),
  };

  const services: Services = {
    assistant: {
      send(request, opts) {
        controls.requests.push(request);
        return new Promise<AssistantReply>((resolve, reject) => {
          const entry = { resolve, reject, signal: opts?.signal };
          pendingReplies.push(entry);
          opts?.signal?.addEventListener("abort", () => {
            const i = pendingReplies.indexOf(entry);
            if (i >= 0) pendingReplies.splice(i, 1);
            reject(new AssistantError("unknown", "aborted"));
          });
        });
      },
    },
    voiceInput: {
      isSupported: () => options.voiceInput !== false,
      start(h) {
        controls.micStarts += 1;
        handlers = h;
        return {
          stop: () => controls.endMic(),
          abort: () => {
            controls.micAborts += 1;
            handlers = null;
          },
        };
      },
    },
    voiceOutput: {
      isSupported: () => options.voiceOutput !== false,
      speak(text, o) {
        controls.spoken.push({ text, options: o });
        return new Promise<void>((resolve) => {
          speakResolve = resolve;
        });
      },
      cancel: () => controls.finishSpeaking(),
      listVoices: async () => options.voices ?? [],
    },
    actions: {
      supports: (kind) => supported === "all" || supported.includes(kind),
      async execute(action) {
        controls.executed.push(action);
        const r = nextActionResult ?? { ok: true, message: `Done: ${action.title}.` };
        nextActionResult = null;
        return r;
      },
    },
    permissions: {
      check: async (name) => permissionStates.get(name) ?? "granted",
      async request(name) {
        controls.permissionRequests.push(name);
        const result = nextPermissionResult ?? "granted";
        nextPermissionResult = null;
        permissionStates.set(name, result);
        return result;
      },
    },
  };

  return { services, controls };
}

/** Plays a believable conversation on timers, for looking at the UI. Not real intelligence. */
export function createDemoServices(): Services {
  const wait = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new AssistantError("unknown", "aborted"));
      });
    });

  return {
    assistant: {
      async send(request, opts) {
        await wait(request.text.toLowerCase().includes("slow") ? 4000 : 1200, opts?.signal);
        if (request.text.toLowerCase().includes("fail")) throw new AssistantError("network");
        const wantsCall = /call/i.test(request.text);
        return {
          id: `demo-${request.history.length}`,
          text: wantsCall
            ? "I can call your daughter. Her number ends in 4821."
            : "I'm here to help. You can ask me to call someone, send a message, or set a reminder.",
          proposedActions: wantsCall
            ? [{ id: "a1", kind: "call", title: "Call Anna (daughter)", description: "Mobile ending in 4821", risk: "high", params: {} }]
            : undefined,
          suggestions: wantsCall ? undefined : ["Call my daughter", "Set a reminder"],
        };
      },
    },
    voiceInput: {
      isSupported: () => true,
      start(h) {
        const timers = [setTimeout(() => h.onInterim?.("Call my"), 500), setTimeout(() => h.onInterim?.("Call my daughter"), 1000)];
        const level = setInterval(() => h.onLevel?.(Math.random()), 120);
        const finish = () => {
          timers.forEach(clearTimeout);
          clearInterval(level);
        };
        return {
          stop: () => {
            finish();
            h.onFinal("Call my daughter");
            h.onEnd();
          },
          abort: finish,
        };
      },
    },
    voiceOutput: {
      isSupported: () => true,
      speak: (_t, o) => new Promise((r) => setTimeout(r, 2500 / o.rate)),
      cancel() {},
      listVoices: async () => [
        { id: "v1", label: "Clear voice", language: "en-US" },
        { id: "v2", label: "Warm voice", language: "en-GB" },
      ],
    },
    actions: {
      supports: () => true,
      execute: async (a) => ({ ok: true, message: `Calling now: ${a.title}.` }),
    },
    permissions: {
      check: async () => "granted",
      request: async () => "granted",
    },
  };
}
