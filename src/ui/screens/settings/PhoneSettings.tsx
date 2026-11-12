"use client";

import { Bell, Camera, CircleCheck, CircleDashed, CircleX, Mic, Share2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PermissionName, PermissionState } from "@/contracts";
import { useServices } from "@/integration/ServicesProvider";
import { capabilities, type Capabilities } from "@/phone/platform";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
import { Button } from "../../components/Button";
import { Banner, Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";

const PERMS: Array<{ name: PermissionName; icon: LucideIcon; title: string; why: string }> = [
  { name: "microphone", icon: Mic, title: "Microphone", why: "So you can talk to me." },
  { name: "notifications", icon: Bell, title: "Notifications", why: "So I can alert you about reminders." },
  { name: "camera", icon: Camera, title: "Camera", why: "Not used yet. Nothing needs it today." },
];

const STATE_WORDS: Record<PermissionState, [LucideIcon, string]> = {
  granted: [CircleCheck, "Allowed"],
  denied: [CircleX, "Turned off"],
  prompt: [CircleDashed, "Not asked yet"],
  unsupported: [CircleDashed, "Not available on this phone or browser"],
};

type AIStatus = { configured: boolean; provider: string | null } | "offline" | null;

function Row({ ok, text }: { ok: boolean; text: string }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li className="flex items-start gap-3 text-lg text-ink">
      <Icon aria-hidden="true" className={`mt-0.5 size-6 shrink-0 ${ok ? "text-success" : "text-muted"}`} strokeWidth={2.5} />
      <span>
        <span className="sr-only">{ok ? "Yes: " : "No: "}</span>
        {text}
      </span>
    </li>
  );
}

/** What this phone allows Companion to do, in plain words, with a way to allow each thing. */
export function PhoneSettings() {
  const { permissions } = useServices();
  const announce = useAnnounce();
  const [states, setStates] = useState<Partial<Record<PermissionName, PermissionState>>>({});
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [ai, setAI] = useState<AIStatus>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next: Partial<Record<PermissionName, PermissionState>> = {};
    for (const p of PERMS) next[p.name] = await permissions.check(p.name).catch(() => "unsupported" as const);
    setStates(next);
  }, [permissions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setCaps(capabilities());
    void refresh();
    fetch("/api/assistant", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { configured?: boolean; provider?: string | null }) => setAI({ configured: Boolean(d.configured), provider: d.provider ?? null }))
      .catch(() => setAI("offline"));
  }, [refresh]);

  async function allow(name: PermissionName) {
    const result = await permissions.request(name).catch(() => "unsupported" as const);
    setStates((s) => ({ ...s, [name]: result }));
    const text =
      result === "granted"
        ? "Allowed."
        : result === "denied"
          ? "It's turned off. To turn it on, open your phone's Settings, find your web browser or Companion, and allow it there."
          : "This phone or browser can't do that.";
    setNote(text);
    announce(text, result === "granted" ? "polite" : "assertive");
  }

  async function share() {
    try {
      await navigator.share({
        title: "Companion",
        text: "Companion is a friendly helper that makes your phone easier to use. Try it here:",
        url: window.location.origin,
      });
    } catch {
      /* Closed the share sheet: nothing to do. */
    }
  }

  return (
    <ScrollPage>
      <PageHeader title="Phone and permissions" backHref="/settings" backLabel="Settings" />

      <Card>
        <p className="text-lg text-ink">
          I only ask for something at the moment I need it. I never make a call or send a message without you pressing the last
          button yourself.
        </p>
      </Card>

      <ul className="flex flex-col gap-4" aria-label="Permissions">
        {PERMS.map((p) => {
          const state = states[p.name];
          const [StateIcon, words] = state ? STATE_WORDS[state] : [CircleDashed, "Checking…"];
          return (
            <li key={p.name} className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" data-state={state}>
              <div className="flex items-start gap-4">
                <p.icon aria-hidden="true" className="mt-1 size-7 shrink-0 text-accent-ink" strokeWidth={2.25} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="display text-2xl text-ink">{p.title}</h2>
                  <p className="text-lg text-muted">{p.why}</p>
                  <p className="flex items-center gap-2 text-lg font-bold text-ink">
                    <StateIcon aria-hidden="true" className="size-6 shrink-0" strokeWidth={2.5} />
                    {words}
                  </p>
                </div>
              </div>
              {state === "prompt" && p.name !== "camera" && (
                <Button fullWidth onClick={() => void allow(p.name)}>
                  {`Allow ${p.title.toLowerCase()}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {note && <Banner tone="info">{note}</Banner>}

      {caps && (
        <section className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" aria-labelledby="can-title">
          <h2 id="can-title" className="display text-2xl text-ink">
            What I can do on this device
          </h2>
          <ul className="flex flex-col gap-2">
            <Row ok={caps.calls} text={caps.calls ? "Open your phone app to call someone" : "Phone calls (this isn't a phone)"} />
            <Row ok={caps.messages} text={caps.messages ? "Open Messages with your text ready" : "Text messages (this isn't a phone)"} />
            <Row ok={caps.speechInput} text={caps.speechInput ? "Listen when you talk" : "Listen when you talk (this browser can't; you can type instead)"} />
            <Row ok={caps.speechOutput} text="Read my answers aloud" />
            <Row ok={caps.contactPicker} text={caps.contactPicker ? "Pick someone from your contacts" : "Pick from your contacts (add people in Settings, People)"} />
            <Row ok={caps.notifications} text={caps.notifications ? "Show reminder notifications" : caps.os === "ios" && !caps.standalone ? "Notifications (add me to your Home Screen first)" : "Show reminder notifications"} />
            <Row ok={ai !== null && ai !== "offline" && ai.configured} text={ai === null ? "Checking my online helper…" : ai === "offline" ? "Online helper (no internet right now)" : ai.configured ? "Answer questions with my online helper" : "Online helper (not set up; I can still do simple things)"} />
          </ul>
          <p className="text-lg text-muted">
            For privacy, phones don&apos;t let any website read your text messages or call history, so I can&apos;t do that.
          </p>
        </section>
      )}

      {caps && !caps.standalone && caps.os !== "desktop" && (
        <section className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" aria-labelledby="install-title">
          <h2 id="install-title" className="display text-2xl text-ink">
            Put me on your home screen
          </h2>
          <p className="text-lg text-ink">
            {caps.os === "ios"
              ? "In Safari, tap the Share button (a square with an arrow pointing up) at the bottom. Then tap \"Add to Home Screen\", then Add."
              : "In Chrome, tap the three dots at the top right. Then tap \"Add to Home screen\" or \"Install app\"."}
          </p>
        </section>
      )}

      {caps?.share && (
        <Button variant="secondary" icon={Share2} fullWidth onClick={() => void share()}>
          Share Companion with family
        </Button>
      )}
    </ScrollPage>
  );
}
