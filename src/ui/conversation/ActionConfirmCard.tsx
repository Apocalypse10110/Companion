"use client";

import { CircleCheck, Loader2, ShieldCheck } from "lucide-react";
import type { PermissionName } from "@/contracts";
import { Button } from "../components/Button";
import type { ActionCard } from "./types";

export interface ActionConfirmCardProps {
  card: ActionCard;
  onConfirm: () => void;
  onDecline: () => void;
  onAllow: (permission: PermissionName) => void;
}

const PERMISSION_WORDS: Record<PermissionName, string> = {
  microphone: "the microphone",
  notifications: "notifications",
};

/**
 * One thing the assistant would like to do. Nothing happens until the person says yes
 * (high-risk things always ask). Each state is written in words, not just colour.
 */
export function ActionConfirmCard({ card, onConfirm, onDecline, onAllow }: ActionConfirmCardProps) {
  const { action, status, resultMessage, needsPermission } = card;

  return (
    <div className="bw flex flex-col gap-3 rounded-2xl bg-surface-2 p-4" data-status={status}>
      <div className="flex flex-col gap-1">
        <p className="text-xl font-bold text-ink">{action.title}</p>
        {action.description && <p className="text-base text-muted">{action.description}</p>}
      </div>

      {status === "proposed" && (
        <>
          <p className="text-lg font-bold text-ink">Should I do this?</p>
          {action.risk === "high" && (
            <p className="flex items-center gap-2 text-base text-muted">
              <ShieldCheck aria-hidden="true" className="size-5 shrink-0" />
              I always check with you before this.
            </p>
          )}
          <div className="flex flex-col gap-3">
            <Button fullWidth onClick={onConfirm} aria-label={`Yes, do it: ${action.title}`}>
              Yes, do it
            </Button>
            <Button variant="secondary" fullWidth onClick={onDecline} aria-label={`No thanks: ${action.title}`}>
              No thanks
            </Button>
          </div>
        </>
      )}

      {status === "running" && (
        <p role="status" className="flex items-center gap-3 text-lg font-bold text-ink">
          <Loader2 aria-hidden="true" className="size-6 animate-spin" /> Working on it…
        </p>
      )}

      {status === "done" && (
        <p className="flex items-center gap-3 text-lg font-bold text-ink">
          <CircleCheck aria-hidden="true" className="size-6 shrink-0" />
          <span>Done. {resultMessage}</span>
        </p>
      )}

      {status === "failed" && (
        <>
          <p className="text-lg text-ink">
            <span className="font-bold">That didn&apos;t work. </span>
            {resultMessage}
          </p>
          <div className="flex flex-col gap-3">
            {needsPermission && (
              <Button fullWidth onClick={() => onAllow(needsPermission)}>
                {`Allow ${PERMISSION_WORDS[needsPermission]}`}
              </Button>
            )}
            <Button variant="secondary" fullWidth onClick={onConfirm}>
              Try again
            </Button>
          </div>
        </>
      )}

      {status === "dismissed" && <p className="text-lg text-muted">You said no. I did not do this.</p>}
      {status === "unsupported" && <p className="text-lg text-muted">I can&apos;t do this on this device yet.</p>}
    </div>
  );
}
