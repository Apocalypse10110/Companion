"use client";

import { Loader2 } from "lucide-react";
import { Button } from "../components/Button";
import { MessageBubble } from "./MessageBubble";
import { useConversation } from "./ConversationProvider";

/** The running conversation: what was said, what came back, and what is happening now. */
export function Thread() {
  const c = useConversation();
  const busy = c.phase === "thinking";

  return (
    <ol aria-label="Conversation" aria-live="off" className="flex flex-col gap-4" data-testid="thread">
      {c.messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          speaking={c.speakingId === m.id}
          canReadAloud={c.voiceOutputSupported && m.role === "assistant"}
          disabled={busy}
          onReadAloud={() => c.readAloud(m.id)}
          onStopSpeaking={c.stopSpeaking}
          onSuggestion={c.sendText}
          onRunAction={(actionId) => c.runAction(m.id, actionId)}
          onDeclineAction={(actionId) => c.dismissAction(m.id, actionId)}
          onAllowPermission={(permission, actionId) => c.allowPermission(permission, m.id, actionId)}
          onRetry={() => c.retry(m.id)}
          onDismiss={() => c.dismissMessage(m.id)}
        />
      ))}

      {busy && (
        <li className="anim-rise flex justify-start">
          <div className="bw flex w-full max-w-[96%] flex-col gap-3 rounded-3xl rounded-bl-lg bg-surface px-5 py-4">
            <p className="text-base font-bold text-muted">Companion</p>
            {c.partial ? (
              <p className="text-xl text-ink">{c.partial}</p>
            ) : (
              <p className="flex items-center gap-3 text-xl font-bold text-ink">
                <Loader2 aria-hidden="true" className="size-6 animate-spin" />
                Thinking…
              </p>
            )}
            <Button variant="secondary" fullWidth onClick={c.cancel}>
              Cancel
            </Button>
          </div>
        </li>
      )}
    </ol>
  );
}
