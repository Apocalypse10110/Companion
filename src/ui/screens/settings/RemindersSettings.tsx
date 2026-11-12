"use client";

import { BellRing, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { describeWhen } from "@/ai/intents/time";
import { loadReminders, removeReminder, subscribeReminders, type Reminder } from "@/actions/reminders";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";

/** Every reminder Companion has been asked to set, with a way to remove each one. */
export function RemindersSettings() {
  const announce = useAnnounce();
  const [list, setList] = useState<Reminder[] | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = () => {
      setList(loadReminders());
      setNow(new Date());
    };
    refresh();
    return subscribeReminders(refresh);
  }, []);

  return (
    <ScrollPage>
      <PageHeader title="Reminders" backHref="/settings" backLabel="Settings" />
      <Card>
        <p className="text-lg text-ink">
          To add one, go to the Talk screen and say something like &ldquo;remind me to take my pills at 8&rdquo;. Keep Companion open
          so I can remind you.
        </p>
      </Card>

      {list && list.length === 0 && <p className="text-xl text-ink">You don&apos;t have any reminders.</p>}

      {list && list.length > 0 && now && (
        <ul className="flex flex-col gap-4" aria-label="Your reminders">
          {list.map((r) => (
            <li key={r.id} className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5">
              <div className="flex items-start gap-4">
                <BellRing aria-hidden="true" className="mt-1 size-7 shrink-0 text-accent-ink" strokeWidth={2.25} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="display text-2xl text-ink [overflow-wrap:anywhere]">{r.text}</h2>
                  <p className="text-lg text-ink">
                    {capitalize(describeWhen(new Date(r.at), now))}
                    {r.recurrence === "daily" ? ", every day" : r.recurrence === "weekly" ? ", every week" : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={Trash2}
                fullWidth
                onClick={() => {
                  removeReminder(r.id);
                  announce("Reminder removed.");
                }}
              >
                Remove this reminder
              </Button>
            </li>
          ))}
        </ul>
      )}
    </ScrollPage>
  );
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
