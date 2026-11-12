"use client";

import { BellOff, BellRing, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { describeWhen } from "@/ai/intents/time";
import {
  addReminder,
  completeReminder,
  loadReminders,
  pastReminders,
  removeReminder,
  subscribeReminders,
  updateReminder,
  upcomingReminders,
  type Recurrence,
  type Reminder,
} from "@/actions/reminders";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
import { Button } from "../../components/Button";
import { Banner, Card } from "../../components/Card";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";
import { Toggle } from "../../components/Toggle";

const FIELD = "bwc w-full rounded-2xl bg-surface px-4 py-3 text-xl text-ink placeholder:text-muted";
type Repeat = "none" | Recurrence;

interface Draft {
  id?: string;
  text: string;
  description: string;
  date: string;
  time: string;
  repeat: Repeat;
  notify: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function blankDraft(): Draft {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  return { text: "", description: "", date: toDate(d), time: toTime(d), repeat: "none", notify: true };
}

function draftFrom(r: Reminder): Draft {
  const d = new Date(r.at);
  return { id: r.id, text: r.text, description: r.description ?? "", date: toDate(d), time: toTime(d), repeat: r.recurrence ?? "none", notify: r.notify !== false };
}

function hasPassed(at: Date): boolean {
  return at.getTime() <= Date.now();
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Settings -> Reminders: add, change, finish and remove reminders. Kept on this phone. */
export function RemindersSettings() {
  const announce = useAnnounce();
  const ids = { text: useId(), desc: useId(), date: useId(), time: useId(), form: useId() };
  const [upcoming, setUpcoming] = useState<Reminder[] | null>(null);
  const [past, setPast] = useState<Reminder[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Reminder | null>(null);

  useEffect(() => {
    const refresh = () => {
      const n = new Date();
      setNow(n);
      setUpcoming(upcomingReminders(n));
      setPast(pastReminders(n).slice(0, 20));
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    const off = subscribeReminders(refresh);
    return () => {
      clearInterval(timer);
      off();
    };
  }, []);

  function say(text: string, urgent = false) {
    announce(text, urgent ? "assertive" : "polite");
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.text.trim()) return fail("Please type what to remind you about.");
    const at = new Date(`${draft.date}T${draft.time}`);
    if (Number.isNaN(at.getTime())) return fail("Please choose a date and a time.");
    if (hasPassed(at) && draft.repeat === "none") return fail("That time has already passed. Please choose a later time.");
    const input = {
      text: draft.text,
      description: draft.description,
      at: at.toISOString(),
      recurrence: draft.repeat === "none" ? undefined : draft.repeat,
      notify: draft.notify,
    };
    try {
      const r = draft.id ? updateReminder(draft.id, input) : addReminder(input);
      // Only say it's saved once it really is on the phone.
      if (!r || !loadReminders().some((x) => x.id === r.id)) throw new Error("not saved");
      const text = `${draft.id ? "Changed" : "Saved"}: ${r.text}, ${describeWhen(new Date(r.at), new Date())}.`;
      setDraft(null);
      setProblem(null);
      setDone(text);
      say(text);
    } catch {
      fail("I couldn't save that on this phone. Please try again.");
    }
  }

  function fail(text: string) {
    setProblem(text);
    setDone(null);
    say(text, true);
  }

  const repeatChoices = [
    { value: "none" as const, label: "Just once" },
    { value: "daily" as const, label: "Every day" },
    { value: "weekly" as const, label: "Every week, same day" },
  ];

  function row(r: Reminder, isPast: boolean) {
    const when = now ? capitalize(describeWhen(new Date(r.at), now)) : "";
    const repeat = r.recurrence === "daily" ? ", every day" : r.recurrence === "weekly" ? ", every week" : "";
    return (
      <li key={r.id} className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5" data-done={Boolean(r.completedAt)}>
        <div className="flex items-start gap-4">
          {r.notify === false ? (
            <BellOff aria-hidden="true" className="mt-1 size-7 shrink-0 text-muted" strokeWidth={2.25} />
          ) : (
            <BellRing aria-hidden="true" className="mt-1 size-7 shrink-0 text-accent-ink" strokeWidth={2.25} />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="display text-2xl text-ink [overflow-wrap:anywhere]">{r.text}</h3>
            {r.description && <p className="text-lg text-ink [overflow-wrap:anywhere]">{r.description}</p>}
            <p className="text-lg text-ink">
              {when}
              {repeat}
            </p>
            <p className="text-base text-muted">
              {r.completedAt ? "Done" : isPast ? "Missed" : r.notify === false ? "No phone notification (I'll still remind you on screen)" : "With a phone notification"}
            </p>
          </div>
        </div>
        {!r.completedAt && (
          <Button
            variant="secondary"
            icon={Check}
            fullWidth
            onClick={() => {
              completeReminder(r.id);
              say(r.recurrence ? "Done. I'll remind you again next time." : "Marked as done.");
            }}
          >
            {r.recurrence ? "Done for this time" : "Mark as done"}
          </Button>
        )}
        <Button variant="secondary" icon={Pencil} fullWidth onClick={() => { setDraft(draftFrom(r)); setDone(null); }}>
          Change
        </Button>
        <Button variant="secondary" icon={Trash2} fullWidth onClick={() => setRemoving(r)}>
          Remove
        </Button>
      </li>
    );
  }

  return (
    <ScrollPage>
      <PageHeader title="Reminders" backHref="/settings" backLabel="Settings" />
      <Card>
        <p className="text-lg text-ink">
          Add one here, or just tell me: &ldquo;remind me to take my pills at 8&rdquo;. I remind you on screen and out loud, and with a phone
          notification if you allow it. Keep Companion open (or on your home screen) so I can.
        </p>
      </Card>

      {done && <Banner tone="success">{done}</Banner>}

      {!draft && (
        <Button icon={Plus} fullWidth onClick={() => { setDraft(blankDraft()); setDone(null); setProblem(null); }}>
          Add a reminder
        </Button>
      )}

      {draft && (
        <form onSubmit={save} className="bw flex flex-col gap-4 rounded-3xl bg-surface p-5" aria-labelledby={ids.form}>
          <h2 id={ids.form} className="display text-2xl text-ink">
            {draft.id ? "Change reminder" : "New reminder"}
          </h2>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.text} className="text-lg font-bold text-ink">What to remember</label>
            <input id={ids.text} className={FIELD} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Take my pills" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.desc} className="text-lg font-bold text-ink">
              Details <span className="font-normal">(you can leave this empty)</span>
            </label>
            <textarea id={ids.desc} rows={2} className={FIELD} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="The blue box, with water" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.date} className="text-lg font-bold text-ink">Day</label>
            <input id={ids.date} type="date" className={FIELD} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.time} className="text-lg font-bold text-ink">Time</label>
            <input id={ids.time} type="time" className={FIELD} value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
          </div>
          <ChoiceGroup legend="Repeat" value={draft.repeat} choices={repeatChoices} onChange={(repeat) => setDraft({ ...draft, repeat })} columns={1} />
          <Toggle
            label="Phone notification"
            description="Also show a notification on your phone, if you've allowed them. I always remind you on screen and out loud."
            checked={draft.notify}
            onChange={(notify) => setDraft({ ...draft, notify })}
          />
          {problem && (
            <Banner tone="error" title="Not saved yet" urgent>
              {problem}
            </Banner>
          )}
          <Button type="submit" fullWidth>
            {draft.id ? "Save changes" : "Save reminder"}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => { setDraft(null); setProblem(null); }}>
            Cancel
          </Button>
        </form>
      )}

      <section aria-labelledby="up-title" className="flex flex-col gap-4">
        <h2 id="up-title" className="display text-2xl text-ink">Coming up</h2>
        {upcoming && upcoming.length === 0 && <p className="text-xl text-ink">No reminders coming up.</p>}
        {upcoming && upcoming.length > 0 && <ul className="flex flex-col gap-4">{upcoming.map((r) => row(r, false))}</ul>}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-title" className="flex flex-col gap-4">
          <h2 id="past-title" className="display text-2xl text-ink">Past</h2>
          <ul className="flex flex-col gap-4">{past.map((r) => row(r, true))}</ul>
        </section>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this reminder?"
        description={removing ? `"${removing.text}" will be deleted from this phone.` : ""}
        confirmLabel="Yes, remove it"
        cancelLabel="No, keep it"
        tone="danger"
        onConfirm={() => {
          if (removing) removeReminder(removing.id);
          setRemoving(null);
          say("Reminder removed.");
        }}
        onCancel={() => setRemoving(null)}
      />
    </ScrollPage>
  );
}
