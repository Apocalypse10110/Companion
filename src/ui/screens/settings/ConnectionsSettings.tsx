"use client";

import { CalendarDays, CircleCheck, CircleDashed, Link2, Loader2, Mail, TriangleAlert, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ConnectionId, ConnectionInfo } from "@/contracts";
import { useServices } from "@/integration/ServicesProvider";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
import { Button } from "../../components/Button";
import { Banner, Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";

/** What each known account is for, in plain words. Unknown accounts get a generic row. */
const KNOWN: Record<string, { icon: LucideIcon; about: string }> = {
  "google-calendar": { icon: CalendarDays, about: "Your appointments and events." },
  gmail: { icon: Mail, about: "Your email." },
};

type Feedback = { tone: "success" | "error" | "info"; text: string };

function StatusLine({ c }: { c: ConnectionInfo }) {
  // Each state is written in words, with an icon, never shown by colour alone.
  const [Icon, text, tone] =
    c.state === "connected"
      ? [CircleCheck, "Connected", "text-success"]
      : c.state === "needs-attention"
        ? [TriangleAlert, "Needs you to sign in again", "text-accent-ink"]
        : c.state === "unavailable"
          ? [CircleDashed, "Not available yet", "text-muted"]
          : [CircleDashed, "Not connected", "text-muted"];
  return (
    <p className="flex items-start gap-2 text-lg text-ink">
      <Icon aria-hidden="true" className={`mt-0.5 size-6 shrink-0 ${tone}`} strokeWidth={2.5} />
      <span className="flex min-w-0 flex-col">
        <span>{text}</span>
        {/* The account on its own line, so a long address wraps cleanly instead of mid-word. */}
        {c.state === "connected" && c.account && (
          <span className="font-bold [overflow-wrap:anywhere]">
            <span className="sr-only">as </span>
            {c.account}
          </span>
        )}
      </span>
    </p>
  );
}

export function ConnectionsSettings() {
  const { connections } = useServices();
  const announce = useAnnounce();
  const [list, setList] = useState<ConnectionInfo[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<ConnectionId | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [disconnecting, setDisconnecting] = useState<ConnectionInfo | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setList(await connections.list());
    } catch {
      setList(null);
      setLoadFailed(true);
    }
  }, [connections]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the account list once on arrival
    void load();
  }, [load]);

  function replace(next: ConnectionInfo) {
    setList((old) => old?.map((c) => (c.id === next.id ? next : c)) ?? [next]);
  }

  async function run(c: ConnectionInfo, kind: "connect" | "disconnect") {
    setBusy(c.id);
    setFeedback((f) => {
      const next = { ...f };
      delete next[c.id];
      return next;
    });
    try {
      const r = kind === "connect" ? await connections.connect(c.id) : await connections.disconnect(c.id);
      replace(r.connection);
      const tone: Feedback["tone"] = r.ok ? "success" : r.cancelled ? "info" : "error";
      setFeedback((f) => ({ ...f, [c.id]: { tone, text: r.message } }));
      announce(r.message, r.ok || r.cancelled ? "polite" : "assertive");
    } catch {
      const text = "Something went wrong. Nothing was changed. Please try again.";
      setFeedback((f) => ({ ...f, [c.id]: { tone: "error", text } }));
      announce(text, "assertive");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollPage>
      <PageHeader title="Connected accounts" backHref="/settings" backLabel="Settings" />

      <Card className="flex flex-col gap-2">
        <p className="text-lg text-ink">
          Connect your calendar and email so I can help with them when you ask. You choose what to connect, and you can
          disconnect at any time.
        </p>
      </Card>

      {loadFailed && (
        <Banner tone="error" title="I couldn't check your accounts" urgent actions={<Button onClick={() => void load()}>Try again</Button>}>
          Please try again.
        </Banner>
      )}

      {!list && !loadFailed && (
        <p role="status" className="flex items-center gap-3 text-xl text-ink">
          <Loader2 aria-hidden="true" className="size-6 animate-spin" />
          Checking your accounts…
        </p>
      )}

      {list && (
        <ul className="flex flex-col gap-4" aria-label="Accounts">
          {list.map((c) => {
            const known = KNOWN[c.id];
            const Icon = known?.icon ?? Link2;
            const isBusy = busy === c.id;
            const fb = feedback[c.id];
            return (
              <li key={c.id} className="bw flex flex-col gap-4 rounded-3xl bg-surface p-5" data-state={c.state}>
                <div className="flex items-start gap-4">
                  <Icon aria-hidden="true" className="mt-1 size-8 shrink-0 text-accent-ink" strokeWidth={2.25} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2 className="display text-2xl text-ink">{c.name}</h2>
                    {known && <p className="text-lg text-muted">{known.about}</p>}
                    <StatusLine c={c} />
                    {c.message && <p className="text-lg text-ink">{c.message}</p>}
                  </div>
                </div>

                {c.state === "unavailable" ? null : c.state === "connected" ? (
                  <Button variant="secondary" fullWidth disabled={busy !== null} onClick={() => setDisconnecting(c)}>
                    {isBusy ? "Disconnecting…" : `Disconnect ${c.name}`}
                  </Button>
                ) : (
                  <Button fullWidth disabled={busy !== null} icon={isBusy ? Loader2 : undefined} onClick={() => void run(c, "connect")}>
                    {isBusy ? "Connecting…" : c.state === "needs-attention" ? `Sign in to ${c.name} again` : `Connect ${c.name}`}
                  </Button>
                )}

                {fb && (
                  <Banner tone={fb.tone} title={fb.tone === "success" ? "Done" : fb.tone === "error" ? "That didn't work" : "Nothing changed"}>
                    {fb.text}
                  </Banner>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={disconnecting !== null}
        title={`Disconnect ${disconnecting?.name ?? "this account"}?`}
        description="I won't be able to use it until you connect it again. Nothing in the account itself is deleted."
        confirmLabel="Yes, disconnect"
        cancelLabel="No, keep it connected"
        onConfirm={() => {
          const c = disconnecting;
          setDisconnecting(null);
          if (c) void run(c, "disconnect");
        }}
        onCancel={() => setDisconnecting(null)}
      />
    </ScrollPage>
  );
}
