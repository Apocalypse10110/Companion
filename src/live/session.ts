/**
 * Live Help: a real-time spoken conversation with Gemini Live while it sees the camera.
 *
 *   our server  -> a short-lived, single-use token (the real key never reaches the phone)
 *   microphone  -> 16 kHz PCM (AudioWorklet)            -> Gemini Live
 *   camera      -> about one JPEG a second (768 px max) -> Gemini Live
 *   Gemini Live -> 24 kHz PCM speech, played in order; captions from transcriptions
 *
 * When the person starts talking while Companion speaks, Gemini sends "interrupted" and playback
 * stops at once. Everything (microphone, camera frames, audio, socket) is released by `end()`.
 * Any failure ends in status "failed" with a reason, so the screen can offer Show Me instead.
 */

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { base64ToBytes, bytesToBase64, fitWithin, pcm16ToFloat, rateOf } from "./pcm";

export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "ended" | "failed";

/** Why Live Help couldn't start or stopped. Each has plain words on the screen. */
export type LiveProblem = "not-configured" | "mic-denied" | "unsupported" | "busy" | "network" | "timeout" | "unknown";

export interface Caption {
  who: "you" | "companion";
  text: string;
  final: boolean;
}

export interface LiveCallbacks {
  onStatus: (status: LiveStatus, problem?: LiveProblem) => void;
  onCaption: (caption: Caption) => void;
  /** Microphone loudness 0..1, for the indicator. */
  onLevel?: (level: number) => void;
  /** Companion started or stopped speaking. */
  onSpeaking?: (speaking: boolean) => void;
}

export interface TokenResponse {
  token: string;
  model: string;
  expiresAt: string;
  hasFallback: boolean;
}

const SETUP_TIMEOUT_MS = 12_000;
const FRAME_EVERY_MS = 1_000;
const FRAME_MAX_PX = 768;

export async function fetchLiveToken(attempt: number, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetchImpl("/api/live/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new LiveError("network");
  }
  if (res.status === 503) throw new LiveError("not-configured");
  if (res.status === 429) throw new LiveError("busy");
  if (!res.ok) throw new LiveError("unknown");
  const data = (await res.json().catch(() => null)) as Partial<TokenResponse> | null;
  if (!data?.token?.startsWith("auth_tokens/") || !data.model) throw new LiveError("unknown");
  return { token: data.token, model: data.model, expiresAt: data.expiresAt ?? "", hasFallback: Boolean(data.hasFallback) };
}

export class LiveError extends Error {
  constructor(readonly problem: LiveProblem) {
    super(problem);
    this.name = "LiveError";
  }
}

export function liveSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof AudioContext !== "undefined" &&
    typeof AudioWorkletNode !== "undefined" &&
    typeof WebSocket !== "undefined"
  );
}

export class LiveHelpSession {
  private session: Session | null = null;
  private micStream: MediaStream | null = null;
  private micContext: AudioContext | null = null;
  private micNode: AudioWorkletNode | null = null;
  private playContext: AudioContext | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private playHead = 0;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private status: LiveStatus = "idle";
  private ended = false;
  private reconnected = false;
  private youText = "";
  private companionText = "";
  /** Changes on every connection, so late events from an old socket are ignored. */
  private generation = 0;

  constructor(
    private readonly cb: LiveCallbacks,
    private readonly video: () => HTMLVideoElement | null,
  ) {}

  private set(status: LiveStatus, problem?: LiveProblem) {
    if (this.status === status && !problem) return;
    this.status = status;
    this.cb.onStatus(status, problem);
  }

  /** Start: microphone first (it needs the tap that started this), then the connection. */
  async start(): Promise<void> {
    if (!liveSupported()) return this.fail("unsupported");
    this.ended = false;
    this.set("connecting");
    try {
      await this.startMicrophone();
    } catch (err) {
      return this.fail(err instanceof LiveError ? err.problem : "unknown");
    }
    await this.connect(0);
  }

  private async connect(attempt: number): Promise<void> {
    const gen = ++this.generation;
    let token: TokenResponse;
    try {
      token = await fetchLiveToken(attempt);
    } catch (err) {
      return this.fail(err instanceof LiveError ? err.problem : "unknown");
    }
    if (this.ended || gen !== this.generation) return;

    const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1alpha" } });
    let ready = false;
    let resolveReady: (ok: boolean) => void = () => {};
    const readyPromise = new Promise<boolean>((r) => (resolveReady = r));
    const timer = setTimeout(() => resolveReady(false), SETUP_TIMEOUT_MS);

    try {
      this.session = await ai.live.connect({
        model: token.model,
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {} },
        callbacks: {
          onmessage: (m: LiveServerMessage) => {
            if (gen !== this.generation) return;
            if (m.setupComplete && !ready) {
              ready = true;
              resolveReady(true);
            }
            this.onMessage(m);
          },
          onerror: () => {
            if (gen === this.generation && !ready) resolveReady(false);
          },
          onclose: () => {
            if (gen !== this.generation) return;
            if (!ready) resolveReady(false);
            else void this.onDropped();
          },
        },
      });
    } catch {
      resolveReady(false);
    }
    const ok = await readyPromise;
    clearTimeout(timer);
    if (this.ended || gen !== this.generation) return;
    if (!ok) {
      this.closeSocket();
      // This Live model isn't answering: try the next one, if there is one.
      if (token.hasFallback) return this.connect(attempt + 1);
      return this.fail("timeout");
    }
    this.set("live");
    this.startFrames();
  }

  /** The connection dropped mid-session: try once to reconnect, then give up kindly. */
  private async onDropped(): Promise<void> {
    if (this.ended) return;
    this.stopFrames();
    this.stopPlayback();
    if (this.reconnected) return this.fail("network");
    this.reconnected = true;
    this.set("reconnecting");
    await this.connect(0);
  }

  private onMessage(m: LiveServerMessage): void {
    const content = m.serverContent;
    if (m.goAway) {
      // The server will close soon (session time limit); a reconnect follows the close.
      this.reconnected = false;
    }
    if (!content) return;
    if (content.interrupted) {
      // The person started talking: stop speaking at once.
      this.stopPlayback();
      this.finishCompanionCaption();
    }
    if (content.inputTranscription?.text) {
      this.youText += content.inputTranscription.text;
      this.cb.onCaption({ who: "you", text: this.youText.trim(), final: false });
    }
    if (content.outputTranscription?.text) {
      if (this.youText) this.finishYouCaption();
      this.companionText += content.outputTranscription.text;
      this.cb.onCaption({ who: "companion", text: this.companionText.trim(), final: false });
    }
    for (const part of content.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data && part.inlineData?.mimeType?.startsWith("audio/")) this.play(data, rateOf(part.inlineData.mimeType));
    }
    if (content.turnComplete) {
      this.finishYouCaption();
      this.finishCompanionCaption();
    }
  }

  private finishYouCaption() {
    if (!this.youText.trim()) return;
    this.cb.onCaption({ who: "you", text: this.youText.trim(), final: true });
    this.youText = "";
  }

  private finishCompanionCaption() {
    if (!this.companionText.trim()) return;
    this.cb.onCaption({ who: "companion", text: this.companionText.trim(), final: true });
    this.companionText = "";
  }

  // ---------- microphone ----------

  private async startMicrophone(): Promise<void> {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        video: false,
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      throw new LiveError(name === "NotAllowedError" || name === "SecurityError" ? "mic-denied" : name === "NotReadableError" ? "busy" : "unknown");
    }
    this.micContext = new AudioContext();
    await this.micContext.audioWorklet.addModule("/live-mic-worklet.js");
    const source = this.micContext.createMediaStreamSource(this.micStream);
    this.micNode = new AudioWorkletNode(this.micContext, "live-mic");
    this.micNode.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
      this.cb.onLevel?.(e.data.level);
      if (this.status !== "live" || !this.session) return;
      try {
        this.session.sendRealtimeInput({ audio: { data: bytesToBase64(new Uint8Array(e.data.pcm)), mimeType: "audio/pcm;rate=16000" } });
      } catch {
        /* the socket is closing; onclose handles it */
      }
    };
    source.connect(this.micNode);
    // Playback uses its own context at the output rate, created now while we still have the tap.
    this.playContext = new AudioContext({ sampleRate: 24000 });
  }

  // ---------- camera frames ----------

  private startFrames() {
    this.stopFrames();
    this.canvas ??= document.createElement("canvas");
    this.frameTimer = setInterval(() => this.sendFrame(), FRAME_EVERY_MS);
  }

  private sendFrame() {
    const v = this.video();
    if (!v || !this.session || this.status !== "live" || !v.videoWidth || document.hidden) return;
    const { width, height } = fitWithin(v.videoWidth, v.videoHeight, FRAME_MAX_PX);
    const canvas = this.canvas!;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(v, 0, 0, width, height);
    const data = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
    if (!data) return;
    try {
      this.session.sendRealtimeInput({ video: { data, mimeType: "image/jpeg" } });
    } catch {
      /* closing */
    }
  }

  private stopFrames() {
    if (this.frameTimer) clearInterval(this.frameTimer);
    this.frameTimer = null;
  }

  // ---------- speaking ----------

  private play(b64: string, rate: number) {
    const ctx = this.playContext;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const samples = pcm16ToFloat(base64ToBytes(b64));
    if (!samples.length) return;
    const buffer = ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    const at = Math.max(ctx.currentTime + 0.02, this.playHead);
    node.start(at);
    this.playHead = at + buffer.duration;
    this.playing.add(node);
    if (this.playing.size === 1) this.cb.onSpeaking?.(true);
    node.onended = () => {
      this.playing.delete(node);
      if (this.playing.size === 0) this.cb.onSpeaking?.(false);
    };
  }

  private stopPlayback() {
    for (const node of this.playing) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playing.clear();
    this.playHead = 0;
    this.cb.onSpeaking?.(false);
  }

  // ---------- ending ----------

  private closeSocket() {
    const s = this.session;
    this.session = null;
    try {
      s?.close();
    } catch {
      /* already closed */
    }
  }

  private fail(problem: LiveProblem) {
    this.release();
    this.set("failed", problem);
  }

  /** Release everything: microphone, audio, frames, socket. Safe to call more than once. */
  private release() {
    this.ended = true;
    this.generation++;
    this.stopFrames();
    this.stopPlayback();
    this.closeSocket();
    if (this.micNode) this.micNode.port.onmessage = null;
    this.micNode?.disconnect();
    this.micNode = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    void this.micContext?.close().catch(() => {});
    void this.playContext?.close().catch(() => {});
    this.micContext = null;
    this.playContext = null;
  }

  end(): void {
    if (this.status === "ended" || this.status === "failed") {
      this.release();
      return;
    }
    this.finishYouCaption();
    this.finishCompanionCaption();
    this.release();
    this.set("ended");
  }

  /** What was said so far, for Show Me if Live Help falls back. */
  lastQuestion(): string {
    return this.youText.trim();
  }
}
