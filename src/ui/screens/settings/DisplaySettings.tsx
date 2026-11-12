"use client";

import { Moon, Smartphone, Sun } from "lucide-react";
import { Card } from "../../components/Card";
import { ChoiceGroup, type Choice } from "../../components/ChoiceGroup";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";
import { Toggle } from "../../components/Toggle";
import { useSettings } from "../../settings/SettingsProvider";
import { TEXT_SCALE, TEXT_SIZE_ORDER, type TextSize, type ThemeChoice } from "../../settings/types";

const SIZE_LABELS: Record<TextSize, string> = {
  standard: "Standard",
  large: "Large",
  larger: "Larger",
  largest: "Largest",
};

/** Text size, theme and layout. Everything here changes the whole app immediately. */
export function DisplaySettings() {
  const { settings, update } = useSettings();
  const current = TEXT_SCALE[settings.textSize];

  const sizeChoices: Choice<TextSize>[] = TEXT_SIZE_ORDER.map((size) => ({
    value: size,
    label: SIZE_LABELS[size],
    preview: (
      <span className="font-bold" style={{ fontSize: `${(TEXT_SCALE[size] / current) * 1.125}rem` }}>
        Aa
      </span>
    ),
  }));

  const themeChoices: Choice<ThemeChoice>[] = [
    { value: "system", label: "Same as my phone", preview: <Smartphone className="size-7" /> },
    { value: "light", label: "Light", preview: <Sun className="size-7" /> },
    { value: "dark", label: "Dark", preview: <Moon className="size-7" /> },
  ];

  return (
    <ScrollPage>
      <PageHeader title="Text and looks" backHref="/settings" backLabel="Settings" />

      <Card aria-label="Preview" className="flex flex-col gap-2">
        <p className="text-base font-bold text-muted">Preview</p>
        <p className="text-xl text-ink">This is how your text will look.</p>
      </Card>

      <ChoiceGroup
        legend="Text size"
        value={settings.textSize}
        choices={sizeChoices}
        onChange={(textSize) => update({ textSize })}
      />
      <Toggle
        label="Bold text"
        description="Makes all words thicker and easier to see."
        checked={settings.boldText}
        onChange={(boldText) => update({ boldText })}
      />
      <ChoiceGroup legend="Colours" value={settings.theme} choices={themeChoices} onChange={(theme) => update({ theme })} />
      <Toggle
        label="High contrast"
        description="Stronger colours and thicker outlines."
        checked={settings.highContrast}
        onChange={(highContrast) => update({ highContrast })}
      />
      <Toggle
        label="Extra large buttons"
        description="Makes every button taller and easier to hit."
        checked={settings.extraLargeButtons}
        onChange={(extraLargeButtons) => update({ extraLargeButtons })}
      />
      <Toggle
        label="Extra space"
        description="More room between things on every screen."
        checked={settings.roomySpacing}
        onChange={(roomySpacing) => update({ roomySpacing })}
      />
      <Toggle
        label="Show quick buttons"
        description="Call, Messages, Reminders and Help on the home screen."
        checked={settings.showQuickActions}
        onChange={(showQuickActions) => update({ showQuickActions })}
      />
    </ScrollPage>
  );
}
