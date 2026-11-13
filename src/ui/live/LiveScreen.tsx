"use client";

import { Camera, Captions, CaptionsOff, Mic, PhoneOff, RotateCcw, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_PROBLEMS, CameraError, openCamera, stopCamera } from "@/phone/camera";
import { LiveHelpSession, liveSupported, type Caption, type LiveProblem, type LiveStatus } from "@/live/session";
import { useAnnounce } from "../a11y/LiveAnnouncer";
import { Banner } from "../components/Card";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { ScrollPage } from "../components/ScrollPage";
import { cn } from "../components/cn";
import { useSettings } from "../settings/SettingsProvider";

export const FALLBACK_TITLE = "Live Help isn't available right now. Let's use Show Me instead.";

export const LIVE_PROBLEMS: Record<LiveProblem, string> = {
  "not-configured": "Live Help hasn't been switched on for this app yet.",
  "mic-denied":
    "The microphone is turned off for Companion. You can allow it in your browser's settings for this site, or use Show Me with a photo.",
  unsupported: "This browser can't do live video and voice together.",
  busy: "Live Help is busy right now. Please try again in a minute.",
  network: "The connection was lost.",
  timeout: "Live Help didn't answer in time.",
  unknown: "Something went wrong starting Live Help.",
};

const STATUS_WORDS: Record<LiveStatus, string> = {
  idle: "Ready",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  ended: "Ended",
  failed: "Not connected",
};

/**
 * Live Help: point the camera, talk naturally, and Companion answers out loud while it watches.
 * The camera and microphone are on only while this screen is open and a session is running.
 * If anything fails, Show Me is one tap away, with what the person already said.
 */
export function LiveScreen() {
  const router = useRouter();
  const announce = useAnnounce();
  const { motionReduced } = useSettings();
  const video = useRef<HTMLVideoElement>(null);
  const camera = useRef<MediaStream | null>(null);
  const session = useRef<LiveHelpSession | null>(null);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [showCaptions, setShowCaptions] = useState(true);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const question = useRef("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setSupported(liveSupported());
  }, []);

  const stopAll = useCallback(() => {
    session.current?.end();
    session.current = null;
    stopCamera(camera.current);
    camera.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  // Leaving the screen always turns the camera and microphone off.
  useEffect(() => stopAll, [stopAll]);

  // The person switched away from the app: end the session rather than keep listening.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && session.current) {
        stopAll();
        setStatus("ended");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stopAll]);

  const start = async () => {
    setProblem(null);
    setCaptions([]);
    question.current = "";
    setStatus("connecting");
    announce("Starting Live Help.");
    try {
      camera.current = await openCamera("environment");
      if (video.current) {
        video.current.srcObject = camera.current;
        await video.current.play().catch(() => {});
      }
    } catch (err) {
      setStatus("failed");
      setProblem(err instanceof CameraError ? CAMERA_PROBLEMS[err.code] : CAMERA_PROBLEMS.unknown);
      return;
    }
    const s = new LiveHelpSession(
      {
        onStatus: (st, p) => {
          setStatus(st);
          if (st === "live") announce("Live Help is on. I can see and hear you. Tell me what you need.");
          if (st === "failed") {
            setProblem(p ? LIVE_PROBLEMS[p] : LIVE_PROBLEMS.unknown);
            announce(FALLBACK_TITLE);
            stopCamera(camera.current);
            camera.current = null;
          }
        },
        onCaption: (c) => {
          if (c.who === "you" && c.final) question.current = c.text;
          setCaptions((list) => {
            const last = list[list.length - 1];
            const next = last && !last.final && last.who === c.who ? [...list.slice(0, -1), c] : [...list, c];
            return next.slice(-6);
          });
        },
        onLevel: setLevel,
        onSpeaking: setSpeaking,
      },
      () => video.current,
    );
    session.current = s;
    await s.start();
  };

  const end = () => {
    if (session.current) question.current ||= session.current.lastQuestion();
    stopAll();
    setStatus("ended");
    announce("Live Help ended. The camera and microphone are off.");
  };

  const useShowMe = () => {
    const q = question.current.trim();
    stopAll();
    router.push(`/?showme=1${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  };

  const running = status === "connecting" || status === "live" || status === "reconnecting";

  return (
    <ScrollPage>
      <PageHeader title="Live Help" backHref="/" backLabel="Home" />

      {!running && status !== "failed" && (
        <div className="flex flex-col gap-3">
          <p className="text-xl text-ink">
            Point your camera at what&apos;s confusing, like your router or a screen, and talk to me. I&apos;ll see it and answer out
            loud. You can interrupt me any time.
          </p>
          <p className="text-lg text-muted">The camera and microphone are on only while Live Help is running. Nothing is recorded or saved.</p>
          {!supported && <Banner tone="warning">This browser can&apos;t do Live Help. Show Me works instead.</Banner>}
          {status === "ended" && <p role="status" className="text-lg font-bold text-ink">Live Help ended. The camera and microphone are off.</p>}
          <Button icon={Video} fullWidth onClick={() => void start()} disabled={!supported}>
            {status === "ended" ? "Start again" : "Start Live Help"}
          </Button>
          <Button variant="secondary" icon={Camera} fullWidth onClick={useShowMe}>
            Use Show Me with a photo instead
          </Button>
        </div>
      )}

      {status === "failed" && (
        <Banner
          tone="warning"
          title={FALLBACK_TITLE}
          urgent
          actions={
            <>
              <Button icon={Camera} onClick={useShowMe}>
                Use Show Me
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={() => void start()}>
                Try Live Help again
              </Button>
            </>
          }
        >
          {problem ?? ""}
        </Banner>
      )}

      {/* The preview is always in the page (so it can start fast), shown only while running. */}
      <div className={cn("relative overflow-hidden rounded-3xl bg-black bw", !running && "hidden")}>
        <video ref={video} playsInline muted autoPlay className="block aspect-[3/4] w-full object-cover" aria-label="What your camera sees" />
        <p
          role="status"
          className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/75 px-3 py-1 text-base font-bold text-white"
          data-testid="live-status"
        >
          <span aria-hidden="true" className={cn("size-3 rounded-full", status === "live" ? "bg-[#3ddc84]" : "bg-[#FFD400]")} />
          {STATUS_WORDS[status]}
        </p>
        {showCaptions && captions.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 flex max-h-[45%] flex-col gap-1 overflow-y-auto bg-black/75 px-3 py-2" aria-live="off">
            {captions.map((c, i) => (
              <p key={i} className={cn("text-lg text-white", c.who === "companion" && "font-bold text-[#FFD400]")}>
                {c.who === "you" ? "You: " : "Companion: "}
                {c.text}
              </p>
            ))}
          </div>
        )}
      </div>

      {running && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-lg font-bold text-ink">
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              {!motionReduced && (
                <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent/40" style={{ transform: `scale(${1 + Math.min(level * 3, 0.6)})` }} />
              )}
              <Mic aria-hidden="true" className="relative size-6" />
            </span>
            <span>{speaking ? "Companion is talking. Just speak to interrupt." : status === "live" ? "I'm listening." : "Getting ready…"}</span>
          </div>
          <Button variant="danger" icon={PhoneOff} fullWidth onClick={end}>
            End Live Help
          </Button>
          <Button variant="secondary" icon={showCaptions ? CaptionsOff : Captions} fullWidth onClick={() => setShowCaptions((v) => !v)}>
            {showCaptions ? "Hide captions" : "Show captions"}
          </Button>
        </div>
      )}
    </ScrollPage>
  );
}
