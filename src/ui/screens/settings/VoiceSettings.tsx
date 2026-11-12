"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { VoiceInfo } from "@/contracts";
import { useServices } from "@/integration/ServicesProvider";
import { Button } from "../../components/Button";
import { Banner } from "../../components/Card";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";
import { Stepper } from "../../components/Stepper";
import { Toggle } from "../../components/Toggle";
import { useConversation } from "../../conversation/ConversationProvider";
import { useSettings } from "../../settings/SettingsProvider";
import {
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_RATE_STEP,
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_STEP,
} from "../../settings/types";

const round1 = (n: number) => Math.round(n * 10) / 10;

export function speedWords(rate: number): string {
  if (rate <= 0.7) return "Slow";
  if (rate < 0.95) return "A little slow";
  if (rate <= 1.05) return "Normal";
  if (rate < 1.3) return "A little fast";
  return "Fast";
}

export function volumeWords(volume: number): string {
  return `${Math.round(volume * 100)} percent`;
}

const SAMPLE = "Hello, this is how I sound. I will read my answers to you like this.";

export function VoiceSettings() {
  const { settings, update } = useSettings();
  const { voiceOutput } = useServices();
  // Read from the provider, which checks the device after the page has loaded. Asking the service
  // here, while rendering, gives a different answer on the server (no speech engine) than in the
  // browser, and React then throws away the server's page (a hydration mismatch).
  const { voiceOutputSupported: supported } = useConversation();
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    voiceOutput
      .listVoices()
      .then((list) => alive && setVoices(list))
      .catch(() => {});
    return () => {
      alive = false;
      voiceOutput.cancel();
    };
  }, [voiceOutput]);

  async function play() {
    setFailed(false);
    setPlaying(true);
    try {
      await voiceOutput.speak(SAMPLE, {
        rate: settings.speechRate,
        volume: settings.volume,
        voiceId: settings.voiceId,
        language: (typeof navigator !== "undefined" && navigator.language) || "en-US",
      });
    } catch {
      setFailed(true);
    } finally {
      setPlaying(false);
    }
  }

  const rate = settings.speechRate;
  const volume = settings.volume;

  return (
    <ScrollPage>
      <PageHeader title="Voice" backHref="/settings" backLabel="Settings" />

      {!supported && (
        <Banner tone="warning" title="Reading aloud isn't connected yet">
          These settings are saved, and will be used as soon as it is.
        </Banner>
      )}

      <Toggle
        label="Read answers to me"
        description="I will say my answers out loud as well as showing them."
        checked={settings.speakReplies}
        onChange={(speakReplies) => update({ speakReplies })}
      />

      <Stepper
        label="Speaking speed"
        valueText={speedWords(rate)}
        decreaseLabel="Slower"
        increaseLabel="Faster"
        canDecrease={rate > SPEECH_RATE_MIN + 1e-9}
        canIncrease={rate < SPEECH_RATE_MAX - 1e-9}
        onDecrease={() => update({ speechRate: round1(Math.max(SPEECH_RATE_MIN, rate - SPEECH_RATE_STEP)) })}
        onIncrease={() => update({ speechRate: round1(Math.min(SPEECH_RATE_MAX, rate + SPEECH_RATE_STEP)) })}
        fraction={(rate - SPEECH_RATE_MIN) / (SPEECH_RATE_MAX - SPEECH_RATE_MIN)}
      />

      <Stepper
        label="Volume"
        valueText={volumeWords(volume)}
        decreaseLabel="Quieter"
        increaseLabel="Louder"
        canDecrease={volume > VOLUME_MIN + 1e-9}
        canIncrease={volume < VOLUME_MAX - 1e-9}
        onDecrease={() => update({ volume: round1(Math.max(VOLUME_MIN, volume - VOLUME_STEP)) })}
        onIncrease={() => update({ volume: round1(Math.min(VOLUME_MAX, volume + VOLUME_STEP)) })}
        fraction={(volume - VOLUME_MIN) / (VOLUME_MAX - VOLUME_MIN)}
      />
      <p className="-mt-3 text-base text-muted">This is my voice volume. Your phone&apos;s own volume buttons still work too.</p>

      {voices.length > 0 && (
        <ChoiceGroup
          legend="Voice"
          value={settings.voiceId ?? "__default"}
          choices={[
            { value: "__default", label: "Phone's usual voice" },
            ...voices.map((v) => ({ value: v.id, label: v.label, hint: v.language })),
          ]}
          onChange={(id) => update({ voiceId: id === "__default" ? null : id })}
        />
      )}

      {playing ? (
        <Button variant="secondary" icon={Square} fullWidth onClick={() => voiceOutput.cancel()}>
          Stop
        </Button>
      ) : (
        <Button icon={Volume2} fullWidth onClick={play} disabled={!supported}>
          Hear an example
        </Button>
      )}
      {failed && (
        <Banner tone="error" urgent title="I couldn't play that">
          Please try again in a moment.
        </Banner>
      )}
    </ScrollPage>
  );
}
