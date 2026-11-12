"use client";

import { Keyboard, Repeat, RotateCcw } from "lucide-react";
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
  // While Companion is waiting for a yes or no, keep the screen to that one question.
  const awaitingAnswer = c.messages.some((m) => m.actions?.some((a) => a.status === "proposed"));
  // "Repeat that": only offered when there is a reply to repeat and the device can speak it.
  const canRepeat = c.voiceOutputSupported && c.messages.some((m) => m.role === "assistant");

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
    // On a small screen with big text even the question can be taller than the view:
    // then the Yes / No buttons are what must be on screen.
    const answers = pending?.querySelector<HTMLElement>("[data-answers]") ?? pending;
    if (pending && answers && target.offsetHeight > el.clientHeight) answers.scrollIntoView({ block: "nearest", behavior });
    else target.scrollIntoView({ block: "start", behavior });
  }, [hasMessages, c.messages.length, thinking, motionReduced]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-1 *:shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="display text-[2.375rem] text-ink">{greeting}</h1>
          <p className="text-xl text-muted">How can I help you today?</p>
        </div>

        {c.voiceInputSupported === false && (
          <Banner tone="info" title="Typing for now">
            Talking isn&apos;t available on this device yet, so type to me below.
          </Banner>
        )}

        {hasMessages ? (
          <>
            <Thread />
            {canRepeat && (
              <Button variant="secondary" icon={Repeat} fullWidth onClick={c.repeatLast} disabled={c.phase === "thinking"}>
                Repeat that
              </Button>
            )}
            {!awaitingAnswer && (
              <div>
                <Button variant="ghost" icon={RotateCcw} onClick={c.newConversation} disabled={c.phase === "thinking"}>
                  Start a new conversation
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-xl text-ink">
            {typing ? "Type what you need, like" : "Tap the big button and say what you need, like"} “{SAY_EXAMPLES[0]}”.
          </p>
        )}

        {settings.showQuickActions && !awaitingAnswer && (
          <QuickActions compact={hasMessages} onSelect={c.sendQuickAction} disabled={c.phase === "thinking"} />
        )}
      </div>

      <section aria-label="Talk or type" className="relative shrink-0">
        {/* What is being heard floats ABOVE the panel, so the panel (and the mic in it)
            never changes height or position while someone is talking. */}
        {c.phase === "listening" && (
          <p
            role="status"
            className="bw absolute inset-x-4 bottom-full mb-3 max-h-[8lh] overflow-y-auto rounded-2xl bg-accent-soft px-4 py-3 text-xl text-ink shadow-soft"
            data-testid="interim"
          >
            {c.interim || "I'm listening…"}
          </p>
        )}
        <div className="bw max-h-[55dvh] overflow-y-auto rounded-t-[1.75rem] border-b-0 bg-surface px-4 pb-4 pt-5">

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
          >
            {/* The keyboard icon steps aside when the words would not otherwise fit (the threshold
                is in rem, so it scales with the text size); the words always stay. */}
            <Button
              variant="ghost"
              icon={Keyboard}
              className="-ml-3 max-w-[calc(100%+0.75rem)] px-3! py-1! [&>svg]:hidden @[9.5rem]:[&>svg]:block"
              onClick={() => setWantsTyping(true)}
            >
              Type instead
            </Button>
          </MicButton>
        )}
        </div>
      </section>
    </div>
  );
}
