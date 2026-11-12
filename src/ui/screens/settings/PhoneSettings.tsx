"use client";

import { CircleCheck, CircleDashed, CircleMinus, CircleX, Share2, Smartphone, Zap, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PermissionName } from "@/contracts";
import { useServices } from "@/integration/ServicesProvider";
import { permissionRows, type PermissionRow, type RowState } from "@/permissions/catalog";
import { capabilities, type Capabilities } from "@/phone/platform";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
import { Button } from "../../components/Button";
import { Banner, Card } from "../../components/Card";
import { ListLink } from "../../components/ListLink";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";

/** Every state in words and an icon, never colour alone. */
const STATE: Record<RowState, [LucideIcon, string, string]> = {
  granted: [CircleCheck, "Allowed", "text-success"],
  available: [CircleCheck, "Works on this phone", "text-success"],
  denied: [CircleX, "Turned off", "text-danger"],
  prompt: [CircleDashed, "Not asked yet", "text-muted"],
  unsupported: [CircleMinus, "Not available on this phone or browser", "text-muted"],
  "not-on-web": [CircleMinus, "Phones don't allow this for websites", "text-muted"],
  "not-needed": [CircleCheck, "No permission needed", "text-success"],
};

type AIStatus = { configured: boolean } | "offline" | null;

/** Settings -> Device permissions: what Companion can use on this phone, why, and how to change it. */
export function PhoneSettings() {
  const { permissions } = useServices();
  const announce = useAnnounce();
  const [rows, setRows] = useState<PermissionRow[] | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [ai, setAI] = useState<AIStatus>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => setRows(await permissionRows(permissions)), [permissions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setCaps(capabilities());
    void refresh();
    fetch("/api/assistant", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setAI({ configured: Boolean(d.configured) }))
      .catch(() => setAI("offline"));
    // Permissions can be changed in the phone's Settings while we're away: re-check on return.
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  async function allow(row: PermissionRow, name: PermissionName) {
    const result = await permissions.request(name).catch(() => "unsupported" as const);
    const text =
      result === "granted" ? `${row.title}: allowed.` : result === "denied" ? `${row.title} is turned off. ${row.howToEnable ?? ""}` : `${row.title} isn't available here. ${row.alternative ?? ""}`;
    setNote((n) => ({ ...n, [row.id]: text }));
    announce(text, result === "granted" ? "polite" : "assertive");
    void refresh();
  }

  async function share() {
    try {
      await navigator.share({ title: "Companion", text: "Companion is a friendly helper that makes your phone easier to use. Try it here:", url: window.location.origin });
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <ScrollPage>
      <PageHeader title="Device permissions" backHref="/settings" backLabel="Settings" />

      <Card>
        <p className="text-lg text-ink">
          I only ask for something at the moment I need it, and I explain why first. I never call or send a message without you
          pressing the last button yourself.
        </p>
      </Card>

      {!rows && <p role="status" className="text-xl text-ink">Checking this phone…</p>}

      {rows && (
        <ul className="flex flex-col gap-4" aria-label="Permissions">
          {rows.map((row) => {
            const [Icon, words, tone] = STATE[row.state];
            const showHow = row.state === "denied" && row.howToEnable;
            const showAlt = (row.state === "unsupported" || row.state === "not-on-web" || row.state === "denied") && row.alternative;
            return (
              <li key={row.id} className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" data-state={row.state}>
                <h2 className="display text-2xl text-ink">{row.title}</h2>
                <p className="text-lg text-ink">{row.use}</p>
                <p className="flex items-start gap-2 text-lg font-bold text-ink">
                  <Icon aria-hidden="true" className={`mt-0.5 size-6 shrink-0 ${tone}`} strokeWidth={2.5} />
                  {words}
                </p>
                {showHow && (
                  <p className="text-lg text-ink">
                    <span className="font-bold">To turn it on: </span>
                    {row.howToEnable}
                  </p>
                )}
                {showAlt && (
                  <p className="text-lg text-ink">
                    <span className="font-bold">Instead: </span>
                    {row.alternative}
                  </p>
                )}
                {row.state === "prompt" && row.request && (
                  <Button fullWidth onClick={() => void allow(row, row.request!)}>
                    {`Allow ${row.title.toLowerCase()}`}
                  </Button>
                )}
                {row.link && (
                  <ListLink href={row.link.href} icon={Zap} title={row.link.label} />
                )}
                {note[row.id] && <Banner tone="info">{note[row.id]}</Banner>}
              </li>
            );
          })}
        </ul>
      )}

      <section className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" aria-labelledby="ai-title">
        <h2 id="ai-title" className="display text-2xl text-ink">
          My online helper
        </h2>
        <p className="text-lg text-ink">
          {ai === null
            ? "Checking…"
            : ai === "offline"
              ? "There's no internet right now. I can still call, text, set reminders and change the text size."
              : ai.configured
                ? "Connected. I can answer questions and look at photos."
                : "Not set up. I can still call, text, set reminders and change the text size."}
        </p>
      </section>

      {caps && (
        <section className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" aria-labelledby="quick-title">
          <h2 id="quick-title" className="flex items-center gap-3 display text-2xl text-ink">
            <Smartphone aria-hidden="true" className="size-7 shrink-0 text-accent-ink" /> Quick access
          </h2>
          {caps.standalone ? (
            <p className="text-lg text-ink">I&apos;m on your home screen. Tap my icon any time to open me.</p>
          ) : caps.os === "ios" ? (
            <p className="text-lg text-ink">
              Put me on your home screen: in Safari, tap the Share button (a square with an arrow pointing up), then &ldquo;Add to Home
              Screen&rdquo;, then Add. That also lets me send reminder notifications.
            </p>
          ) : caps.os === "android" ? (
            <p className="text-lg text-ink">
              Put me on your home screen: in Chrome, tap the three dots at the top right, then &ldquo;Add to Home screen&rdquo; or
              &ldquo;Install app&rdquo;.
            </p>
          ) : (
            <p className="text-lg text-ink">On a phone, open this page and add it to the home screen to use me like an app.</p>
          )}
          {caps.os === "android" && (
            <p className="text-lg text-ink">
              Once installed, press and hold my icon for shortcuts: <span className="font-bold">Talk to me</span> and{" "}
              <span className="font-bold">Show me</span>. You can also share a screenshot straight to Companion from your Photos.
            </p>
          )}
          {caps.os === "ios" && (
            <p className="text-lg text-ink">
              To open me even faster, add my icon to the first page of your home screen or the bar at the bottom. Phones don&apos;t let
              websites start by themselves when the phone turns on.
            </p>
          )}
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
