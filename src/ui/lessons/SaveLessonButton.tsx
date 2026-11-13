"use client";

import { BookmarkPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AssistantTurn } from "@/contracts";
import { requestLessonCard } from "@/lessons/client";
import { saveLesson } from "@/lessons/store";
import { Button } from "../components/Button";
import { useConversation } from "../conversation/ConversationProvider";

/** Without the AI, a card can still be made from Companion's own steps in the conversation. */
export function lessonFromTurns(skill: string, turns: AssistantTurn[]) {
  const steps = turns
    .filter((t) => t.role === "assistant")
    .map((t) => t.text.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0)
    .slice(-8);
  return {
    title: `How to ${skill}`,
    steps: steps.length ? steps : [`Ask Companion: "How do I ${skill}?"`],
    troubleshooting: ["If you get stuck, ask Companion to show you again."],
  };
}

/**
 * "Save this lesson for next time": Companion writes the steps that worked as a printable card,
 * keeps it on this phone, and opens it ready to print.
 */
export function SaveLessonButton({ skill, disabled }: { skill: string; disabled?: boolean }) {
  const c = useConversation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    c.announce("Preparing your lesson card.");
    const turns: AssistantTurn[] = c.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as AssistantTurn["role"], text: m.text }));
    let card;
    try {
      card = await requestLessonCard(skill, turns);
    } catch {
      card = lessonFromTurns(skill, turns);
    }
    const lesson = saveLesson({ skill, ...card });
    setBusy(false);
    router.push(`/lesson?id=${encodeURIComponent(lesson.id)}`);
  };

  return (
    <Button variant="secondary" icon={busy ? Loader2 : BookmarkPlus} fullWidth disabled={disabled || busy} onClick={() => void save()}>
      {busy ? "Preparing your lesson card…" : "Save this lesson for next time"}
    </Button>
  );
}
