"use client";

import { Keyboard, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Banner, Card } from "../components/Card";
import { Button } from "../components/Button";
import { MicButton } from "../components/MicButton";
import { Composer } from "../conversation/Composer";
import { useConversation } from "../conversation/ConversationProvider";
import { QuickActions } from "../conversation/QuickActions";
import { Thread } from "../conversation/Thread";
import { SAY_EXAMPLES } from "../conversation/types";
import { useSettings } from "../settings/SettingsProvider";

function greetingFor(hour: number): string {
  if (hour < 5) return "Hello";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const c = useConversation();
  const { settings, motionReduced } = useSettings();
  const [wantsTyping, setWantsTyping] = useState(false);
  const [greeting, setGreeting] = useState("Hello");
  const scroller = useRef<HTMLDivElement>(null);

  // Time of day is only known on the device, so it is set after the first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the device clock after mount
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  // If talking is impossible here, typing is the only way, so open it straight away.
  const typing = wantsTyping || c.voiceInputSupported === false;
  const hasMessages = c.messages.length > 0;

  // Keep the newest thing in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: motionReduced ? "auto" : "smooth" });
  }, [c.messages.length, c.phase, c.partial, motionReduced]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-4 pt-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold leading-tight text-ink">{greeting}</h1>
          <p className="text-xl text-muted">How can I help you today?</p>
        </div>

        {c.voiceInputSupported === false && (
          <Banner tone="warning" title="Talking isn't available yet">
            You can still type to me below.
          </Banner>
        )}

        {hasMessages ? (
          <>
            <Thread />
            <div>
              <Button variant="ghost" icon={RotateCcw} onClick={c.newConversation} disabled={c.phase === "thinking"}>
                Start a new conversation
              </Button>
            </div>
          </>
        ) : (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">{typing ? "Type what you need" : "Tap the big button and talk"}</h2>
            <p className="text-lg text-ink">You could say:</p>
            <ul className="flex flex-col gap-2">
              {SAY_EXAMPLES.map((e) => (
                <li key={e} className="text-lg text-muted">
                  “{e}”
                </li>
              ))}
            </ul>
          </Card>
        )}

        {settings.showQuickActions && (
          <QuickActions compact={hasMessages} onSelect={c.sendQuickAction} disabled={c.phase === "thinking"} />
        )}
      </div>

      <section aria-label="Talk or type" className="bw shrink-0 rounded-t-3xl border-b-0 bg-surface px-5 pb-4 pt-4 shadow-soft">
        {c.phase === "listening" && (
          <p role="status" className="mb-3 min-h-[2lh] rounded-2xl bg-primary-soft px-4 py-3 text-xl text-ink" data-testid="interim">
            {c.interim || "I'm listening…"}
          </p>
        )}

        {typing ? (
          <Composer
            onSend={c.sendText}
            disabled={c.phase === "thinking"}
            onUseMicrophone={c.voiceInputSupported === false ? undefined : () => setWantsTyping(false)}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <MicButton phase={c.phase} onPress={c.pressMic} level={c.level} reduceMotion={motionReduced} />
            <Button variant="ghost" icon={Keyboard} onClick={() => setWantsTyping(true)}>
              Type instead
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
