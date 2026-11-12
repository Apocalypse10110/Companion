import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { cn } from "./cn";

export type MicPhase = "idle" | "listening" | "thinking" | "speaking";

const LABELS: Record<MicPhase, string> = {
  idle: "Tap to talk",
  listening: "Listening. Tap when done",
  thinking: "Thinking. Tap to cancel",
  speaking: "Speaking. Tap to stop",
};

export function micLabel(phase: MicPhase): string {
  return LABELS[phase];
}

export interface MicButtonProps {
  phase: MicPhase;
  onPress: () => void;
  /** 0 to 1 microphone loudness, if the voice service reports it. */
  level?: number;
  /** When true, no animated ring is drawn (the words still say what is happening). */
  reduceMotion?: boolean;
  disabled?: boolean;
}

/**
 * The centre of the whole app. One big button that does the obvious thing for
 * whatever is happening: start listening, finish, cancel, or stop speaking.
 * The visible words and the screen-reader name are identical on purpose.
 */
export function MicButton({ phase, onPress, level = 0, reduceMotion, disabled }: MicButtonProps) {
  const label = micLabel(phase);
  const Icon = phase === "listening" ? Square : phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : Mic;
  const scale = phase === "listening" && !reduceMotion ? 1 + Math.min(1, Math.max(0, level)) * 0.08 : 1;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid place-items-center">
        {phase === "listening" && (
          <>
            <span aria-hidden="true" className="anim-ring absolute inset-0 rounded-full bg-accent" />
            <span aria-hidden="true" className="anim-ring absolute inset-0 rounded-full bg-accent [animation-delay:0.9s]" />
          </>
        )}
        <button
          type="button"
          onClick={onPress}
          disabled={disabled}
          aria-label={label}
          data-phase={phase}
          style={{ transform: `scale(${scale})` }}
          className={cn(
            "relative grid size-[min(10rem,46vw)] place-items-center rounded-full bg-accent text-on-accent shadow-soft transition-transform",
            "outline-offset-8 active:scale-95 disabled:opacity-60",
            "ring-8 ring-accent-soft",
            phase === "listening" && "ring-primary",
          )}
        >
          <Icon
            aria-hidden="true"
            strokeWidth={2.25}
            className={cn("size-[42%]", phase === "thinking" && "animate-spin")}
          />
        </button>
      </div>
      <p className="text-center text-xl font-bold text-ink" aria-hidden="true">
        {label}
      </p>
    </div>
  );
}
