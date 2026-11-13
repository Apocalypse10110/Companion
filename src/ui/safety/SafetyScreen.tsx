"use client";

import { Camera, Drama, Ear, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { ScrollPage } from "../components/ScrollPage";
import { useConversation } from "../conversation/ConversationProvider";
import { ShowMeButton } from "../conversation/ShowMeButton";
import { Thread } from "../conversation/Thread";

/** General warning signs. Plain advice, not a detector. */
const SIGNS = [
  "It's urgent or threatening: “act now”, “your account will close”, “you'll be fined”.",
  "It asks for a code, PIN, password or card number. Real companies never ask for these.",
  "It wants payment by gift card, bank transfer, crypto, or a small “fee” through a link.",
  "A family member texts from a new number and suddenly needs money.",
  "It asks you to keep it secret, or to call a number it gives you.",
];

export function scamQuestion(text: string): string {
  return `Is this message real, or is it a scam? "${text.trim().slice(0, 1200)}"`;
}

/**
 * The Scam Protection Center: paste a message or photograph it, and Companion explains what looks
 * wrong and how to check safely. Results are a warning, never a guarantee.
 */
export function SafetyScreen() {
  const c = useConversation();
  const [text, setText] = useState("");
  const id = useId();
  const busy = c.phase === "thinking";
  const checked = c.messages.some((m) => m.role === "assistant" && m.scam);

  return (
    <ScrollPage>
      <PageHeader title="Safety" />
      <p className="text-xl text-ink">Got a text, email, letter or pop-up that worries you? Show me, and I&apos;ll tell you what looks wrong.</p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          c.sendText(scamQuestion(text), "scam", { fresh: true });
          setText("");
        }}
      >
        <label htmlFor={id} className="text-lg font-bold text-ink">
          Paste or type the message
        </label>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1500}
          className="bw w-full rounded-2xl bg-surface px-4 py-3 text-xl text-ink"
          placeholder="For example: Your parcel is on hold. Pay £1.45 at…"
        />
        <Button type="submit" icon={ShieldQuestion} fullWidth disabled={busy || !text.trim()}>
          Check this message
        </Button>
      </form>

      <ShowMeButton
        onPhoto={(f) => c.sendPhoto(f, undefined, "scam", { fresh: true })}
        disabled={busy}
        label="Check a photo or screenshot"
        icon={Camera}
        noScreen
      />

      {(checked || busy) && <Thread />}

      <Card>
        <h2 className="mb-2 text-xl font-bold text-ink">Common signs of a scam</h2>
        <ul className="flex list-disc flex-col gap-2 pl-6 text-lg text-ink">
          {SIGNS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-3 text-lg text-ink">
          Not sure? Don&apos;t tap anything in it. Call the company using the number on your card or bill, not one in the message.
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        <Link href="/safety/listen" className="bw flex min-h-[var(--target)] items-center gap-3 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink hover:bg-surface-2">
          <Ear aria-hidden="true" className="size-6 shrink-0" />
          Listen to a call on another phone
        </Link>
        <Link href="/scam-bait" className="bw flex min-h-[var(--target)] items-center gap-3 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink hover:bg-surface-2">
          <Drama aria-hidden="true" className="size-6 shrink-0" />
          Scam Bait: waste a scammer&apos;s time
        </Link>
      </div>
    </ScrollPage>
  );
}
