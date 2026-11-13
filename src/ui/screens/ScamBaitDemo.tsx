"use client";

import { Drama, Play } from "lucide-react";
import { useState } from "react";
import { BAIT_NAME, type BaitTurn } from "@/ai/scamBait";
import { useAnnounce } from "../a11y/LiveAnnouncer";
import { Button } from "../components/Button";
import { nextLine } from "./ScamBaitScreen";

/** A pretend scammer for the practice round. Written by us, sent nowhere. */
export const PRACTICE_SCRIPT = [
  "Royal Mail: your parcel is on hold due to an unpaid fee of £1.45. Pay now at royalmail-redelivery-fee.com or it will be returned.",
  "Hello madam, you need to pay the fee today. Please give me your card number so I can process it.",
  "Madam it is very urgent. Just read me the long number on the front of your card.",
  "I will send you a code. Tell me the code when it arrives, it is for security.",
  "Why are you taking so long? Do you want your parcel or not?",
];

/**
 * Scam Bait practice round: a simulated scammer (fixed lines) and Doris's real replies, side by side.
 * It's clearly marked as pretend, nothing is sent to anyone, and no time is claimed as "wasted".
 */
export function ScamBaitDemo() {
  const announce = useAnnounce();
  const [turns, setTurns] = useState<BaitTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const step = turns.filter((t) => t.from === "scammer").length;
  const done = step >= PRACTICE_SCRIPT.length && !busy;

  async function next() {
    if (busy || step >= PRACTICE_SCRIPT.length) return;
    const thread: BaitTurn[] = [...turns, { from: "scammer", text: PRACTICE_SCRIPT[step] }];
    setTurns(thread);
    setBusy(true);
    const line = await nextLine(thread);
    setTurns([...thread, { from: "doris", text: line }]);
    setBusy(false);
    announce(`${BAIT_NAME}: ${line}`);
  }

  return (
    <section aria-label="Practice round" className="bw flex flex-col gap-3 rounded-3xl bg-surface-2 p-4" data-testid="scam-bait-demo">
      <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
        <Drama aria-hidden="true" className="size-6 shrink-0" />
        Practice round (pretend scammer)
      </h2>
      <p className="text-lg text-ink">
        See how {BAIT_NAME} answers. The scammer here is pretend: written by us, not a real person. Nothing is sent to anyone.
      </p>
      {turns.length > 0 && (
        <ol className="flex flex-col gap-3" aria-label="Practice conversation">
          {turns.map((t, i) => (
            <li key={i} className={t.from === "scammer" ? "flex justify-start" : "flex justify-end"}>
              <div className={`bw max-w-[90%] rounded-3xl px-4 py-3 ${t.from === "scammer" ? "rounded-tl-md bg-danger-soft" : "rounded-tr-md bg-accent-soft"}`}>
                <p className="text-base font-bold text-ink">{t.from === "scammer" ? "Pretend scammer" : BAIT_NAME}</p>
                <p className="text-xl text-ink">{t.text}</p>
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex justify-end">
              <p className="text-xl font-bold text-ink" role="status">
                {BAIT_NAME} is typing…
              </p>
            </li>
          )}
        </ol>
      )}
      {done ? (
        <p className="text-lg font-bold text-ink">That&apos;s the practice round. {BAIT_NAME} never gave them a single real detail.</p>
      ) : (
        <Button variant="secondary" icon={Play} fullWidth disabled={busy} onClick={() => void next()}>
          {step === 0 ? "Start the practice round" : "Next message from the pretend scammer"}
        </Button>
      )}
    </section>
  );
}
