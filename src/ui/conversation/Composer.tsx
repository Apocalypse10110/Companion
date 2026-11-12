"use client";

import { Mic, SendHorizontal } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "../components/Button";

export interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  /** Shown when talking is possible: a way back to the microphone. */
  onUseMicrophone?: () => void;
}

/** Type instead of talk. A real visible label, a big field and a clearly labelled Send button. */
export function Composer({ onSend, disabled, onUseMicrophone }: ComposerProps) {
  const [text, setText] = useState("");
  const [nudge, setNudge] = useState(false);
  const id = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (disabled) return;
    // An empty Send is not an error: say gently what to do instead of greying the button out.
    if (!clean) {
      setNudge(true);
      return;
    }
    setNudge(false);
    onSend(clean);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Type a message">
      <label htmlFor={id} className="text-lg font-bold text-ink">
        Type your message
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (nudge) setNudge(false);
        }}
        aria-describedby={nudge ? `${id}-nudge` : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        rows={2}
        enterKeyHint="send"
        autoComplete="off"
        placeholder="For example: Call my daughter"
        className="bwc min-h-[calc(var(--target)*1.5)] w-full resize-none rounded-2xl bg-surface px-4 py-3 text-xl text-ink placeholder:text-muted"
      />
      {nudge && (
        <p id={`${id}-nudge`} role="status" className="text-lg text-ink">
          Type what you need first, then tap Send.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button type="submit" icon={SendHorizontal} fullWidth disabled={disabled}>
          Send
        </Button>
        {onUseMicrophone && (
          <Button variant="secondary" icon={Mic} fullWidth onClick={onUseMicrophone}>
            Talk instead
          </Button>
        )}
      </div>
    </form>
  );
}
