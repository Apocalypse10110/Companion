"use client";

import { BellPlus, FileText } from "lucide-react";
import { useState } from "react";
import type { DocumentInfo } from "@/contracts";
import { addReminder } from "@/actions/reminders";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";

/** The day before it's due, at 10 am; or the due day itself if that's already passed. Null if both have. */
export function reminderTime(dueDate: string, now = new Date()): Date | null {
  const due = new Date(`${dueDate}T10:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const before = new Date(due);
  before.setDate(before.getDate() - 1);
  if (before > now) return before;
  return due > now ? due : null;
}

function niceDate(iso: string, language: string): string {
  const d = new Date(`${iso}T12:00:00`);
  try {
    return d.toLocaleDateString(language, { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return d.toDateString();
  }
}

export function reminderTitle(doc: DocumentInfo): string {
  const what = doc.organization ? `${doc.organization} bill` : "the bill";
  return doc.amount ? `Pay ${what} (${doc.amount})` : `Pay ${what}`;
}

/**
 * "Point at a bill": what could be read, in a simple list. Anything hard to read is flagged so the
 * person checks it. A reminder is offered, and only made after they confirm. Companion never pays.
 */
export function DocumentCard({ doc, disabled, onDone }: { doc: DocumentInfo; disabled?: boolean; onDone?: (text: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  const language = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
  const at = doc.dueDate ? reminderTime(doc.dueDate) : null;
  const unclear = (field: string) => doc.unclear.some((u) => u.toLowerCase().includes(field));
  const rows: Array<[string, string | undefined, string]> = [
    ["From", doc.organization, "organization"],
    ["Amount", doc.amount, "amount"],
    ["Due", doc.dueDate ? niceDate(doc.dueDate, language) : undefined, "due"],
    ["Reference", doc.reference, "reference"],
  ];
  const when = at
    ? at.toLocaleString(language, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <section aria-label="What the letter says" className="bw flex flex-col gap-3 rounded-3xl bg-surface-2 px-4 py-4" data-testid="document-card">
      <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
        <FileText aria-hidden="true" className="size-6 shrink-0" />
        What I could read
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-lg text-ink">
        {rows
          .filter(([, value]) => value)
          .map(([label, value, field]) => (
            <div key={label} className="contents">
              <dt className="font-bold">{label}</dt>
              <dd className="[overflow-wrap:anywhere]">
                {value}
                {unclear(field) && <span className="font-bold"> (please check this)</span>}
              </dd>
            </div>
          ))}
      </dl>
      {doc.summary && <p className="text-lg text-ink">{doc.summary}</p>}
      {doc.unclear.length > 0 && (
        <p className="text-lg text-ink">Some parts were hard to read. Please check them on the letter itself.</p>
      )}
      <p className="text-base text-muted">I never pay bills or send money. Pay only through a way you already trust.</p>
      {made ? (
        <p role="status" className="text-lg font-bold text-ink">
          Reminder set for {made}.
        </p>
      ) : (
        at && (
          <Button variant="secondary" icon={BellPlus} fullWidth disabled={disabled} onClick={() => setAsking(true)}>
            Remind me before it&apos;s due
          </Button>
        )
      )}
      <ConfirmDialog
        open={asking}
        title="Set a reminder?"
        description={`"${reminderTitle(doc)}" on ${when}. Please check the date on the letter first.`}
        confirmLabel="Yes, set it"
        cancelLabel="No, thanks"
        onConfirm={() => {
          if (!at) return;
          addReminder({ text: reminderTitle(doc), at: at.toISOString(), description: doc.reference ? `Reference ${doc.reference}` : undefined });
          setAsking(false);
          setMade(when);
          onDone?.(`Reminder set for ${when}.`);
        }}
        onCancel={() => setAsking(false)}
      />
    </section>
  );
}
