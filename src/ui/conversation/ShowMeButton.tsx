"use client";

import { Camera, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cameraSupported, captureScreenOnce, screenShareSupported } from "@/phone/camera";
import { Button } from "../components/Button";
import { CameraSheet } from "./CameraSheet";

export interface ShowMeButtonProps {
  onPhoto: (photo: Blob) => void;
  disabled?: boolean;
  /** Open the camera straight away (the "Show me" home-screen shortcut). */
  autoOpen?: boolean;
}

/**
 * "Show me": opens the live camera (back camera first) so the person can point at whatever is
 * confusing. Inside, "Choose a photo or screenshot" opens the phone's own picker, which needs no
 * permission (no `capture` attribute, so both Take Photo and Photo Library are offered).
 * On a computer, "Show my screen" takes one picture of a window the person chooses.
 */
export function ShowMeButton({ onPhoto, disabled, autoOpen }: ShowMeButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [screen, setScreen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setLive(cameraSupported() && window.isSecureContext);
    setScreen(screenShareSupported());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opened from the "Show me" shortcut
    if (autoOpen && live) setOpen(true);
  }, [autoOpen, live]);

  return (
    <>
      <Button
        variant="secondary"
        icon={Camera}
        fullWidth
        disabled={disabled}
        onClick={() => (live ? setOpen(true) : input.current?.click())}
      >
        Show me with a photo
      </Button>
      {screen && (
        <Button
          variant="secondary"
          icon={Monitor}
          fullWidth
          disabled={disabled}
          onClick={() => void captureScreenOnce().then((b) => b && onPhoto(b))}
        >
          Show my screen
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // so the same photo can be chosen again
          if (file) onPhoto(file);
        }}
      />
      {live && <CameraSheet open={open} onClose={() => setOpen(false)} onPhoto={onPhoto} onChooseFile={() => input.current?.click()} />}
    </>
  );
}
