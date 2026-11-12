"use client";

import { Hand } from "lucide-react";
import { useState } from "react";
import type { PointAt } from "@/contracts";
import { Button } from "../components/Button";

export interface TapHereProps {
  /** The photo the person sent, as a data: URL. */
  photo: string;
  pointAt: PointAt;
  disabled?: boolean;
  /** Called when a hidden ring is revealed, so it can be announced. */
  onReveal?: (label: string) => void;
}

/** Some room around the box, so the ring sits around the button rather than on its edge. */
const PAD = 25;

export function ringStyle(box: PointAt["box"]): { top: string; left: string; width: string; height: string } {
  const [ymin, xmin, ymax, xmax] = box;
  const top = Math.max(0, ymin - PAD);
  const left = Math.max(0, xmin - PAD);
  const bottom = Math.min(1000, ymax + PAD);
  const right = Math.min(1000, xmax + PAD);
  return {
    top: `${top / 10}%`,
    left: `${left / 10}%`,
    width: `${(right - left) / 10}%`,
    height: `${(bottom - top) / 10}%`,
  };
}

/**
 * "Tap here": the person's own photo with a thick ring around the thing to press.
 * When they've done the task before, the ring starts hidden and they try first ("Show me where").
 */
export function TapHere({ photo, pointAt, disabled, onReveal }: TapHereProps) {
  const [shown, setShown] = useState(!pointAt.hidden);
  const style = ringStyle(pointAt.box);

  return (
    <figure className="flex flex-col gap-3">
      <div className="relative w-full overflow-hidden rounded-2xl bw">
        {/* eslint-disable-next-line @next/next/no-img-element -- the person's own photo, held in memory */}
        <img
          src={photo}
          alt={shown ? `Your photo. A ring marks where to tap: ${pointAt.label}.` : "Your photo."}
          className="block h-auto w-full"
        />
        {shown && (
          <div aria-hidden="true" className="pointer-events-none absolute" style={style} data-testid="tap-here-ring">
            {/* Two rings: dark outside, bright inside, so it shows up on light and dark screens alike. */}
            <div className="absolute inset-0 rounded-[40%] border-[6px] border-black/80" />
            <div className="absolute inset-[3px] rounded-[40%] border-[5px] border-[#FFD400]" />
            <div className="anim-ring absolute inset-0 rounded-[40%] border-4 border-[#FFD400]" />
          </div>
        )}
      </div>
      {shown ? (
        <figcaption className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Hand aria-hidden="true" className="size-6 shrink-0" />
          <span>Tap here: {pointAt.label}</span>
        </figcaption>
      ) : (
        <Button
          variant="secondary"
          icon={Hand}
          fullWidth
          disabled={disabled}
          onClick={() => {
            setShown(true);
            onReveal?.(pointAt.label);
          }}
        >
          Show me where
        </Button>
      )}
    </figure>
  );
}
