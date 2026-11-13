import { Award, GraduationCap, Hand } from "lucide-react";
import type { AssistantReply } from "@/contracts";

type Lesson = NonNullable<AssistantReply["lesson"]>;

function sentence(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Shows that Companion is teaching, not just answering. First time: "Teaching you: …".
 * Done before: "try it yourself". Finished: "Learned: …", with what happens next time.
 * Words and an icon, never colour alone.
 */
export function LessonBadge({ lesson }: { lesson: Lesson }) {
  const [Icon, text] =
    lesson.stage === "learned"
      ? [Award, `Learned: ${sentence(lesson.skill)}`]
      : lesson.stage === "practice"
        ? [Hand, "You've done this before: try it yourself"]
        : [GraduationCap, `Teaching you: ${sentence(lesson.skill)}`];
  return (
    <div className="flex flex-col gap-1 self-start rounded-2xl bg-accent-soft px-3 py-2" data-lesson={lesson.stage}>
      <p className="flex items-center gap-2 text-lg font-bold text-ink">
        <Icon aria-hidden="true" className="size-6 shrink-0 text-accent-ink" strokeWidth={2.25} />
        <span>{text}</span>
      </p>
      {lesson.stage === "learned" && (
        <p className="text-base text-ink">Next time I&apos;ll let you try first. See it in Settings, Things you can do.</p>
      )}
    </div>
  );
}
