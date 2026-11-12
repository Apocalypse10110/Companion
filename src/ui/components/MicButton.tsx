import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type MicPhase = "idle" | "listening" | "thinking" | "speaking";

/** What is happening, then what a tap will do. Shown on two lines, spoken as one sentence. */
const PARTS: Record<MicPhase, [string, string | null]> = {
  idle: ["Tap to talk", null],
  listening: ["Listening", "Tap when done"],
  thinking: ["Thinking", "Tap to cancel"],
  speaking: ["Speaking", "Tap to stop"],
};

export function micLabel(phase: MicPhase): string {
  const [what, next] = PARTS[phase];
  return next ? `${what}. ${next}` : what;
}

export interface MicButtonProps {
  phase: MicPhase;
  onPress: () => void;
  /** 0 to 1 microphone loudness, if the voice service reports it. */
  level?: number;
  /** When true, no animated ring is drawn (the words still say what is happening). */
  reduceMotion?: boolean;
  disabled?: boolean;
  /** Kept for compatibility. The button now has one size and one place in every state. */
  compact?: boolean;
  /** Shown under the words when idle (for example "Type instead"). */
  children?: ReactNode;
}

/**
 * The centre of the whole app. One big button that does the obvious thing for
 * whatever is happening: start listening, finish, cancel, or stop speaking.
 * The visible words and the screen-reader name are identical on purpose.
 *
 * It never moves or changes size: the words beside it sit in fixed slots, so the
 * row is the same height in every state.
 */
export function MicButton({ phase, onPress, level = 0, reduceMotion, disabled, children }: MicButtonProps) {
  const label = micLabel(phase);
  const [what, next] = PARTS[phase];
  const Icon = phase === "listening" ? Square : phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : Mic;
  // Loudness is shown by a halo BEHIND the button. The button itself never moves,
  // because a moving target is hard to hit with a shaky hand.
  const halo = phase === "listening" && !reduceMotion ? 1 + Math.min(1, Math.max(0, level)) * 0.22 : 1;

  return (
    <div className="flex flex-row items-center gap-5">
      <div className="relative grid shrink-0 place-items-center">
        {phase === "listening" && !reduceMotion && (
          <span
            aria-hidden="true"
            data-testid="mic-halo"
            style={{ transform: `scale(${halo})` }}
            className="absolute inset-0 rounded-full bg-accent/35 transition-transform duration-100"
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
            "relative grid size-[min(6.5rem,30vw)] place-items-center rounded-full bg-accent text-on-accent",
            "shadow-[0_1px_2px_rgb(0_0_0/0.2),0_10px_24px_-10px_var(--c-accent)]",
            "outline-offset-8 transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60",
            "ring-[0.375rem] ring-accent-soft",
            phase === "listening" && "ring-ink",
          )}
        >
          <Icon
            aria-hidden="true"
            strokeWidth={2.25}
            className={cn("size-[42%]", phase === "listening" && "fill-current", phase === "thinking" && "animate-spin")}
          />
        </button>
      </div>
      {/* Tall enough for the longest state (a two-line title plus one control), so the row,
          and the button centred in it, stay put whatever the words say. */}
      <div
        className="flex min-h-[calc(3.3rem+var(--target))] min-w-0 flex-1 flex-col items-start justify-center"
        aria-hidden={next ? "true" : undefined}
      >
        <p className="display text-2xl text-ink" aria-hidden="true">
          {what}
        </p>
        {/* One fixed-height slot: either what a tap does next, or the idle extras. */}
        <div className="flex min-h-[var(--target)] items-center">
          {next ? <p className="text-lg font-bold text-muted">{next}</p> : children}
        </div>
      </div>
    </div>
  );
}
