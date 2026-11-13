"use client";

import { Award, GraduationCap, Printer, Sprout, Trash2, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LEVEL_NAMES, forgetAllSkills, forgetSkill, skillLevel, type Skill } from "@/ai/skills";
import { loadLessons, subscribeLessons, type Lesson } from "@/lessons/store";
import { useAnnounce } from "../a11y/LiveAnnouncer";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { ScrollPage } from "../components/ScrollPage";
import { relativeDay, titleCase, useSkills } from "./useSkills";

/** Plain, encouraging words for where they are. Never a score. */
export function skillSummary(s: Skill, language = "en-US"): string {
  const level = skillLevel(s);
  const independent = s.independent ?? 0;
  if (s.times === 0) return "Companion is still giving full guidance. That's how everyone starts.";
  if (level === 5) return `Done on your own ${independent} times. Last done ${relativeDay(s.lastDone, language)}.`;
  const times = s.times === 1 ? "once" : `${s.times} times`;
  const own = independent > 0 ? `, ${independent === 1 ? "once" : `${independent} times`} on your own` : "";
  return `Done ${times}${own}. Last done ${relativeDay(s.lastDone, language)}.`;
}

const LEVEL_ICON = { 1: Sprout, 2: GraduationCap, 3: GraduationCap, 4: GraduationCap, 5: Award } as const;

/** What next time will be like, so fading help is never a surprise. */
const NEXT_TIME: Record<number, string> = {
  1: "I'll show you every step.",
  2: "I'll give shorter steps next time.",
  3: "Next time I'll ask if you remember first, with hints if you want them.",
  4: "Next time, try the whole thing and I'll check it with you.",
  5: "You know this one. I'm still here if you want help.",
};

export function SkillsScreen() {
  const skills = useSkills();
  const announce = useAnnounce();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [confirmAll, setConfirmAll] = useState(false);
  const [language, setLanguage] = useState("en-US");

  useEffect(() => {
    const refresh = () => setLessons(loadLessons());
    refresh();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the device language after mount
    setLanguage(navigator.language || "en-US");
    return subscribeLessons(refresh);
  }, []);

  // Go home first, then start: leaving a screen stops anything in progress.
  const practise = (s: Skill) => router.push(`/?practise=${encodeURIComponent(s.name)}`);

  return (
    <ScrollPage>
      <PageHeader title="My Skills" />
      <Card>
        <p className="text-lg text-ink">
          Everything we&apos;ve worked on together. As you practise, I step back and let you try first. You can always ask me
          to show you again.
        </p>
      </Card>

      {skills && skills.length === 0 && (
        <p className="text-xl text-ink">
          Nothing here yet. Ask me how to do something, or tap Show me, and we&apos;ll learn it together.
        </p>
      )}

      {skills && skills.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="My skills">
          {skills.map((s) => {
            const level = skillLevel(s);
            const Icon = LEVEL_ICON[level];
            const lesson = lessons.find((l) => l.skill === s.name);
            return (
              <li key={s.name} className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" data-level={level}>
                <div className="flex items-start gap-4">
                  <Icon aria-hidden="true" className="mt-1 size-8 shrink-0 text-accent-ink" strokeWidth={2.25} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2 className="display text-2xl text-ink [overflow-wrap:anywhere]">{titleCase(s.name)}</h2>
                    <p className="w-fit rounded-xl bg-accent-soft px-2 py-0.5 text-lg font-bold text-ink">{LEVEL_NAMES[level]}</p>
                    <p className="text-lg text-ink">{skillSummary(s, language)}</p>
                    <p className="text-lg text-muted">{NEXT_TIME[level]}</p>
                  </div>
                </div>
                {/* Progress as five steps, labelled in words, not a percentage. */}
                <ol className="flex gap-1.5" aria-label={`Step ${level} of 5 on the way to doing it on your own`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <li key={n} aria-hidden="true" className={`h-2.5 flex-1 rounded-full ${n <= level ? "bg-accent" : "bg-surface-2"}`} />
                  ))}
                </ol>
                <Button variant="secondary" icon={Repeat} fullWidth onClick={() => practise(s)}>
                  Practise again
                </Button>
                {lesson && (
                  <Button variant="secondary" icon={Printer} fullWidth onClick={() => router.push(`/lesson?id=${encodeURIComponent(lesson.id)}`)}>
                    Print my lesson card
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon={Trash2}
                  fullWidth
                  onClick={() => {
                    forgetSkill(s.name);
                    announce("Removed.");
                  }}
                >
                  Remove from this list
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {skills && skills.length > 0 && (
        <Button variant="ghost" icon={Trash2} onClick={() => setConfirmAll(true)}>
          Clear all my skills
        </Button>
      )}
      <ConfirmDialog
        open={confirmAll}
        title="Clear all your skills?"
        description="This removes everything on this page from this phone. I'll start giving full guidance again."
        confirmLabel="Yes, clear them"
        cancelLabel="No, keep them"
        tone="danger"
        onConfirm={() => {
          forgetAllSkills();
          setConfirmAll(false);
          announce("All skills cleared.");
        }}
        onCancel={() => setConfirmAll(false)}
      />
    </ScrollPage>
  );
}
