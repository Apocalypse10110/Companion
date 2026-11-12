import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
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
  /** Smaller button with the words beside it, to leave room for the conversation. */
  compact?: boolean;
  /** Extra controls shown under the words (compact layout only). */
  children?: ReactNode;
}

/**
 * The centre of the whole app. One big button that does the obvious thing for
 * whatever is happening: start listening, finish, cancel, or stop speaking.
 * The visible words and the screen-reader name are identical on purpose.
 */
export function MicButton({ phase, onPress, level = 0, reduceMotion, disabled, compact, children }: MicButtonProps) {
  const label = micLabel(phase);
  const Icon = phase === "listening" ? Square : phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : Mic;
  // Loudness is shown by a halo BEHIND the button. The button itself never moves,
  // because a moving target is hard to hit with a shaky hand.
  const halo = phase === "listening" && !reduceMotion ? 1 + Math.min(1, Math.max(0, level)) * 0.22 : 1;

  return (
    <div className={cn("flex gap-4", compact ? "flex-row items-center" : "flex-col items-center gap-3")}>
      <div className="relative grid shrink-0 place-items-center">
        {phase === "listening" && !reduceMotion && (
          <span
            aria-hidden="true"
            data-testid="mic-halo"
            style={{ transform: `scale(${halo})` }}
            className="absolute inset-0 rounded-full bg-accent/30 transition-transform duration-100"
          />
        )}
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
          className={cn(
            "relative grid place-items-center rounded-full bg-accent text-on-accent shadow-soft",
            compact ? "size-[min(6rem,28vw)]" : "size-[min(7.5rem,36vw)]",
            "outline-offset-8 disabled:opacity-60",
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
      {compact ? (
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <p className="text-xl font-bold text-ink" aria-hidden="true">
            {label}
          </p>
          {children}
        </div>
      ) : (
        <>
          <p className="text-center text-xl font-bold text-ink" aria-hidden="true">
            {label}
          </p>
          {children}
        </>
      )}
    </div>
  );
}
