"use client";

import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChoiceGroup, type Choice } from "../../components/ChoiceGroup";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";
import { Toggle } from "../../components/Toggle";
import { useSettings } from "../../settings/SettingsProvider";
import type { MotionChoice } from "../../settings/types";

const MOTION: Choice<MotionChoice>[] = [
  { value: "system", label: "Same as my phone", hint: "Follows your phone's own setting" },
  { value: "reduce", label: "Less movement", hint: "No pulsing or sliding" },
  { value: "full", label: "Normal movement" },
];

export function AccessibilitySettings() {
  const { settings, update, reset } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <ScrollPage>
      <PageHeader title="Accessibility" backHref="/settings" backLabel="Settings" />

      <ChoiceGroup
        legend="Movement on screen"
        value={settings.motion}
        choices={MOTION}
        onChange={(motion) => update({ motion })}
      />
      <Toggle
        label="Screen reader announcements"
        description="Speaks what is happening, such as Listening or Thinking, to screen readers like TalkBack."
        checked={settings.announcements}
        onChange={(announcements) => update({ announcements })}
      />
      <Toggle
        label="Vibration"
        description="A short buzz when I start listening, answer, or finish something."
        checked={settings.haptics}
        onChange={(haptics) => update({ haptics })}
      />

      <Card className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-ink">Always on</h2>
        <p className="text-lg text-ink">
          Every button has words on it, and works with a screen reader, a keyboard or a switch device. You can also pinch to zoom.
        </p>
      </Card>

      <Button variant="secondary" fullWidth onClick={() => setConfirmReset(true)}>
        Put all settings back to normal
      </Button>
      <ConfirmDialog
        open={confirmReset}
        title="Put settings back to normal?"
        description="Text size, colours, voice and everything else on these pages will go back to how they were at the start. Your conversations are not touched."
        confirmLabel="Yes, put them back"
        cancelLabel="No, keep my settings"
        onConfirm={() => {
          reset();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </ScrollPage>
  );
}
