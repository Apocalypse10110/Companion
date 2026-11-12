"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner } from "../components/Card";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { ScrollPage } from "../components/ScrollPage";
import { useConversation } from "../conversation/ConversationProvider";
import type { Conversation } from "../conversation/types";
import { useSettings } from "../settings/SettingsProvider";

function titleOf(c: Conversation): string {
  const first = c.messages.find((m) => m.role === "user") ?? c.messages[0];
  const text = first?.text ?? "Conversation";
  return text.length > 70 ? `${text.slice(0, 67)}…` : text;
}

function whenOf(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(ms);
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export function HistoryScreen() {
  const { history, activeId, openConversation, deleteConversation } = useConversation();
  const { settings } = useSettings();
  const router = useRouter();
  const [deleting, setDeleting] = useState<Conversation | null>(null);

  return (
    <ScrollPage>
      <PageHeader title="History" />

      {!settings.saveHistory && (
        <Banner tone="info" title="Not remembering new conversations">
          You can turn this back on in Settings, under Privacy and safety.
        </Banner>
      )}

      {history.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-xl text-ink">Nothing here yet. Your conversations will show up here.</p>
          <Button icon={MessageSquarePlus} onClick={() => router.push("/")}>
            Start talking
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {history.map((c) => (
            <li key={c.id}>
              <details className="bw rounded-2xl bg-surface">
                <summary className="flex min-h-[var(--target)] cursor-pointer flex-col justify-center gap-1 rounded-2xl p-5">
                  <span className="text-xl font-bold text-ink">{titleOf(c)}</span>
                  <span className="text-base text-muted">
                    {whenOf(c.updatedAt)}
                    {c.id === activeId ? " · Current conversation" : ""}
                  </span>
                </summary>
                <div className="flex flex-col gap-4 px-5 pb-5">
                  <ol aria-label="Messages in this conversation" className="flex flex-col gap-3">
                    {c.messages.map((m) => (
                      <li key={m.id} className="text-lg text-ink">
                        <span className="font-bold">{m.role === "user" ? "You" : "Companion"}: </span>
                        {m.text}
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-col gap-3">
                    <Button
                      fullWidth
                      onClick={() => {
                        openConversation(c.id);
                        router.push("/");
                      }}
                    >
                      Continue this conversation
                    </Button>
                    <Button variant="secondary" icon={Trash2} fullWidth onClick={() => setDeleting(c)}>
                      Delete this conversation
                    </Button>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        tone="danger"
        title="Delete this conversation?"
        description="It will be removed from this phone. This cannot be undone."
        confirmLabel="Yes, delete it"
        cancelLabel="No, keep it"
        onConfirm={() => {
          if (deleting) deleteConversation(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </ScrollPage>
  );
}
