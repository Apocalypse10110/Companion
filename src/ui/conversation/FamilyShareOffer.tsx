"use client";

import { HeartHandshake, Loader2 } from "lucide-react";
import { useState } from "react";
import type { AssistantTurn } from "@/contracts";
import { requestFamilyNote } from "@/lessons/client";
import { Button } from "../components/Button";
import { useConversation } from "./ConversationProvider";

/**
 * "Would you like to share this with your family?" after a scam warning or a finished task, when
 * the reply didn't already come with a note. The note is written on request, then shown to the
 * person (they choose who, and confirm) like any other Help Card.
 */
export function FamilyShareOffer({ messageId, disabled }: { messageId: string; disabled?: boolean }) {
  const c = useConversation();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  const write = async () => {
    setState("busy");
    c.announce("Writing a short note for your family.");
    const turns: AssistantTurn[] = [];
    for (const m of c.messages) {
      if (m.role === "user" || m.role === "assistant") turns.push({ role: m.role, text: m.text });
      if (m.id === messageId) break;
    }
    try {
      c.setFamilyNote(messageId, await requestFamilyNote(turns));
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" icon={state === "busy" ? Loader2 : HeartHandshake} fullWidth disabled={disabled || state === "busy"} onClick={() => void write()}>
        {state === "busy" ? "Writing a note…" : "Share this with my family"}
      </Button>
      {state === "failed" && <p role="status" className="text-lg text-ink">I couldn&apos;t write the note just now. Please try again in a minute.</p>}
    </div>
  );
}
