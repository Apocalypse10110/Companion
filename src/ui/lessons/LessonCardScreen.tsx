"use client";

import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getLesson, loadLessons, removeLesson, type Lesson } from "@/lessons/store";
import { Button } from "../components/Button";
import { ScrollPage } from "../components/ScrollPage";

/**
 * The Fridge Card: a finished lesson as a printable page. Black on white, large type, numbered
 * steps, no background colours (saves ink), and it makes sense without the app.
 */
export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <article className="lesson-card flex flex-col gap-5 rounded-3xl border-4 border-ink bg-surface p-5 text-ink" aria-label="Lesson card">
      <h1 className="display text-[2rem] font-bold uppercase leading-tight">{lesson.title}</h1>
      <ol className="flex flex-col gap-4">
        {lesson.steps.map((step, i) => (
          <li key={i} className="flex gap-4 text-2xl leading-snug">
            <span aria-hidden="true" className="lesson-num flex size-11 shrink-0 items-center justify-center rounded-full border-4 border-ink text-2xl font-bold">
              {i + 1}
            </span>
            <span className="pt-1">
              <span className="sr-only">Step {i + 1}: </span>
              {step}
            </span>
          </li>
        ))}
      </ol>
      {lesson.troubleshooting.length > 0 && (
        <section className="flex flex-col gap-2 border-t-4 border-ink pt-4">
          <h2 className="text-2xl font-bold">If it doesn&apos;t work</h2>
          <ul className="flex list-disc flex-col gap-2 pl-7 text-xl">
            {lesson.troubleshooting.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="border-t-4 border-ink pt-4 text-xl">
        Stuck? Open <strong>Companion</strong> and say what&apos;s happening. I can help again any time.
      </p>
    </article>
  );
}

export function LessonCardScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [others, setOthers] = useState<Lesson[]>([]);

  useEffect(() => {
    // Lessons live on this phone only, so they're read in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after mount
    setLesson(id ? getLesson(id) : null);
    setOthers(loadLessons());
  }, [id]);

  if (lesson === undefined) return null;

  return (
    <ScrollPage>
      <div className="no-print flex flex-col gap-3">
        <Link href="/skills" className="-ml-2 inline-flex min-h-[var(--target)] w-fit items-center gap-1.5 rounded-2xl px-3 text-lg font-bold text-ink hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-6" />
          My Skills
        </Link>
      </div>
      {lesson ? (
        <>
          <LessonCard lesson={lesson} />
          <div className="no-print flex flex-col gap-3">
            <Button icon={Printer} fullWidth onClick={() => window.print()}>
              Print this card
            </Button>
            <p className="text-lg text-muted">Saved on this phone. Print it and keep it by the fridge or your computer.</p>
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={() => {
                removeLesson(lesson.id);
                router.push("/skills");
              }}
            >
              Delete this card
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="display text-3xl text-ink">Lesson cards</h1>
          {others.length === 0 ? (
            <p className="text-xl text-ink">
              No saved lessons yet. When we finish a task together, tap &ldquo;Save this lesson for next time&rdquo;.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {others.map((l) => (
                <li key={l.id}>
                  <Link href={`/lesson?id=${encodeURIComponent(l.id)}`} className="bw flex min-h-[var(--target)] items-center rounded-2xl bg-surface px-4 py-3 text-xl font-bold text-ink">
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ScrollPage>
  );
}
