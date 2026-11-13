"use client";

import { CircleCheck, CircleHelp, RotateCcw, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import type { PermissionName } from "@/contracts";
import type { Person } from "@/people/store";
import { Banner } from "../components/Card";
import { Button } from "../components/Button";
import { cn } from "../components/cn";
import { SaveLessonButton } from "../lessons/SaveLessonButton";
import { ScamVerdict } from "../safety/ScamVerdict";
import { ActionConfirmCard } from "./ActionConfirmCard";
import { CHECK_REPLIES, CheckStep } from "./CheckStep";
import { DocumentCard } from "./DocumentCard";
import { LessonBadge } from "./LessonBadge";
import { FamilyNote } from "./FamilyNote";
import { FamilyShareOffer } from "./FamilyShareOffer";
import { TapHere } from "./TapHere";
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
  /** Help Card: offer to send the family note to this person. */
  onSendFamilyNote?: (person: Person) => void;
  /** A hidden "tap here" ring was revealed. */
  onRevealTarget?: (label: string) => void;
  /** The newest reply: only it offers "How did that go?". */
  isLast?: boolean;
  /** "Check my step": a photo of their screen after doing the step. */
  onCheckPhoto?: (photo: Blob) => void;
  /** Fridge Card: offer to save a finished lesson as a printable card. */
  canSaveLesson?: boolean;
  /** Something to tell screen readers. */
  onAnnounce?: (text: string) => void;
}

const STEP_CHECK = {
  done: { icon: CircleCheck, text: "Step done", box: "bg-success-soft" },
  "not-yet": { icon: RotateCcw, text: "Not quite yet", box: "bg-accent-soft" },
  unsure: { icon: CircleHelp, text: "I couldn't tell from the photo", box: "bg-surface-2" },
} as const;

const CHECK_LOWER = Object.values(CHECK_REPLIES).map((s) => s.toLowerCase());

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
        <div className="flex max-w-[88%] flex-col gap-3 rounded-3xl rounded-br-md bg-accent-soft px-4 py-3">
          {/* Only our own small JPEG previews are shown. */}
          {m.image?.startsWith("data:image/jpeg;base64,") && (
            // eslint-disable-next-line @next/next/no-img-element -- a small local preview, not a remote image
            <img src={m.image} alt="The photo you sent" className="max-h-48 w-auto self-end rounded-2xl" />
          )}
          <p className="text-xl text-ink">
            <span className="sr-only">You said: </span>
            {m.text}
          </p>
        </div>
      </li>
    );
  }

  const cards = m.actions ?? [];
  // "How did that go?": the newest reply that is teaching a step, with nothing else waiting.
  const checking = Boolean(
    props.isLast && props.onCheckPhoto && m.lesson && m.lesson.stage !== "learned" && cards.length === 0 && !m.document && m.scam?.verdict !== "scam",
  );
  const suggestions = (m.suggestions ?? []).filter((s) => !checking || !CHECK_LOWER.includes(s.toLowerCase()));
  const check = m.stepCheck ? STEP_CHECK[m.stepCheck] : null;
  return (
    <li className="anim-rise flex flex-col gap-3">
      {/* The reply. Who is speaking is clear from the side and shape, and said in words to screen readers. */}
      <div className={cn("bw flex w-full max-w-[96%] flex-col gap-4 rounded-3xl rounded-tl-md bg-surface px-4 py-4")}>
        {m.lesson && <LessonBadge lesson={m.lesson} />}
        {check && (
          <p className={cn("flex items-center gap-2 self-start rounded-2xl px-3 py-2 text-lg font-bold text-ink", check.box)} data-step-check={m.stepCheck}>
            <check.icon aria-hidden="true" className="size-6 shrink-0" strokeWidth={2.25} />
            {check.text}
          </p>
        )}
        <p className="text-xl text-ink">
          <span className="sr-only">Companion said: </span>
          {m.text}
        </p>

        {m.photo && m.pointAt && (
          <TapHere
            photo={m.photo}
            pointAt={m.pointAt}
            disabled={props.disabled}
            onReveal={props.onRevealTarget}
            onCantSee={props.isLast ? () => props.onSuggestion("I can't see it. Can you tell me where it is in words?") : undefined}
          />
        )}

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

        {checking && (
          <CheckStep disabled={props.disabled} onReply={props.onSuggestion} onCheckPhoto={(b) => props.onCheckPhoto?.(b)} />
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-3" role="group" aria-label="Suggestions">
            {suggestions.map((s) => (
              <Button key={s} variant="secondary" fullWidth disabled={props.disabled} onClick={() => props.onSuggestion(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
      </div>

      {m.scam && <ScamVerdict check={m.scam} />}

      {m.document && <DocumentCard doc={m.document} disabled={props.disabled} onDone={props.onAnnounce} />}

      {m.lesson?.stage === "learned" && props.canSaveLesson && <SaveLessonButton skill={m.lesson.skill} disabled={props.disabled} />}

      {(m.scam?.verdict === "scam" || (!m.scam && /\bscam/i.test(m.text))) && (
        <Link href="/scam-bait" className="text-lg font-bold text-accent-ink underline underline-offset-4">
          Waste the scammer&apos;s time with Scam Bait
        </Link>
      )}

      {!m.familyNote && props.canSaveLesson && (m.scam?.verdict === "scam" || m.scam?.verdict === "suspicious" || m.lesson?.stage === "learned") && (
        <FamilyShareOffer messageId={m.id} disabled={props.disabled} />
      )}

      {m.familyNote && props.onSendFamilyNote && (
        <FamilyNote note={m.familyNote} photo={m.photo} disabled={props.disabled} onSend={props.onSendFamilyNote} />
      )}

      {/* Anything Companion wants to do stands on its own, full width, not tucked inside the reply. */}
      {cards.map((card) => (
        <ActionConfirmCard
          key={card.action.id}
          card={card}
          onConfirm={() => props.onRunAction(card.action.id)}
          onDecline={() => props.onDeclineAction(card.action.id)}
          onAllow={(p) => props.onAllowPermission(p, card.action.id)}
        />
      ))}
    </li>
  );
}
