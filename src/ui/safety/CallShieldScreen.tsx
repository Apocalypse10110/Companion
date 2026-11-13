"use client";

import { Ear, OctagonAlert, ShieldQuestion, Square, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceInputSession } from "@/contracts";
import { findCallSigns, type CallSign } from "@/ai/callShield";
import { useServices } from "@/integration/ServicesProvider";
import { useAnnounce } from "../a11y/LiveAnnouncer";
import { Banner, Card } from "../components/Card";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { ScrollPage } from "../components/ScrollPage";
import { useConversation } from "../conversation/ConversationProvider";
import { Thread } from "../conversation/Thread";
import { scamQuestion } from "./SafetyScreen";

/**
 * Scam Call Shield: this phone listens, with its own microphone, to a call playing on speaker on
 * ANOTHER phone (or a recording), and warns about scam signs as they're said. A web app can't hear
 * phone calls on the phone it runs on, and this never records in secret: listening is on only
 * between Start and Stop, with the words shown on screen. Nothing is kept after leaving.
 */
export function CallShieldScreen() {
  const { voiceInput } = useServices();
  const c = useConversation();
  const announce = useAnnounce();
  const [listening, setListening] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [signs, setSigns] = useState<CallSign[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const session = useRef<VoiceInputSession | null>(null);
  const wanted = useRef(false);
  const transcript = useRef("");
  /** The latest "listen once", for restarting after each pause. */
  const again = useRef<() => void>(() => {});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setSupported(voiceInput.isSupported());
  }, [voiceInput]);

  const stop = useCallback(() => {
    wanted.current = false;
    session.current?.abort();
    session.current = null;
    setListening(false);
    setInterim("");
  }, []);

  useEffect(() => stop, [stop]);

  const listenOnce = useCallback(() => {
    if (!wanted.current) return;
    session.current = voiceInput.start(
      {
        onInterim: setInterim,
        onFinal: (text) => {
          setInterim("");
          if (!text.trim()) return;
          transcript.current = `${transcript.current} ${text}`.trim().slice(-6000);
          setLines((l) => [...l, text].slice(-12));
          const found = findCallSigns(transcript.current);
          setSigns((before) => {
            const fresh = found.filter((s) => !before.some((b) => b.id === s.id));
            if (fresh.some((s) => s.serious)) announce("Be careful. This caller is asking for information that legitimate organisations should not request.");
            return found;
          });
        },
        onError: (e) => {
          if (e.code === "permission-denied" || e.code === "no-microphone") {
            setProblem(e.code === "permission-denied" ? "The microphone is turned off for Companion. Allow it in your browser's settings for this site." : "I couldn't find a microphone.");
            stop();
          }
        },
        // Speech recognition stops after each pause: keep going until Stop is pressed.
        onEnd: () => {
          if (wanted.current) setTimeout(() => again.current(), 150);
        },
      },
      { language: navigator.language || "en-US" },
    );
  }, [announce, stop, voiceInput]);

  useEffect(() => {
    again.current = listenOnce;
  }, [listenOnce]);

  const start = () => {
    setProblem(null);
    setLines([]);
    setSigns([]);
    transcript.current = "";
    wanted.current = true;
    setListening(true);
    announce("Listening. Put the other phone on speaker, near this one.");
    listenOnce();
  };

  const serious = signs.some((s) => s.serious);

  return (
    <ScrollPage>
      <PageHeader title="Call Shield" backHref="/safety" backLabel="Safety" />
      <Card className="flex flex-col gap-2">
        <p className="text-lg text-ink">
          Put a call on speaker on <strong>another</strong> phone, or play a recording, near this phone. I&apos;ll listen with this
          phone&apos;s microphone and warn you about scam signs.
        </p>
        <p className="text-base text-muted">
          I can&apos;t hear calls on this phone itself; no web app can. I only listen between Start and Stop, and nothing is
          saved.
        </p>
      </Card>

      {!supported && <Banner tone="warning">This browser can&apos;t turn speech into words. Try Chrome on Android or Safari on iPhone.</Banner>}
      {problem && <Banner tone="error">{problem}</Banner>}

      {listening ? (
        <Button variant="danger" icon={Square} fullWidth onClick={stop}>
          Stop listening
        </Button>
      ) : (
        <Button icon={Ear} fullWidth onClick={start} disabled={!supported}>
          {lines.length ? "Listen again" : "Start listening"}
        </Button>
      )}

      {serious && (
        <section role="alert" className="bw flex flex-col gap-2 rounded-3xl border-4 border-danger bg-danger-soft p-4">
          <h2 className="flex items-start gap-3 text-2xl font-bold text-ink">
            <OctagonAlert aria-hidden="true" className="mt-0.5 size-8 shrink-0" strokeWidth={2.5} />
            Stop. Don&apos;t share any information.
          </h2>
          <p className="text-lg text-ink">
            This caller is asking for information that legitimate organisations should not request. Hang up, then call the
            organisation yourself on a number you trust, like the one on your card or bill.
          </p>
        </section>
      )}

      {signs.length > 0 && (
        <section aria-label="Warning signs heard" className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-ink">Warning signs I heard</h2>
          <ul className="flex flex-col gap-2">
            {signs.map((s) => (
              <li key={s.id} className="bw flex gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-lg text-ink">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
                {s.warning}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(lines.length > 0 || interim) && (
        <section aria-label="What I heard" className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-ink">What I heard</h2>
          <div className="bw flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 text-lg text-ink">
            {lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            {interim && <p className="text-muted">{interim}</p>}
          </div>
        </section>
      )}

      {!listening && lines.length > 0 && (
        <Button
          variant="secondary"
          icon={ShieldQuestion}
          fullWidth
          disabled={c.phase === "thinking"}
          onClick={() => c.sendText(scamQuestion(`(A phone call, as heard) ${transcript.current}`), "scam", { fresh: true })}
        >
          Ask Companion to check the whole call
        </Button>
      )}
      {c.messages.some((m) => m.scam) && <Thread />}
    </ScrollPage>
  );
}
