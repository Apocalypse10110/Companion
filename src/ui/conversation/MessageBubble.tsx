"use client";

import { Volume2, VolumeX } from "lucide-react";
import type { PermissionName } from "@/contracts";
import { Banner } from "../components/Card";
import { Button } from "../components/Button";
import { cn } from "../components/cn";
import { ActionConfirmCard } from "./ActionConfirmCard";
import type { ChatMessage } from "./types";

export interface MessageBubbleProps {
  message: ChatMessage;
  speaking: boolean;
  canReadAloud: boolean;
  disabled: boolean;
  onReadAloud: () => void;
  onStopSpeaking: () => void;
  onSuggestion: (text: string) => void;
  onRunAction: (actionId: string) => void;
  onDeclineAction: (actionId: string) => void;
  onAllowPermission: (permission: PermissionName, actionId?: string) => void;
  onRetry: () => void;
  onDismiss: () => void;
}

/** One entry in the conversation. Always has a text label for who is speaking. */
export function MessageBubble(props: MessageBubbleProps) {
  const { message: m } = props;

  if (m.role === "error") {
    return (
      <li className="anim-rise">
        <Banner
          tone="error"
          title="I couldn't do that"
          urgent
          actions={
            <>
              {m.retry && <Button onClick={props.onRetry}>Try again</Button>}
              <Button variant="secondary" onClick={props.onDismiss}>
                OK
              </Button>
            </>
          }
        >
          {m.text}
        </Banner>
      </li>
    );
  }

  if (m.role === "notice") {
    return (
      <li className="anim-rise">
        <Banner
          tone="info"
          title="Good to know"
          actions={
            <>
              {m.permission && (
                <Button onClick={() => props.onAllowPermission(m.permission!)}>
                  {m.permission === "microphone" ? "Allow microphone" : "Allow"}
                </Button>
              )}
              <Button variant="secondary" onClick={props.onDismiss}>
                {m.permission ? "Not now" : "OK"}
              </Button>
            </>
          }
        >
          {m.text}
        </Banner>
      </li>
    );
  }

  if (m.role === "user") {
    return (
      <li className="anim-rise flex justify-end">
        <div className="bw max-w-[90%] rounded-3xl rounded-br-lg bg-primary-soft px-5 py-4">
          <p className="text-base font-bold text-muted">You</p>
          <p className="text-xl text-ink">{m.text}</p>
        </div>
      </li>
    );
  }

  const cards = m.actions ?? [];
  return (
    <li className="anim-rise flex justify-start">
      <div className={cn("bw flex w-full max-w-[96%] flex-col gap-4 rounded-3xl rounded-bl-lg bg-surface px-5 py-4 shadow-soft")}>
        <p className="text-base font-bold text-muted">Companion</p>
        <p className="text-xl text-ink">{m.text}</p>

        {cards.map((card) => (
          <ActionConfirmCard
            key={card.action.id}
            card={card}
            onConfirm={() => props.onRunAction(card.action.id)}
            onDecline={() => props.onDeclineAction(card.action.id)}
            onAllow={(p) => props.onAllowPermission(p, card.action.id)}
          />
        ))}

        {props.canReadAloud &&
          (props.speaking ? (
            <Button variant="secondary" icon={VolumeX} onClick={props.onStopSpeaking} fullWidth>
              Stop reading
            </Button>
          ) : (
            <Button variant="secondary" icon={Volume2} onClick={props.onReadAloud} fullWidth disabled={props.disabled}>
              Read to me
            </Button>
          ))}

        {m.suggestions && m.suggestions.length > 0 && (
          <div className="flex flex-col gap-3" role="group" aria-label="Suggestions">
            {m.suggestions.map((s) => (
              <Button key={s} variant="secondary" fullWidth disabled={props.disabled} onClick={() => props.onSuggestion(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
