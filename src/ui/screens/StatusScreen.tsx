"use client";

import { CircleCheck, CircleMinus, CircleX, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { ScrollPage } from "../components/ScrollPage";

interface Health {
  ok: boolean;
  time: string;
  version: string;
  region: string | null;
  ai: { configured: boolean; provider: string | null; reachable?: boolean; model?: string; checkedMs?: number; problem?: string };
  accounts: Record<string, boolean>;
}

const ACCOUNT_NAMES: Record<string, string> = { gmail: "Gmail", "google-calendar": "Google Calendar", outlook: "Outlook", spotify: "Spotify" };

function Row({ state, title, detail }: { state: "ok" | "off" | "down"; title: string; detail: string }) {
  const [Icon, word, tone]: [LucideIcon, string, string] =
    state === "ok" ? [CircleCheck, "Working", "text-success"] : state === "down" ? [CircleX, "Not working", "text-danger"] : [CircleMinus, "Not set up", "text-muted"];
  return (
    <li className="bw flex items-start gap-4 rounded-3xl bg-surface p-5">
      <Icon aria-hidden="true" className={`mt-1 size-7 shrink-0 ${tone}`} strokeWidth={2.5} />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="display text-2xl text-ink">{title}</h2>
        <p className="text-lg font-bold text-ink">{word}</p>
        <p className="text-lg text-ink [overflow-wrap:anywhere]">{detail}</p>
      </div>
    </li>
  );
}

/** /status: is Companion working right now? Plain words for people, details for judges. */
export function StatusScreen() {
  const [h, setH] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setH((await res.json()) as Health);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- checking once on arrival
    void load();
  }, [load]);

  const ai = h?.ai;
  const aiState: "ok" | "off" | "down" = !ai?.configured ? "off" : ai.reachable === false ? "down" : "ok";
  const aiDetail = !ai
    ? ""
    : !ai.configured
      ? "Questions and photos need it. Calls, texts, reminders and settings still work."
      : ai.reachable === false
        ? ai.problem === "auth"
          ? "The server's AI key was refused. Calls, texts, reminders and settings still work."
          : "Google's AI can't be reached right now. Calls, texts, reminders and settings still work."
        : `Answering with Google ${ai.model ?? "Gemini"}${ai.checkedMs ? ` (checked in ${ai.checkedMs} ms)` : ""}.`;

  return (
    <ScrollPage>
      <PageHeader title="Status" backHref="/settings" backLabel="Settings" />

      {failed && (
        <Card>
          <p className="text-xl text-ink">I couldn&apos;t reach Companion&apos;s server. Check your internet connection, then try again.</p>
        </Card>
      )}

      {!h && !failed && (
        <p role="status" className="flex items-center gap-3 text-xl text-ink">
          <Loader2 aria-hidden="true" className="size-6 animate-spin" /> Checking…
        </p>
      )}

      {h && (
        <>
          <p role="status" className="display text-[1.75rem] text-ink">
            {h.ok ? "Everything is working." : "Something isn't working right now."}
          </p>
          <ul className="flex flex-col gap-4" aria-label="Parts of Companion">
            <Row state="ok" title="The app" detail="Open and ready. Calls, texts, reminders, People and settings work on your phone." />
            <Row state={aiState} title="My online helper (AI)" detail={aiDetail} />
            {Object.entries(h.accounts).map(([id, on]) => (
              <Row
                key={id}
                state={on ? "ok" : "off"}
                title={ACCOUNT_NAMES[id] ?? id}
                detail={on ? "Ready to connect in Settings, then Connected accounts." : "Not set up on this server."}
              />
            ))}
          </ul>
          <p className="text-base text-muted">
            Version {h.version}
            {h.region ? `, server ${h.region}` : ""}. Checked {new Date(h.time).toLocaleTimeString()}.
          </p>
        </>
      )}

      <Button variant="secondary" icon={RefreshCw} fullWidth disabled={busy} onClick={() => void load()}>
        Check again
      </Button>
    </ScrollPage>
  );
}
