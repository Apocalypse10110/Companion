/**
 * CONTRACT: voice input and output
 * Proposed by Developer A (mobile UI). Implemented by Developer B.
 *
 * Input turns speech into text. Output speaks text aloud.
 * The UI owns *when* to listen/speak and *how it looks*; B owns *how* it works.
 */

export interface VoiceInputHandlers {
  /** Live guess while the person is still talking. Shown on screen. */
  onInterim?: (text: string) => void;
  /**
   * The finished sentence. The UI sends this to the assistant.
   * Called at most once per `start()`, and always BEFORE `onEnd`.
   */
  onFinal: (text: string) => void;
  /** Optional microphone loudness, 0 to 1. Drives the listening indicator. */
  onLevel?: (level: number) => void;
  /** Something went wrong. After this, onEnd is still called once. */
  onError: (error: VoiceInputError) => void;
  /** Listening has stopped, for any reason. Always called exactly once. */
  onEnd: () => void;
}

export type VoiceInputErrorCode =
  /** Nothing was heard before the timeout. */
  | "no-speech"
  /** The person refused the microphone. */
  | "permission-denied"
  /** No microphone could be found or opened. */
  | "no-microphone"
  /** Network needed for recognition was unavailable. */
  | "network"
  /** Anything else. */
  | "unknown";

export interface VoiceInputError {
  code: VoiceInputErrorCode;
  /** Technical detail for logs. Never shown to the person. */
  detail?: string;
}

export interface VoiceInputSession {
  /** Stop listening and deliver what was heard so far via onFinal. */
  stop(): void;
  /** Stop listening and throw away what was heard. */
  abort(): void;
}

export interface VoiceInputService {
  /** False when this browser/device cannot listen at all. */
  isSupported(): boolean;
  /** Begin listening. Must be called from a tap (browsers require it). */
  start(handlers: VoiceInputHandlers, options: { language: string }): VoiceInputSession;
}

export interface SpeakOptions {
  /** Speaking speed. 1 is normal. UI offers 0.6 to 1.4. */
  rate: number;
  /** Loudness. 0 (silent) to 1 (full). */
  volume: number;
  /** Which voice to use. null means the device default. */
  voiceId: string | null;
  /** BCP 47 language tag, for example "en-US". */
  language: string;
}

export interface VoiceInfo {
  id: string;
  /** Name shown to the person. */
  label: string;
  language: string;
}

export interface VoiceOutputService {
  isSupported(): boolean;
  /** Speak the text. Resolves when finished or cancelled. Rejects on failure. */
  speak(text: string, options: SpeakOptions): Promise<void>;
  /** Stop speaking right now. Safe to call when nothing is playing. */
  cancel(): void;
  /** Voices the person can choose from. May be empty. */
  listVoices(): Promise<VoiceInfo[]>;
}
