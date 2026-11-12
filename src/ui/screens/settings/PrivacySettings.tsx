"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";
import { Toggle } from "../../components/Toggle";
import { useConversation } from "../../conversation/ConversationProvider";
import { useSettings } from "../../settings/SettingsProvider";

export function PrivacySettings() {
  const { settings, update } = useSettings();
  const { history, eraseHistory } = useConversation();
  const [dialog, setDialog] = useState<"none" | "erase" | "stop-saving">("none");
  const saved = history.length;

  return (
    <ScrollPage>
      <PageHeader title="Privacy and safety" backHref="/settings" backLabel="Settings" />

      <Card className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-ink">Where your information goes</h2>
        <p className="text-lg text-ink">
          Saved conversations stay on this phone only. What you say or type is sent to the assistant so it can answer you.
        </p>
      </Card>

      <Toggle
        label="Ask before doing things"
        description="I will always check with you first. Some things, like calling someone, I always check even if this is off."
        checked={settings.confirmActions}
        onChange={(confirmActions) => update({ confirmActions })}
      />

      <Toggle
        label="Remember my conversations"
        description="Keeps your past conversations so you can look at them again in History."
        checked={settings.saveHistory}
        onChange={(on) => {
          if (on) update({ saveHistory: true });
          else if (saved > 0) setDialog("stop-saving");
          else update({ saveHistory: false });
        }}
      />

      <Button variant="danger" icon={Trash2} fullWidth onClick={() => setDialog("erase")} disabled={saved === 0}>
        Erase saved conversations
      </Button>
      <p className="-mt-3 text-base text-muted" aria-live="polite">
        {saved === 0 ? "Nothing is saved right now." : `${saved} ${saved === 1 ? "conversation is" : "conversations are"} saved on this phone.`}
      </p>

      <ConfirmDialog
        open={dialog === "erase"}
        tone="danger"
        title="Erase everything?"
        description="All your saved conversations will be deleted from this phone. This cannot be undone."
        confirmLabel="Yes, erase them"
        cancelLabel="No, keep them"
        onConfirm={() => {
          eraseHistory();
          setDialog("none");
        }}
        onCancel={() => setDialog("none")}
      />
      <ConfirmDialog
        open={dialog === "stop-saving"}
        title="Also erase what is saved?"
        description="I will stop remembering new conversations. Do you want me to erase the ones already saved?"
        confirmLabel="Stop remembering and erase"
        cancelLabel="Stop remembering, keep old ones"
        tone="danger"
        onConfirm={() => {
          update({ saveHistory: false });
          eraseHistory();
          setDialog("none");
        }}
        onCancel={() => {
          update({ saveHistory: false });
          setDialog("none");
        }}
      />
    </ScrollPage>
  );
}
