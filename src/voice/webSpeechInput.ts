/**
 * Speech-to-text using the browser's built-in speech recognition (the Web Speech API).
 * On Android Chrome this is Google's own recogniser: free, no API key, and it shows the
 * system microphone indicator while listening. Implements the shared VoiceInputService.
 *
 * Owner: Developer B.
 */

import type { VoiceInputError, VoiceInputErrorCode, VoiceInputHandlers, VoiceInputService, VoiceInputSession } from "@/contracts";

// Minimal typings: the Web Speech API is not in TypeScript's DOM library.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  readonly error: string;
  readonly message?: string;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface WebSpeechInputOptions {
  /** Give up if nothing at all is heard for this long. */
  noSpeechMs?: number;
  /** Stop once the person has been quiet this long after speaking. */
  endSilenceMs?: number;
  /** Never listen longer than this. */
  maxMs?: number;
  /** Drive the loudness halo from the real microphone. Off on Android, where it can block recognition. */
  levelMeter?: boolean;
  /** For tests. */
  getRecognition?: () => SpeechRecognitionCtor | undefined;
}

const ERROR_MAP: Record<string, VoiceInputErrorCode> = {
  "not-allowed": "permission-denied",
  "service-not-allowed": "permission-denied",
  "audio-capture": "no-microphone",
  network: "network",
  "no-speech": "no-speech",
};

function browserRecognition(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function createWebSpeechInput(options: WebSpeechInputOptions = {}): VoiceInputService {
  const noSpeechMs = options.noSpeechMs ?? 8_000;
  const endSilenceMs = options.endSilenceMs ?? 2_500;
  const maxMs = options.maxMs ?? 30_000;
  const getRecognition = options.getRecognition ?? browserRecognition;

  return {
    isSupported: () => Boolean(getRecognition()),

    start(handlers: VoiceInputHandlers, { language }: { language: string }): VoiceInputSession {
      const Ctor = getRecognition();
      if (!Ctor) throw new Error("Speech recognition is not available on this device.");

      const rec = new Ctor();
      rec.lang = language || "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let finalText = "";
      let interimText = "";
      let ended = false;
      let discarded = false;
      let reportedError = false;
      const timers = new Set<ReturnType<typeof setTimeout>>();
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      let stopMeter: (() => void) | null = null;

      const later = (ms: number, fn: () => void) => {
        const t = setTimeout(() => {
          timers.delete(t);
          fn();
        }, ms);
        timers.add(t);
        return t;
      };

      const fail = (error: VoiceInputError) => {
        if (reportedError || ended) return;
        reportedError = true;
        handlers.onError(error);
      };

      const finish = () => {
        if (ended) return;
        ended = true;
        for (const t of timers) clearTimeout(t);
        timers.clear();
        stopMeter?.();
        handlers.onLevel?.(0);
        if (!discarded) {
          const heard = (finalText || interimText).trim();
          if (heard) handlers.onFinal(heard);
        }
        handlers.onEnd();
      };

      // Some phones never fire `end` after stop(); don't leave the person stuck in "listening".
      const stopRecognition = () => {
        try {
          rec.stop();
        } catch {
          /* already stopped */
        }
        later(1_500, finish);
      };

      const resetSilence = (ms: number, onQuiet: () => void) => {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          timers.delete(silenceTimer);
        }
        silenceTimer = later(ms, onQuiet);
      };

      rec.onresult = (e) => {
        if (ended || discarded) return;
        let fin = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          const t = r[0]?.transcript ?? "";
          if (r.isFinal) fin += t;
          else interim += t;
        }
        finalText = fin.trim();
        interimText = (fin + interim).trim();
        handlers.onInterim?.(interimText);
        resetSilence(endSilenceMs, stopRecognition);
      };

      rec.onerror = (e) => {
        if (discarded || e.error === "aborted") return;
        // "no-speech" after we already heard something is not an error.
        if (e.error === "no-speech" && (finalText || interimText)) return;
        fail({ code: ERROR_MAP[e.error] ?? "unknown", detail: e.message || e.error });
      };

      rec.onend = finish;

      resetSilence(noSpeechMs, () => {
        if (finalText || interimText) return stopRecognition();
        fail({ code: "no-speech", detail: "timeout" });
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
        later(500, finish);
      });
      later(maxMs, stopRecognition);

      try {
        rec.start();
      } catch (err) {
        fail({ code: "unknown", detail: String(err) });
        later(0, finish);
      }

      if (handlers.onLevel && (options.levelMeter ?? !isAndroid())) {
        startLevelMeter(handlers.onLevel).then(
          (stop) => {
            if (ended) stop();
            else stopMeter = stop;
          },
          () => {
            /* no level: the UI still shows "Listening" in words */
          },
        );
      }

      return {
        stop() {
          if (!ended) stopRecognition();
        },
        abort() {
          if (ended) return;
          discarded = true;
          try {
            rec.abort();
          } catch {
            /* ignore */
          }
          finish();
        },
      };
    },
  };
}

/** Real microphone loudness (0 to 1), about 15 times a second. Rejects if the microphone can't be opened. */
async function startLevelMeter(onLevel: (level: number) => void): Promise<() => void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
    throw new Error("No level meter");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    const rms = Math.sqrt(sum / data.length);
    onLevel(Math.min(1, rms * 4));
  }, 66);
  return () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}
