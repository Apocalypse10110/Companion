"use client";

import { Award, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { forgetSkill, loadSkills, subscribeSkills, type Skill } from "@/ai/skills";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";

function when(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleDateString(language, { day: "numeric", month: "long" });
  } catch {
    return new Date(iso).toDateString();
  }
}

/**
 * Everything the person has learned to do with Companion's help. It builds confidence, and it's how
 * Companion knows to let them try on their own next time. Kept on this phone only.
 */
export function LearnedSettings() {
  const announce = useAnnounce();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [language, setLanguage] = useState("en-US");

  useEffect(() => {
    const refresh = () => setSkills(loadSkills());
    refresh();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the device language after mount
    setLanguage(navigator.language || "en-US");
    return subscribeSkills(refresh);
  }, []);

  return (
    <ScrollPage>
      <PageHeader title="Things you can do" backHref="/settings" backLabel="Settings" />
      <Card>
        <p className="text-lg text-ink">
          Each time we finish something together, I add it here. Next time, I&apos;ll let you try first and give you a hint
          if you need one.
        </p>
      </Card>

      {skills && skills.length === 0 && (
        <p className="text-xl text-ink">
          Nothing yet. Ask me how to do something on your phone, or tap &ldquo;Show me with a photo&rdquo;, and we&apos;ll learn it
          together.
        </p>
      )}

      {skills && skills.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="Things you can do">
          {skills.map((s) => (
            <li key={s.name} className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5">
              <div className="flex items-start gap-4">
                <Award aria-hidden="true" className="mt-1 size-7 shrink-0 text-accent-ink" strokeWidth={2.25} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="display text-2xl text-ink [overflow-wrap:anywhere]">{s.name[0].toUpperCase() + s.name.slice(1)}</h2>
                  <p className="text-lg text-ink">
                    {s.times === 1 ? `Learned on ${when(s.firstLearned, language)}` : `Done ${s.times} times. First learned on ${when(s.firstLearned, language)}`}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
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
          ))}
        </ul>
      )}
    </ScrollPage>
  );
}
