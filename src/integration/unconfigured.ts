/**
 * Honest placeholders for services that Developers B and C have not connected yet.
 *
 * These do NOT pretend to work. They report "unavailable" so the UI shows a
 * truthful message instead of fake answers. Replace them in `./index.ts`.
 */

import {
  AssistantError,
  type ActionService,
  type AssistantService,
  type ConnectionInfo,
  type ConnectionsService,
  type PermissionsService,
  type Services,
  type VoiceInputService,
  type VoiceOutputService,
} from "@/contracts";

const assistant: AssistantService = {
  async send() {
    throw new AssistantError("unavailable", "The assistant is not connected yet.");
  },
};

const voiceInput: VoiceInputService = {
  isSupported: () => false,
  start() {
    throw new Error("Voice input is not connected yet.");
  },
};

const voiceOutput: VoiceOutputService = {
  isSupported: () => false,
  async speak() {
    throw new Error("Voice output is not connected yet.");
  },
  cancel() {},
  async listVoices() {
    return [];
  },
};

const actions: ActionService = {
  supports: () => false,
  async execute() {
    return { ok: false, message: "This can't be done on this device yet." };
  },
};

const permissions: PermissionsService = {
  async check() {
    return "unsupported";
  },
  async request() {
    return "unsupported";
  },
};

// Calendar and Gmail are listed so the person can see what is coming, but nothing can be
// connected until Developer C provides the real sign-in. No fake logins.
const KNOWN: ConnectionInfo[] = [
  { id: "google-calendar", name: "Google Calendar", state: "unavailable" },
  { id: "gmail", name: "Gmail", state: "unavailable" },
];

const connections: ConnectionsService = {
  async list() {
    return KNOWN.map((c) => ({ ...c }));
  },
  async connect(id) {
    const connection = KNOWN.find((c) => c.id === id) ?? { id, name: "This account", state: "unavailable" as const };
    return { ok: false, connection: { ...connection }, message: "Connecting accounts isn't available yet." };
  },
  async disconnect(id) {
    const connection = KNOWN.find((c) => c.id === id) ?? { id, name: "This account", state: "unavailable" as const };
    return { ok: false, connection: { ...connection }, message: "Connecting accounts isn't available yet." };
  },
};

export const unconfiguredServices: Services = {
  assistant,
  voiceInput,
  voiceOutput,
  actions,
  permissions,
  connections,
};
