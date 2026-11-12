import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceInputHandlers } from "@/contracts";
import { speakable, splitForSpeech } from "./speakable";
import { createWebSpeechInput, type SpeechRecognitionLike } from "./webSpeechInput";
import { createWebSpeechOutput, pickVoice, type SynthesisLike } from "./webSpeechOutput";

// ---------- fake recognition ----------

class FakeRecognition implements SpeechRecognitionLike {
  static last: FakeRecognition;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 5;
  onresult: SpeechRecognitionLike["onresult"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  started = 0;
  stopped = 0;
  aborted = 0;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
  }
  abort() {
    this.aborted++;
  }
  hear(parts: Array<[string, boolean]>) {
    const results = parts.map(([t, isFinal]) => Object.assign([{ transcript: t }], { isFinal }));
    this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: results.length }) as never });
  }
}

function handlers() {
  const calls: string[] = [];
  const h: VoiceInputHandlers & { calls: string[] } = {
    calls,
    onInterim: (t) => calls.push(`interim:${t}`),
    onFinal: (t) => calls.push(`final:${t}`),
    onError: (e) => calls.push(`error:${e.code}`),
    onEnd: () => calls.push("end"),
    onLevel: () => {},
  };
  return h;
}

const input = (opts = {}) => createWebSpeechInput({ getRecognition: () => FakeRecognition, levelMeter: false, ...opts });

describe("web speech input", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports support only when the browser has recognition", () => {
    expect(input().isSupported()).toBe(true);
    expect(createWebSpeechInput({ getRecognition: () => undefined }).isSupported()).toBe(false);
  });

  it("configures recognition for one sentence with live text", () => {
    input().start(handlers(), { language: "en-GB" });
    const r = FakeRecognition.last;
    expect(r).toMatchObject({ lang: "en-GB", continuous: false, interimResults: true, maxAlternatives: 1, started: 1 });
  });

  it("shows interim text, then delivers the final sentence once, before end", () => {
    const h = handlers();
    input().start(h, { language: "en-US" });
    const r = FakeRecognition.last;
    r.hear([["call my", false]]);
    r.hear([["call my daughter", true]]);
    r.onend?.();
    r.onend?.(); // duplicate end from the browser
    expect(h.calls).toEqual(["interim:call my", "interim:call my daughter", "final:call my daughter", "end"]);
  });

  it("stop() delivers what was heard so far", () => {
    const h = handlers();
    const s = input().start(h, { language: "en-US" });
    FakeRecognition.last.hear([["what time", false]]);
    s.stop();
    expect(FakeRecognition.last.stopped).toBe(1);
    FakeRecognition.last.onend?.();
    expect(h.calls.slice(-2)).toEqual(["final:what time", "end"]);
  });

  it("stop() still ends if the browser never sends end", () => {
    const h = handlers();
    const s = input().start(h, { language: "en-US" });
    FakeRecognition.last.hear([["hello", false]]);
    s.stop();
    vi.advanceTimersByTime(1_600);
    expect(h.calls.slice(-2)).toEqual(["final:hello", "end"]);
  });

  it("abort() throws the words away but still ends exactly once", () => {
    const h = handlers();
    const s = input().start(h, { language: "en-US" });
    FakeRecognition.last.hear([["call", false]]);
    s.abort();
    FakeRecognition.last.onerror?.({ error: "aborted" });
    FakeRecognition.last.onend?.();
    expect(h.calls).toEqual(["interim:call", "end"]);
  });

  it.each([
    ["not-allowed", "permission-denied"],
    ["service-not-allowed", "permission-denied"],
    ["audio-capture", "no-microphone"],
    ["network", "network"],
    ["no-speech", "no-speech"],
    ["language-not-supported", "unknown"],
  ])("maps browser error %s to %s, then ends", (browser, code) => {
    const h = handlers();
    input().start(h, { language: "en-US" });
    FakeRecognition.last.onerror?.({ error: browser });
    FakeRecognition.last.onend?.();
    expect(h.calls).toEqual([`error:${code}`, "end"]);
  });

  it("times out with no-speech when nothing is heard", () => {
    const h = handlers();
    input({ noSpeechMs: 5_000 }).start(h, { language: "en-US" });
    vi.advanceTimersByTime(5_000);
    expect(FakeRecognition.last.aborted).toBe(1);
    vi.advanceTimersByTime(600);
    expect(h.calls).toEqual(["error:no-speech", "end"]);
  });

  it("stops by itself after a pause once something was said", () => {
    const h = handlers();
    input({ endSilenceMs: 2_000 }).start(h, { language: "en-US" });
    FakeRecognition.last.hear([["open my photos", false]]);
    vi.advanceTimersByTime(2_000);
    expect(FakeRecognition.last.stopped).toBe(1);
  });

  it("never listens longer than the cap", () => {
    input({ maxMs: 10_000, noSpeechMs: 60_000, endSilenceMs: 60_000 }).start(handlers(), { language: "en-US" });
    vi.advanceTimersByTime(10_000);
    expect(FakeRecognition.last.stopped).toBe(1);
  });

  it("can listen again after finishing", () => {
    const svc = input();
    for (const word of ["yes", "no"]) {
      const h = handlers();
      svc.start(h, { language: "en-US" });
      FakeRecognition.last.hear([[word, true]]);
      FakeRecognition.last.onend?.();
      expect(h.calls.slice(-2)).toEqual([`final:${word}`, "end"]);
    }
  });

  it("reports a start failure through onError and onEnd", () => {
    class Broken extends FakeRecognition {
      start() {
        throw new Error("InvalidStateError");
      }
    }
    const h = handlers();
    createWebSpeechInput({ getRecognition: () => Broken, levelMeter: false }).start(h, { language: "en-US" });
    vi.advanceTimersByTime(1);
    expect(h.calls).toEqual(["error:unknown", "end"]);
  });
});

// ---------- fake synthesis ----------

interface FakeUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  volume: number;
  pitch: number;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function voice(name: string, lang: string, extra: Partial<SpeechSynthesisVoice> = {}): SpeechSynthesisVoice {
  return { name, lang, voiceURI: `uri:${name}`, default: false, localService: true, ...extra } as SpeechSynthesisVoice;
}

function fakeSynth(voices: SpeechSynthesisVoice[] = [voice("Anna", "en-US", { default: true }), voice("Brian", "en-GB")]) {
  const spoken: FakeUtterance[] = [];
  const synth: SynthesisLike & { cancelled: number } = {
    cancelled: 0,
    speak: (u) => spoken.push(u as unknown as FakeUtterance),
    cancel() {
      this.cancelled++;
    },
    getVoices: () => voices,
  };
  const svc = createWebSpeechOutput({
    getSynth: () => synth,
    createUtterance: (text) => ({ text, lang: "", voice: null, rate: 1, volume: 1, pitch: 1, onend: null, onerror: null }) as unknown as SpeechSynthesisUtterance,
  });
  return { svc, synth, spoken };
}

const OPTS = { rate: 0.9, volume: 0.8, voiceId: null, language: "en-US" };

describe("web speech output", () => {
  it("speaks with the person's speed, volume and a matching voice, and resolves when done", async () => {
    const { svc, spoken } = fakeSynth();
    const p = svc.speak("Hello there.", OPTS);
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]).toMatchObject({ text: "Hello there.", rate: 0.9, volume: 0.8, lang: "en-US" });
    expect(spoken[0].voice?.name).toBe("Anna");
    spoken[0].onend?.();
    await expect(p).resolves.toBeUndefined();
  });

  it("uses the chosen voice", async () => {
    const { svc, spoken } = fakeSynth();
    const p = svc.speak("Hi", { ...OPTS, voiceId: "uri:Brian" });
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0].voice?.name).toBe("Brian");
    spoken[0].onend?.();
    await p;
  });

  it("speaks long text in pieces, in order", async () => {
    const { svc, spoken } = fakeSynth();
    const long = Array.from({ length: 6 }, (_, i) => `This is sentence number ${i + 1} and it has a few words in it.`).join(" ");
    const p = svc.speak(long, OPTS);
    for (let i = 0; ; i++) {
      await vi.waitFor(() => expect(spoken.length).toBeGreaterThan(i));
      spoken[i].onend?.();
      if (spoken.length > 1 && i === spoken.length - 1) {
        await Promise.resolve();
        if (spoken.length === i + 1) break;
      }
    }
    await p;
    expect(spoken.length).toBeGreaterThan(1);
    expect(spoken.map((u) => u.text).join(" ")).toBe(long);
  });

  it("cancel() stops speaking and resolves the pending speak", async () => {
    const { svc, synth, spoken } = fakeSynth();
    const p = svc.speak("One. Two.", OPTS);
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    svc.cancel();
    await expect(p).resolves.toBeUndefined();
    expect(synth.cancelled).toBeGreaterThan(0);
    expect(spoken).toHaveLength(1);
  });

  it("cancel() is safe when nothing is playing", () => {
    expect(() => fakeSynth().svc.cancel()).not.toThrow();
  });

  it("rejects on a real speech error but not on interruption", async () => {
    const { svc, spoken } = fakeSynth();
    const p = svc.speak("Hi", OPTS);
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    spoken[0].onerror?.({ error: "synthesis-failed" });
    await expect(p).rejects.toThrow("synthesis-failed");

    const q = svc.speak("Hi again", OPTS);
    await vi.waitFor(() => expect(spoken).toHaveLength(2));
    spoken[1].onerror?.({ error: "interrupted" });
    await expect(q).resolves.toBeUndefined();
  });

  it("lists voices for the person's language, without duplicates", async () => {
    const { svc } = fakeSynth([voice("Anna", "en-US"), voice("Brian", "en-GB"), voice("Hans", "de-DE"), voice("Anna", "en-US")]);
    const list = await svc.listVoices();
    expect(list.map((v) => v.label)).toEqual(["Anna", "Brian"]);
  });

  it("is unsupported without speech synthesis", () => {
    expect(createWebSpeechOutput({ getSynth: () => undefined }).isSupported()).toBe(false);
  });

  it("pickVoice prefers exact language, then default", () => {
    const vs = [voice("A", "en-GB"), voice("B", "en-US"), voice("C", "en-US", { default: true })];
    expect(pickVoice(vs, null, "en-US")?.name).toBe("C");
    expect(pickVoice(vs, null, "en-AU")?.name).toBe("C");
    expect(pickVoice([voice("D", "fr-FR"), voice("E", "en-GB")], null, "en-AU")?.name).toBe("E");
    expect(pickVoice(vs, "uri:A", "en-US")?.name).toBe("A");
  });
});

describe("speakable", () => {
  it("removes things that sound bad aloud", () => {
    expect(speakable('Here is **your** message: "Hi" 😀 see https://x.y/z & 50%')).toBe("Here is your message: Hi see a link and 50 percent");
  });

  it("splitForSpeech keeps short text whole and breaks long text at sentences", () => {
    expect(splitForSpeech("Hello. How are you?")).toEqual(["Hello. How are you?"]);
    const parts = splitForSpeech("a".repeat(150) + ". " + "b".repeat(150) + ".");
    expect(parts).toHaveLength(2);
  });
});
