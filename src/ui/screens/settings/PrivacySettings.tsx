"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { forgetAllSkills } from "@/ai/skills";
import { forgetAllLessons } from "@/lessons/store";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
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
  const [justErased, setJustErased] = useState(false);
  const announce = useAnnounce();
  const saved = history.length;

  return (
    <ScrollPage>
      <PageHeader title="Privacy and safety" backHref="/settings" backLabel="Settings" />

      <Card className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-ink">Where your information goes</h2>
        <ul className="flex list-disc flex-col gap-2 pl-6 text-lg text-ink">
          <li>
            <span className="font-bold">Kept on this phone only:</span> your saved conversations, the people you add, your
            reminders, the things you&apos;ve learned, and your settings. Companion has no accounts and no database.
          </li>
          <li>
            <span className="font-bold">Sent to answer you:</span> what you say or type, the last few messages, and any photo you
            choose to show me go to Google&apos;s Gemini AI through our server. We don&apos;t store them or write them in our logs.
          </li>
          <li>
            <span className="font-bold">Never read:</span> your text messages, call history or contacts. Phones don&apos;t allow it,
            and I don&apos;t try. I only see a contact if you pick one.
          </li>
          <li>
            <span className="font-bold">Your voice:</span> turned into words by your phone&apos;s own speech service. Only the words
            come to me.
          </li>
          <li>
            <span className="font-bold">Calls and messages:</span> I open your phone app with things filled in. You always press
            Call or Send yourself.
          </li>
        </ul>
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
        {saved === 0 ? (justErased ? "Erased. Nothing is saved on this phone now." : "Nothing is saved right now.") : `${saved} ${saved === 1 ? "conversation is" : "conversations are"} saved on this phone.`}
      </p>

      <Button
        variant="secondary"
        icon={Trash2}
        fullWidth
        onClick={() => {
          forgetAllSkills();
          forgetAllLessons();
          announce("I've forgotten what you've learned and your saved lesson cards. Next time I'll explain each step again.");
        }}
      >
        Forget my skills and lesson cards
      </Button>

      <ConfirmDialog
        open={dialog === "erase"}
        tone="danger"
        title="Erase saved conversations?"
        description="All your saved conversations will be deleted from this phone. This cannot be undone."
        confirmLabel="Yes, erase them"
        cancelLabel="No, keep them"
        onConfirm={() => {
          eraseHistory();
          setJustErased(true);
          setDialog("none");
        }}
        onCancel={() => setDialog("none")}
      />
      <ConfirmDialog
        open={dialog === "stop-saving"}
        title="Stop remembering conversations?"
        description="I won't save new conversations. What should I do with the ones already saved?"
        confirmLabel="Stop remembering and erase"
        cancelLabel="Stop remembering, keep old ones"
        tone="danger"
        onConfirm={() => {
          update({ saveHistory: false });
          eraseHistory();
          setJustErased(true);
          setDialog("none");
        }}
        onCancel={() => {
          update({ saveHistory: false });
          setDialog("none");
        }}
        dismissLabel="Cancel, keep remembering"
        onDismiss={() => setDialog("none")}
      />
    </ScrollPage>
  );
}
