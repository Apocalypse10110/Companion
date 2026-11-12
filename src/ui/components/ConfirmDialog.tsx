"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Optional third way out that changes nothing. When given, Escape and Back use it
   * instead of onCancel, so a mistaken tap can always be undone.
   */
  dismissLabel?: string;
  onDismiss?: () => void;
}

/**
 * A question the person must answer. Uses the browser's native <dialog>, which
 * traps focus, closes on Escape, and is announced correctly by screen readers.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  onConfirm,
  onCancel,
  dismissLabel,
  onDismiss,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      onCancel={(e) => {
        e.preventDefault();
        (onDismiss ?? onCancel)();
      }}
      className="bw m-auto w-[min(92vw,34rem)] rounded-[1.75rem] bg-surface p-6 text-ink shadow-soft"
    >
      <div className="flex flex-col gap-4">
        <h2 id={`${id}-title`} className="display text-[1.75rem]">
          {title}
        </h2>
        <p id={`${id}-desc`} className="text-lg">
          {description}
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Button variant={tone === "danger" ? "danger" : "primary"} fullWidth onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
          {dismissLabel && onDismiss && (
            <Button variant="ghost" fullWidth onClick={onDismiss}>
              {dismissLabel}
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}
