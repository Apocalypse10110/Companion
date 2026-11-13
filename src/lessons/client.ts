/**
 * Asks this app's server to write a lesson card or family note from the conversation.
 * Phone numbers are removed before anything leaves the phone.
 */
import type { AssistantTurn } from "@/contracts";
import { redactPhoneNumbers } from "@/ai/providers/redact";
import { cleanFamilyNote } from "@/ai/target";
import { cleanLesson } from "./store";

async function post(body: unknown, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const tidy = (turns: AssistantTurn[]) => turns.map((t) => ({ role: t.role, text: redactPhoneNumbers(t.text) }));

export async function requestLessonCard(skill: string, history: AssistantTurn[], signal?: AbortSignal) {
  const lesson = cleanLesson(await post({ kind: "lesson", skill, history: tidy(history) }, signal));
  if (!lesson) throw new Error("Bad lesson");
  return lesson;
}

export async function requestFamilyNote(history: AssistantTurn[], signal?: AbortSignal): Promise<string> {
  const data = (await post({ kind: "family", history: tidy(history) }, signal)) as { note?: unknown };
  const note = cleanFamilyNote(data?.note);
  if (!note) throw new Error("Bad note");
  return note;
}
