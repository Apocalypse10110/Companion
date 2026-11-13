"use client";

import { ClipboardPaste, Copy, Flag, MessageSquare, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { smsUrl } from "@/actions/links";
import { redactPhoneNumbers } from "@/ai/providers/redact";
import { BAIT_NAME, busyMinutes, stallLine, type BaitTurn } from "@/ai/scamBait";
import { cleanPhone } from "@/people/store";
import { detectOS } from "@/phone/platform";
import { useAnnounce } from "../a11y/LiveAnnouncer";
import { Banner, Card } from "../components/Card";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { ScrollPage } from "../components/ScrollPage";
import { ScamBaitDemo } from "./ScamBaitDemo";

export interface TimedTurn extends BaitTurn {
  at: number;
}

interface Saved {
  turns: TimedTurn[];
  number: string;
  finished: boolean;
}

const KEY = "companion.scambait.v1";
export const SCAM_BAIT_ENDPOINT = "/api/scam-bait";

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s && Array.isArray(s.turns) ? s : null;
  } catch {
    return null;
  }
}

function store(s: Saved | null): void {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* not remembered if Companion reloads; the game still works */
  }
}

/** Ask the server for Doris's next line. Falls back to her stall lines, so it always answers. */
export async function nextLine(thread: BaitTurn[], fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<string> {
  try {
    const res = await fetchImpl(SCAM_BAIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Phone numbers stay on the phone (the same rule as the assistant): Doris doesn't need them.
      body: JSON.stringify({ thread: thread.map(({ from, text }) => ({ from, text: redactPhoneNumbers(text) })) }),
    });
    const data = (await res.json().catch(() => null)) as { reply?: unknown } | null;
    if (res.ok && typeof data?.reply === "string" && data.reply.trim()) return data.reply;
  } catch {
    /* offline: use a stall line */
  }
  return stallLine(thread);
}

/**
 * Scam Bait: paste a scam text and Doris, a chatty and muddled persona, writes replies that keep
 * the scammer busy. The person copies each one or opens it in Messages and presses Send themselves.
 * Companion never sends anything, and Doris never gives a real number, code, link or address.
 */
export function ScamBaitScreen() {
  const announce = useAnnounce();
  const [turns, setTurns] = useState<TimedTurn[]>([]);
  const [number, setNumber] = useState("");
  const [finished, setFinished] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLOListElement>(null);

  // Keep the newest message in view, so Doris's answer is seen as soon as it arrives.
  useEffect(() => {
    const last = list.current?.lastElementChild as HTMLElement | null;
    last?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [turns.length, busy]);

  // Bring back a game in progress (Android may reload Companion while Messages is open).
  useEffect(() => {
    const s = load();
    /* eslint-disable react-hooks/set-state-in-effect -- reading saved state after mount */
    if (s) {
      setTurns(s.turns);
      setNumber(s.number ?? "");
      setFinished(Boolean(s.finished));
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated) store(turns.length ? { turns, number, finished } : null);
  }, [turns, number, finished, hydrated]);

  const started = turns.length > 0;
  const scammerTimes = turns.filter((t) => t.from === "scammer").map((t) => t.at);
  const minutes = busyMinutes(scammerTimes);
  const lastIsScammer = turns[turns.length - 1]?.from === "scammer";

  async function addScammerMessage() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: TimedTurn[] = [...turns, { from: "scammer", text, at: Date.now() }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    announce(`${BAIT_NAME} is writing a reply.`);
    const line = await nextLine(next);
    setTurns([...next, { from: "doris", text: line, at: Date.now() }]);
    setBusy(false);
    announce(`${BAIT_NAME}'s reply: ${line}`);
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setDraft(text.trim());
      else announce("There was nothing to paste.");
    } catch {
      announce("I couldn't paste. Press and hold in the box, then choose Paste.");
      box.current?.focus();
    }
  }

  async function copy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      announce("Copied. Now paste it into your reply to them.");
    } catch {
      announce("I couldn't copy that. Press and hold the words to copy them.");
    }
  }

  function openInMessages(text: string) {
    // Opens Messages with the words filled in. The person reads it and presses Send themselves.
    window.location.href = smsUrl(number, text, detectOS());
  }

  function restart() {
    setTurns([]);
    setNumber("");
    setFinished(false);
    setDraft("");
    setCopied(null);
    announce("Cleared. Ready for a new scam message.");
  }

  return (
    <ScrollPage>
      <PageHeader title="Scam Bait" backHref="/safety" backLabel="Safety">
        <p className="text-xl text-muted">
          Got a scam text? Let {BAIT_NAME} keep them busy, so they have less time for anyone else.
        </p>
      </PageHeader>

      {!started && (
        <>
          <Card className="flex flex-col gap-3">
            <p className="text-lg text-ink">
              {BAIT_NAME} is a chatty, muddled grandma. She always seems about to help, but she can never find her glasses.
              She never gives any real number, code, address or link.
            </p>
            <p className="text-lg text-ink">You send each reply yourself. Companion never sends anything for you.</p>
            <p className="text-base text-muted">Inspired by O2&apos;s &ldquo;Daisy&rdquo;, who does this on phone calls.</p>
          </Card>
          <ScamBaitDemo />
          <Banner tone="warning" title="Good to know">
            Replying tells a scammer your number works, so you may get more scam texts. If you&apos;d rather not, just delete
            the message and forward it to 7726.
          </Banner>
          <label className="flex flex-col gap-2">
            <span className="text-lg font-bold text-ink">Their phone number, if you have it (optional)</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={number}
              onChange={(e) => setNumber(cleanPhone(e.target.value))}
              className="bw min-h-[var(--target)] rounded-2xl bg-surface px-4 text-xl text-ink"
            />
          </label>
        </>
      )}

      {started && (
        <p className="flex items-center gap-2 text-xl font-bold text-ink" role="status" data-testid="busy-timer">
          <Timer aria-hidden="true" className="size-7 shrink-0 text-accent-ink" />
          {minutes > 0 ? `Kept them busy ${minutes} minute${minutes === 1 ? "" : "s"}` : "The game is on"}
        </p>
      )}

      {started && (
        <ol ref={list} aria-label="Scam Bait conversation" className="flex flex-col gap-4">
          {turns.map((t, i) =>
            t.from === "scammer" ? (
              <li key={i} className="flex justify-start">
                <div className="bw max-w-[90%] rounded-3xl rounded-tl-md bg-danger-soft px-4 py-3">
                  <p className="text-base font-bold text-ink">Scammer</p>
                  <p className="text-xl text-ink">{t.text}</p>
                </div>
              </li>
            ) : (
              <li key={i} className="flex flex-col items-end gap-3">
                <div className="bw max-w-[90%] rounded-3xl rounded-tr-md bg-accent-soft px-4 py-3">
                  <p className="text-base font-bold text-ink">{BAIT_NAME}</p>
                  <p className="text-xl text-ink">{t.text}</p>
                </div>
                {i === turns.length - 1 && !finished && (
                  <div className="flex w-full flex-col gap-3">
                    <Button variant="secondary" icon={Copy} fullWidth onClick={() => void copy(t.text, i)}>
                      {copied === i ? "Copied" : "Copy this reply"}
                    </Button>
                    {number && (
                      <Button variant="secondary" icon={MessageSquare} fullWidth onClick={() => openInMessages(t.text)}>
                        Open in Messages
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ),
          )}
          {busy && (
            <li className="flex justify-end">
              <p className="text-xl font-bold text-ink" role="status">
                {BAIT_NAME} is typing…
              </p>
            </li>
          )}
        </ol>
      )}

      {!finished && !busy && !lastIsScammer && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-lg font-bold text-ink">
              {started ? "Did they reply? Paste their message here" : "Paste the scam message here"}
            </span>
            <textarea
              ref={box}
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="bw rounded-2xl bg-surface px-4 py-3 text-xl text-ink"
            />
          </label>
          <Button variant="secondary" icon={ClipboardPaste} fullWidth onClick={() => void paste()}>
            Paste
          </Button>
          <Button fullWidth disabled={!draft.trim()} onClick={() => void addScammerMessage()}>
            {started ? `Get ${BAIT_NAME}'s answer` : `Let ${BAIT_NAME} reply`}
          </Button>
        </div>
      )}

      {!finished && !busy && lastIsScammer && (
        <Button
          fullWidth
          onClick={() => {
            const thread = turns;
            setBusy(true);
            void nextLine(thread).then((line) => {
              setTurns([...thread, { from: "doris", text: line, at: Date.now() }]);
              setBusy(false);
              announce(`${BAIT_NAME}'s reply: ${line}`);
            });
          }}
        >
          Get {BAIT_NAME}&apos;s answer
        </Button>
      )}

      {started && !finished && !busy && (
        <Button variant="ghost" icon={Flag} onClick={() => setFinished(true)}>
          I&apos;m done
        </Button>
      )}

      {finished && (
        <section aria-label="Your Scam Bait report" className="bw flex flex-col gap-3 rounded-3xl bg-success-soft p-5">
          <h2 className="display text-[1.75rem] text-ink">
            {minutes > 0 ? `You kept them busy ${minutes} minute${minutes === 1 ? "" : "s"}` : "Well done"}
          </h2>
          <p className="text-lg text-ink">
            They sent {scammerTimes.length} message{scammerTimes.length === 1 ? "" : "s"}, and {BAIT_NAME} gave them nothing.
            That was time they couldn&apos;t spend on someone else.
          </p>
          <p className="text-lg text-ink">
            Last step: forward their first message to <strong>7726</strong>. It&apos;s free, and it helps your phone company
            block them. Then delete it.
          </p>
          <Button variant="secondary" icon={RotateCcw} fullWidth onClick={restart}>
            Start again
          </Button>
        </section>
      )}
    </ScrollPage>
  );
}
