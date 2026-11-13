"use client";

import { Camera, CircleCheck, CircleX, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { cameraSupported } from "@/phone/camera";
import { Button } from "../components/Button";
import { CameraSheet } from "./CameraSheet";

export const CHECK_REPLIES = { done: "I've done it", again: "Show me again", failed: "That didn't work" } as const;

export interface CheckStepProps {
  disabled?: boolean;
  onReply: (text: string) => void;
  /** A photo of their screen, to check the step was really done. */
  onCheckPhoto: (photo: Blob) => void;
}

/**
 * "Check my step": after an instruction, three plain answers, plus a photo check. Companion only
 * says a step worked when the person says so or the photo shows it.
 */
export function CheckStep({ disabled, onReply, onCheckPhoto }: CheckStepProps) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const openCamera = () => {
    if (cameraSupported() && window.isSecureContext) setOpen(true);
    else input.current?.click();
  };
  return (
    <section aria-label="How did that go?" className="flex flex-col gap-3" data-testid="check-step">
      <p className="text-lg font-bold text-ink">How did that go?</p>
      <div className="grid grid-cols-1 gap-3">
        <Button icon={CircleCheck} fullWidth disabled={disabled} onClick={() => onReply(CHECK_REPLIES.done)}>
          {CHECK_REPLIES.done}
        </Button>
        <Button variant="secondary" icon={RotateCcw} fullWidth disabled={disabled} onClick={() => onReply(CHECK_REPLIES.again)}>
          {CHECK_REPLIES.again}
        </Button>
        <Button variant="secondary" icon={CircleX} fullWidth disabled={disabled} onClick={() => onReply(CHECK_REPLIES.failed)}>
          {CHECK_REPLIES.failed}
        </Button>
        <Button variant="secondary" icon={Camera} fullWidth disabled={disabled} onClick={openCamera}>
          Check my screen with a photo
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onCheckPhoto(file);
        }}
      />
      {open && <CameraSheet open onClose={() => setOpen(false)} onPhoto={onCheckPhoto} onChooseFile={() => input.current?.click()} />}
    </section>
  );
}
