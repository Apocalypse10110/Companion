"use client";

import { Contact, Phone, Trash2, UserPlus } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { addPerson, isPhoneNumber, loadPeople, removePerson, subscribePeople, type Person } from "@/people/store";
import { contactPicker } from "@/phone/platform";
import { useAnnounce } from "../../a11y/LiveAnnouncer";
import { Button } from "../../components/Button";
import { Banner, Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";

const FIELD = "bwc w-full rounded-2xl bg-surface px-4 py-3 text-xl text-ink placeholder:text-muted";

/** The people Companion can call or message. Kept on this phone only. */
export function PeopleSettings() {
  const announce = useAnnounce();
  const ids = { name: useId(), rel: useId(), phone: useId() };
  const [people, setPeople] = useState<Person[]>([]);
  const [canPick, setCanPick] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Person | null>(null);

  useEffect(() => {
    const refresh = () => setPeople(loadPeople());
    refresh();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setCanPick(contactPicker() !== null);
    return subscribePeople(refresh);
  }, []);

  function saved(p: Person) {
    const text = `${p.name} is saved.${p.relationship ? ` You can say "call my ${p.relationship}".` : ` You can say "call ${p.name}".`}`;
    setDone(text);
    setProblem(null);
    announce(text);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return fail("Please type their name.");
    if (!isPhoneNumber(phone)) return fail("Please type their phone number, using numbers only.");
    const p = addPerson({ name, phone, relationship });
    setName("");
    setRelationship("");
    setPhone("");
    saved(p);
  }

  function fail(text: string) {
    setProblem(text);
    setDone(null);
    announce(text, "assertive");
  }

  async function pick() {
    const picker = contactPicker();
    if (!picker) return;
    try {
      const [first] = await picker.select(["name", "tel"], { multiple: false });
      const tel = first?.tel?.find((t) => t.trim());
      if (!first) return;
      if (!tel) return fail("That contact has no phone number.");
      // Fill the form so they can add "daughter" before saving.
      setName(first.name?.[0] ?? "");
      setPhone(tel);
      setProblem(null);
      announce("Contact chosen. Add who they are to you if you like, then tap Save.");
    } catch {
      fail("I couldn't open your contacts. You can type the details instead.");
    }
  }

  return (
    <ScrollPage>
      <PageHeader title="People" backHref="/settings" backLabel="Settings" />

      <Card>
        <p className="text-lg text-ink">
          Add the people you call or text most. Then you can say &ldquo;call my daughter&rdquo; or &ldquo;text Anna&rdquo;. They are
          saved on this phone only.
        </p>
      </Card>

      {people.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="Saved people">
          {people.map((p) => (
            <li key={p.id} className="bw flex flex-col gap-3 rounded-3xl bg-surface p-5">
              <div className="flex items-start gap-4">
                <Phone aria-hidden="true" className="mt-1 size-7 shrink-0 text-accent-ink" strokeWidth={2.25} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="display text-2xl text-ink [overflow-wrap:anywhere]">{p.name}</h2>
                  {p.relationship && <p className="text-lg text-ink">Your {p.relationship}</p>}
                  <p className="text-lg text-muted [overflow-wrap:anywhere]">{p.phone}</p>
                </div>
              </div>
              <Button variant="secondary" icon={Trash2} fullWidth onClick={() => setRemoving(p)}>
                {`Remove ${p.name}`}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="bw flex flex-col gap-4 rounded-3xl bg-surface p-5" aria-labelledby={`${ids.name}-title`}>
        <h2 id={`${ids.name}-title`} className="display text-2xl text-ink">
          Add someone
        </h2>
        {canPick && (
          <Button variant="secondary" icon={Contact} fullWidth onClick={() => void pick()}>
            Choose from my contacts
          </Button>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.name} className="text-lg font-bold text-ink">
            Their name
          </label>
          <input id={ids.name} className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="Anna" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.rel} className="text-lg font-bold text-ink">
            Who are they to you? <span className="font-normal">(you can leave this empty)</span>
          </label>
          <input id={ids.rel} className={FIELD} value={relationship} onChange={(e) => setRelationship(e.target.value)} autoComplete="off" placeholder="daughter" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.phone} className="text-lg font-bold text-ink">
            Phone number
          </label>
          <input
            id={ids.phone}
            className={FIELD}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="07700 900123"
          />
        </div>
        {problem && (
          <Banner tone="error" title="Not saved yet" urgent>
            {problem}
          </Banner>
        )}
        {done && <Banner tone="success">{done}</Banner>}
        <Button type="submit" icon={UserPlus} fullWidth>
          Save this person
        </Button>
      </form>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? "this person"}?`}
        description="I won't be able to call or text them for you until you add them again. Nothing changes in your phone's own contacts."
        confirmLabel="Yes, remove"
        cancelLabel="No, keep them"
        tone="danger"
        onConfirm={() => {
          const p = removing;
          setRemoving(null);
          if (p) {
            removePerson(p.id);
            announce(`${p.name} removed.`);
          }
        }}
        onCancel={() => setRemoving(null)}
      />
    </ScrollPage>
  );
}
