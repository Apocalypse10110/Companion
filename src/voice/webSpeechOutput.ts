/**
 * Text-to-speech using the device's own voices (the Web Speech API `speechSynthesis`).
 * Free, works offline with on-device voices, and honours the person's speed, volume and voice.
 * Implements the shared VoiceOutputService.
 *
 * Owner: Developer B.
 */

import type { SpeakOptions, VoiceInfo, VoiceOutputService } from "@/contracts";
import { speakable, splitForSpeech } from "./speakable";

export interface SynthesisLike {
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
  addEventListener?(type: "voiceschanged", fn: () => void): void;
  removeEventListener?(type: "voiceschanged", fn: () => void): void;
}

export interface WebSpeechOutputOptions {
  /** For tests. */
  getSynth?: () => SynthesisLike | undefined;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
}

function browserSynth(): SynthesisLike | undefined {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : undefined;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 1));

function sameBase(a: string, b: string): boolean {
  return a.toLowerCase().split(/[-_]/)[0] === b.toLowerCase().split(/[-_]/)[0];
}

/** The best voice for a language: exact match first, then the device default, then local voices. */
export function pickVoice(voices: SpeechSynthesisVoice[], voiceId: string | null, language: string): SpeechSynthesisVoice | undefined {
  if (voiceId) {
    const chosen = voices.find((v) => v.voiceURI === voiceId);
    if (chosen) return chosen;
  }
  const lang = language.toLowerCase().replace("_", "-");
  const exact = voices.filter((v) => v.lang.toLowerCase().replace("_", "-") === lang);
  const base = exact.length ? exact : voices.filter((v) => sameBase(v.lang, lang));
  return base.find((v) => v.default) ?? base.find((v) => v.localService) ?? base[0];
}

export function createWebSpeechOutput(options: WebSpeechOutputOptions = {}): VoiceOutputService {
  const getSynth = options.getSynth ?? browserSynth;
  const makeUtterance = options.createUtterance ?? ((t: string) => new SpeechSynthesisUtterance(t));
  let token = 0;
  let stopCurrent: (() => void) | null = null;

  async function voices(): Promise<SpeechSynthesisVoice[]> {
    const synth = getSynth();
    if (!synth) return [];
    const now = synth.getVoices();
    if (now.length || !synth.addEventListener) return now;
    // Chrome loads voices after the page; wait briefly for them.
    return new Promise((resolve) => {
      const done = () => {
        synth.removeEventListener?.("voiceschanged", done);
        clearTimeout(timer);
        resolve(synth.getVoices());
      };
      const timer = setTimeout(done, 1_500);
      synth.addEventListener!("voiceschanged", done);
    });
  }

  function cancel() {
    token += 1;
    stopCurrent?.();
    stopCurrent = null;
    try {
      getSynth()?.cancel();
    } catch {
      /* ignore */
    }
  }

  return {
    isSupported: () => Boolean(getSynth()) && (options.createUtterance !== undefined || typeof SpeechSynthesisUtterance !== "undefined"),

    cancel,

    async speak(text: string, opts: SpeakOptions): Promise<void> {
      const synth = getSynth();
      if (!synth) throw new Error("Speech output is not available on this device.");
      cancel();
      const mine = token;
      const chunks = splitForSpeech(speakable(text));
      if (!chunks.length) return;
      const voice = pickVoice(await voices(), opts.voiceId, opts.language);
      if (mine !== token) return;

      for (const chunk of chunks) {
        if (mine !== token) return;
        await new Promise<void>((resolve, reject) => {
          const u = makeUtterance(chunk);
          u.lang = voice?.lang ?? opts.language;
          if (voice) u.voice = voice;
          u.rate = clamp(opts.rate, 0.5, 2);
          u.volume = clamp(opts.volume, 0, 1);
          u.pitch = 1;
          let settled = false;
          // Some engines never send `end`. Allow generous time for the words, then move on.
          const guard = setTimeout(() => settle(), Math.max(6_000, (chunk.length * 160) / u.rate));
          function settle(err?: Error) {
            if (settled) return;
            settled = true;
            clearTimeout(guard);
            if (stopCurrent === stop) stopCurrent = null;
            if (err) reject(err);
            else resolve();
          }
          const stop = () => settle();
          stopCurrent = stop;
          u.onend = () => settle();
          u.onerror = (e: SpeechSynthesisErrorEvent) => {
            if (e.error === "interrupted" || e.error === "canceled" || mine !== token) settle();
            else settle(new Error(`Speech failed: ${e.error}`));
          };
          synth.speak(u);
        });
      }
    },

    async listVoices(): Promise<VoiceInfo[]> {
      const all = await voices();
      const lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
      const mine = all.filter((v) => sameBase(v.lang, lang));
      const list = (mine.length ? mine : all).slice();
      list.sort((a, b) => Number(b.lang === lang) - Number(a.lang === lang) || Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
      const seen = new Set<string>();
      return list
        .filter((v) => !seen.has(v.voiceURI) && seen.add(v.voiceURI))
        .map((v) => ({ id: v.voiceURI, label: v.name.replace(/\s*\(.*?\)\s*$/, "") || v.name, language: v.lang }));
    },
  };
}
