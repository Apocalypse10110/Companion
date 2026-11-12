/**
 * Test doubles for the shared contracts. NEVER imported by production code.
 * Used by unit tests (manual control) and by the dev-only harness page (demo timing).
 */

import {
  AssistantError,
  type ActionResult,
  type ConnectionId,
  type ConnectionInfo,
  type ConnectionResult,
  type ConnectionsService,
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
  /** Sign-ins that were started, and accounts that were disconnected. */
  connectRequests: ConnectionId[];
  disconnectRequests: ConnectionId[];
  /** The next connect() result: "ok" signs in, "cancel" is the person closing the sign-in, "fail" errors. */
  setNextConnectOutcome: (outcome: "ok" | "cancel" | "fail") => void;
}

/** Accounts as they start in tests: Calendar connected, Gmail not. */
export function fakeConnections(): ConnectionInfo[] {
  return [
    { id: "google-calendar", name: "Google Calendar", state: "connected", account: "anna.smith@example.com" },
    { id: "gmail", name: "Gmail", state: "disconnected" },
  ];
}

/** A working, in-memory ConnectionsService for tests and the demo harness. */
function createFakeConnections(
  initial: ConnectionInfo[],
  log?: { connect: ConnectionId[]; disconnect: ConnectionId[]; next: () => "ok" | "cancel" | "fail" },
): ConnectionsService {
  const accounts = initial.map((c) => ({ ...c }));
  const find = (id: ConnectionId) => accounts.find((c) => c.id === id) ?? { id, name: "This account", state: "unavailable" as const };
  return {
    list: async () => accounts.map((c) => ({ ...c })),
    async connect(id): Promise<ConnectionResult> {
      log?.connect.push(id);
      const c = find(id);
      const outcome = log?.next() ?? "ok";
      if (outcome === "cancel") return { ok: false, cancelled: true, connection: { ...c }, message: "You closed the sign-in. Nothing was changed." };
      if (outcome === "fail") return { ok: false, connection: { ...c }, message: "I couldn't reach Google. Please try again in a moment." };
      Object.assign(c, { state: "connected", account: "anna.smith@example.com", message: undefined });
      return { ok: true, connection: { ...c }, message: `${c.name} is connected.` };
    },
    async disconnect(id): Promise<ConnectionResult> {
      log?.disconnect.push(id);
      const c = find(id);
      Object.assign(c, { state: "disconnected", account: undefined, message: undefined });
      return { ok: true, connection: { ...c }, message: `${c.name} is disconnected.` };
    },
  };
}

interface Options {
  /** false makes the browser report no speech recognition. */
  voiceInput?: boolean;
  /** false makes the browser report no speech output. */
  voiceOutput?: boolean;
  voices?: Array<{ id: string; label: string; language: string }>;
  /** Anything not listed is treated as unsupported. Default: everything. */
  supportedActions?: string[] | "all";
  /** Accounts the fake ConnectionsService starts with. Default: fakeConnections(). */
  connections?: ConnectionInfo[];
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
  let nextConnectOutcome: "ok" | "cancel" | "fail" = "ok";

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
    connectRequests: [],
    disconnectRequests: [],
    setNextConnectOutcome: (o) => void (nextConnectOutcome = o),
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
    connections: createFakeConnections(options.connections ?? fakeConnections(), {
      connect: controls.connectRequests,
      disconnect: controls.disconnectRequests,
      next: () => {
        const o = nextConnectOutcome;
        nextConnectOutcome = "ok";
        return o;
      },
    }),
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
    connections: createFakeConnections(fakeConnections()),
  };
}
