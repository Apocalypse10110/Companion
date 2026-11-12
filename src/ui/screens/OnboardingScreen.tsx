"use client";

import { Accessibility, Eye, Hand, Lock, Mic, Moon, Smartphone, Sun, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PermissionState } from "@/contracts";
import { useServices } from "@/integration/ServicesProvider";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/Button";
import { Banner, Card } from "../components/Card";
import { ChoiceGroup, type Choice } from "../components/ChoiceGroup";
import { ListLink } from "../components/ListLink";
import { ScrollPage } from "../components/ScrollPage";
import { Toggle } from "../components/Toggle";
import { useSettings } from "../settings/SettingsProvider";
import { TEXT_SCALE, TEXT_SIZE_ORDER, type TextSize, type ThemeChoice } from "../settings/types";

const STEPS = ["welcome", "talking", "comfort", "microphone", "finish"] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  welcome: "Hello, and welcome",
  talking: "How talking works",
  comfort: "Make it comfortable",
  microphone: "Letting me hear you",
  finish: "You're all set",
};

const SIZE_LABELS: Record<TextSize, string> = { standard: "Standard", large: "Large", larger: "Larger", largest: "Largest" };

function Numbered({ n, icon: Icon, children }: { n: number; icon: typeof Mic; children: string }) {
  return (
    <li className="bw flex items-center gap-4 rounded-2xl bg-surface p-4">
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-xl font-bold text-on-accent">
        {n}
      </span>
      <Icon aria-hidden="true" className="size-8 shrink-0 text-ink" strokeWidth={2.25} />
      <span className="text-xl text-ink">{children}</span>
    </li>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const { settings, update } = useSettings();
  const { permissions } = useServices();
  const [index, setIndex] = useState(0);
  const [mic, setMic] = useState<PermissionState | "unknown">("unknown");
  const heading = useRef<HTMLHeadingElement>(null);
  const step = STEPS[index];
  const first = index === 0;
  const last = index === STEPS.length - 1;
  const current = TEXT_SCALE[settings.textSize];

  // Move focus to each new step's heading so screen readers start reading it.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) heading.current?.focus();
    mounted.current = true;
  }, [index]);

  // Only look at the microphone state (never ask) when that step is shown.
  useEffect(() => {
    if (step !== "microphone") return;
    let alive = true;
    permissions
      .check("microphone")
      .then((s) => alive && setMic(s))
      .catch(() => alive && setMic("unsupported"));
    return () => {
      alive = false;
    };
  }, [step, permissions]);

  function finish() {
    update({ onboardingComplete: true });
    router.replace("/");
  }

  async function allowMicrophone() {
    try {
      setMic(await permissions.request("microphone"));
    } catch {
      setMic("unsupported");
    }
  }

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
      <p className="text-lg font-bold text-muted" data-testid="progress">
        Step {index + 1} of {STEPS.length}
      </p>
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold leading-tight text-ink outline-none">
        {TITLES[step]}
      </h1>

      {step === "welcome" && (
        <>
          <BrandMark showTagline />
          <p className="text-xl text-ink">
            I&apos;m a helper that listens. Tell me what you need, and I&apos;ll help your phone do it, like calling someone or setting a reminder.
          </p>
          <p className="text-xl text-ink">This takes about a minute. You can skip it at any time.</p>
        </>
      )}

      {step === "talking" && (
        <>
          <ol className="flex flex-col gap-3">
            <Numbered n={1} icon={Mic}>Tap the big orange button.</Numbered>
            <Numbered n={2} icon={Hand}>Say what you need, then tap it again.</Numbered>
            <Numbered n={3} icon={Volume2}>Listen to my answer, or read it on the screen.</Numbered>
          </ol>
          <p className="text-xl text-ink">Prefer typing? You can always type instead.</p>
        </>
      )}

      {step === "comfort" && (
        <>
          <p className="text-xl text-ink">Pick what is easiest to read. You can change this later in Settings.</p>
          <ChoiceGroup legend="Text size" value={settings.textSize} choices={sizeChoices} onChange={(textSize) => update({ textSize })} />
          <ChoiceGroup legend="Colours" value={settings.theme} choices={themeChoices} onChange={(theme) => update({ theme })} />
          <Toggle label="High contrast" description="Stronger colours and thicker outlines." checked={settings.highContrast} onChange={(highContrast) => update({ highContrast })} />
        </>
      )}

      {step === "microphone" && (
        <>
          <p className="text-xl text-ink">
            To hear you, I need to use the microphone. I only listen while you are using the big button. I will ask for other things, like making calls, only when you need them.
          </p>
          {mic === "granted" && (
            <Banner tone="success" title="Microphone is on">
              I can hear you when you tap the big button.
            </Banner>
          )}
          {mic === "denied" && (
            <Banner tone="warning" title="Microphone is off">
              You can turn it on in your phone&apos;s Settings. Until then, you can type to me.
            </Banner>
          )}
          {mic === "unsupported" && (
            <Banner tone="info" title="Not available yet">
              Talking isn&apos;t available on this device right now. You can type to me instead.
            </Banner>
          )}
          {(mic === "unknown" || mic === "prompt") && (
            <Button icon={Mic} fullWidth onClick={allowMicrophone}>
              Allow microphone
            </Button>
          )}
        </>
      )}

      {step === "finish" && (
        <>
          <p className="text-xl text-ink">You can change any of these whenever you like:</p>
          <ul className="flex flex-col gap-3">
            <li><ListLink href="/settings/display" icon={Eye} title="Text and looks" /></li>
            <li><ListLink href="/settings/voice" icon={Volume2} title="Voice" /></li>
            <li><ListLink href="/settings/accessibility" icon={Accessibility} title="Accessibility" /></li>
            <li><ListLink href="/settings/privacy" icon={Lock} title="Privacy and safety" /></li>
          </ul>
          <Card>
            <p className="text-lg text-ink">Find these any time with Settings at the bottom of the screen.</p>
          </Card>
        </>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        {last ? (
          <Button fullWidth onClick={finish}>
            Start using Companion
          </Button>
        ) : (
          <Button fullWidth onClick={() => setIndex((i) => i + 1)}>
            {first ? "Get started" : step === "microphone" && mic !== "granted" ? "Skip for now" : "Next"}
          </Button>
        )}
        {!first && (
          <Button variant="secondary" fullWidth onClick={() => setIndex((i) => i - 1)}>
            Back
          </Button>
        )}
        {!last && (
          <Button variant="ghost" fullWidth onClick={finish}>
            Skip the walkthrough
          </Button>
        )}
      </div>
    </ScrollPage>
  );
}
