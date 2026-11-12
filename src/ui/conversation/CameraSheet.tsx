"use client";

import { Camera, ImageUp, RefreshCw, RotateCcw, SwitchCamera, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CAMERA_PROBLEMS, CameraError, captureFrame, countCameras, openCamera, stopCamera, type Facing } from "@/phone/camera";
import { useAnnounce } from "../a11y/LiveAnnouncer";
import { Button } from "../components/Button";

export interface CameraSheetProps {
  open: boolean;
  onClose: () => void;
  /** The photo the person chose to send. */
  onPhoto: (photo: Blob) => void;
  /** Fall back to picking a photo or screenshot from the phone. */
  onChooseFile: () => void;
}

type View = { kind: "starting" } | { kind: "live" } | { kind: "paused" } | { kind: "taken"; blob: Blob; url: string } | { kind: "problem"; text: string };

/**
 * Full-screen live camera: point at what's confusing, take a photo, check it, then send it.
 * Nothing is captured or sent without a tap. The camera turns off as soon as it's not needed:
 * after taking the photo, when closed, or when the person leaves the app.
 */
export function CameraSheet({ open, onClose, onPhoto, onChooseFile }: CameraSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const titleId = useId();
  const announce = useAnnounce();
  const [view, setView] = useState<View>({ kind: "starting" });
  const [facing, setFacing] = useState<Facing>("environment");
  const [cameras, setCameras] = useState(1);

  const stop = useCallback(() => {
    stopCamera(stream.current);
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const start = useCallback(
    async (which: Facing) => {
      stop();
      setView({ kind: "starting" });
      try {
        const s = await openCamera(which);
        stream.current = s;
        // If the camera is taken away (a phone call, another app), say so instead of freezing.
        s.getVideoTracks().forEach((t) => t.addEventListener("ended", () => setView({ kind: "paused" })));
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setView({ kind: "live" });
        setCameras(await countCameras());
        announce("The camera is on. Point it at what you want help with, then tap Take photo.");
      } catch (err) {
        const text = CAMERA_PROBLEMS[err instanceof CameraError ? err.code : "unknown"];
        setView({ kind: "problem", text });
        announce(text, "assertive");
      }
    },
    [announce, stop],
  );

  // Open and close the dialog, and the camera with it.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal?.();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- turning the camera on when the sheet opens
      void start(facing);
    } else {
      stop();
      if (el.open) el.close?.();
    }
    // `facing` is read only when opening; switching is handled by switchCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Leaving the app (a call, the home button) turns the camera off; coming back offers to turn it on.
  useEffect(() => {
    if (!open) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && stream.current) {
        stop();
        setView((v) => (v.kind === "live" || v.kind === "starting" ? { kind: "paused" } : v));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [open, stop]);

  // Never leave the camera on if this goes away.
  useEffect(() => () => stop(), [stop]);

  // Free the preview image when it's no longer shown.
  useEffect(() => {
    if (view.kind !== "taken") return;
    return () => URL.revokeObjectURL(view.url);
  }, [view]);

  async function take() {
    if (!video.current) return;
    try {
      const blob = await captureFrame(video.current);
      stop();
      setView({ kind: "taken", blob, url: URL.createObjectURL(blob) });
      announce("Photo taken. Tap Use this photo, or Take it again.");
    } catch {
      setView({ kind: "problem", text: CAMERA_PROBLEMS.unknown });
    }
  }

  function switchCamera() {
    const next: Facing = facing === "environment" ? "user" : "environment";
    setFacing(next);
    void start(next);
  }

  function close() {
    stop();
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <h2 id={titleId} className="display text-2xl">
            {view.kind === "taken" ? "Is this clear?" : "Show me"}
          </h2>
          <button
            type="button"
            onClick={close}
            className="flex min-h-[var(--target)] items-center gap-2 rounded-full bg-white/15 px-4 text-lg font-bold"
          >
            <X aria-hidden="true" className="size-6" /> Close camera
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          {/* The live preview. Muted and inline so iPhones play it in the page. */}
          <video
            ref={video}
            playsInline
            muted
            autoPlay
            aria-label="What the camera sees"
            className={`h-full w-full object-contain ${view.kind === "live" ? "" : "hidden"} ${facing === "user" ? "-scale-x-100" : ""}`}
          />
          {view.kind === "taken" && (
            // eslint-disable-next-line @next/next/no-img-element -- a local preview of the photo just taken
            <img src={view.url} alt="The photo you just took" className="h-full w-full object-contain" />
          )}
          {view.kind === "starting" && <p className="absolute inset-0 grid place-items-center px-6 text-center text-xl">Turning the camera on…</p>}
          {view.kind === "paused" && (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-xl">The camera turned off while you were away.</p>
          )}
          {view.kind === "problem" && (
            <p role="alert" className="absolute inset-0 grid place-items-center overflow-y-auto px-6 text-center text-xl">
              {view.text}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {view.kind === "live" && (
            <>
              <Button variant="secondary" icon={Camera} fullWidth onClick={() => void take()}>
                Take photo
              </Button>
              {cameras > 1 && (
                <Button variant="secondary" icon={SwitchCamera} fullWidth onClick={switchCamera}>
                  {facing === "environment" ? "Use the front camera" : "Use the back camera"}
                </Button>
              )}
            </>
          )}
          {view.kind === "taken" && (
            <>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  onPhoto(view.blob);
                  onClose();
                }}
              >
                Use this photo
              </Button>
              <Button variant="secondary" icon={RotateCcw} fullWidth onClick={() => void start(facing)}>
                Take it again
              </Button>
            </>
          )}
          {(view.kind === "paused" || view.kind === "problem") && (
            <Button variant="secondary" icon={RefreshCw} fullWidth onClick={() => void start(facing)}>
              Turn the camera on
            </Button>
          )}
          <Button
            variant="secondary"
            icon={ImageUp}
            fullWidth
            onClick={() => {
              close();
              onChooseFile();
            }}
          >
            Choose a photo or screenshot
          </Button>
        </div>
      </div>
    </dialog>
  );
}
