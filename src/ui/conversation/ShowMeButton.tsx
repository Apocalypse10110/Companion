"use client";

import { Camera } from "lucide-react";
import { useRef } from "react";
import { Button } from "../components/Button";

export interface ShowMeButtonProps {
  onPhoto: (file: File) => void;
  disabled?: boolean;
}

/**
 * "Show me": take a photo of whatever is confusing (a pop-up, a letter, the router) or pick a
 * screenshot. No `capture` attribute on purpose: both iPhone and Android then offer
 * "Take Photo" AND "Photo Library", so a screenshot of the phone itself can be chosen.
 * A file picker needs no camera permission.
 */
export function ShowMeButton({ onPhoto, disabled }: ShowMeButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="secondary" icon={Camera} fullWidth disabled={disabled} onClick={() => input.current?.click()}>
        Show me with a photo
      </Button>
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
    </>
  );
}
