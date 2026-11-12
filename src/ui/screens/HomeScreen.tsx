"use client";

import { Keyboard, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Banner } from "../components/Card";
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

  // Keep the thing the person needs to read in view, once there is a conversation.
  // While waiting, show their own question; when a reply arrives, show the TOP of that reply
  // (never scroll past it to whatever sits underneath). An empty home screen stays at the top.
  const thinking = c.phase === "thinking";
  useEffect(() => {
    const el = scroller.current;
    if (!el || !hasMessages) return;
    const items = el.querySelectorAll<HTMLElement>('[data-testid="thread"] > li');
    const target = thinking ? items[items.length - 2] : items[items.length - 1];
    if (!target) return;
    const behavior = motionReduced ? "auto" : "smooth";
    // A question waiting for Yes/No matters most. If the whole reply is too tall to fit,
    // make sure that question (with its buttons) is what stays visible.
    const pending = !thinking ? target.querySelector<HTMLElement>('[data-status="proposed"]') : null;
    if (pending && target.offsetHeight > el.clientHeight) pending.scrollIntoView({ block: "nearest", behavior });
    else target.scrollIntoView({ block: "start", behavior });
  }, [hasMessages, c.messages.length, thinking, motionReduced]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-1">
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
          <p className="text-xl text-ink">
            {typing ? "Type what you need, like" : "Tap the big button and say what you need, like"} “{SAY_EXAMPLES[0]}”.
          </p>
        )}

        {settings.showQuickActions && (
          <QuickActions compact={hasMessages} onSelect={c.sendQuickAction} disabled={c.phase === "thinking"} />
        )}
      </div>

      <section aria-label="Talk or type" className="bw max-h-[55%] shrink-0 overflow-y-auto rounded-t-3xl border-b-0 bg-surface px-4 pb-3 pt-3 shadow-soft">
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
          <MicButton
            phase={c.phase}
            onPress={c.pressMic}
            level={c.level}
            reduceMotion={motionReduced}
            compact={hasMessages}
          >
            <Button variant="ghost" icon={Keyboard} className="-ml-3 px-3! py-1!" onClick={() => setWantsTyping(true)}>
              Type instead
            </Button>
          </MicButton>
        )}
      </section>
    </div>
  );
}
