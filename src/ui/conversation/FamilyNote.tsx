"use client";

import { HeartHandshake, Image as ImageIcon, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadPeople, subscribePeople, type Person } from "@/people/store";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";

export interface FamilyNoteProps {
  note: string;
  /** The photo this is about, if any, so it can go along through the share sheet. */
  photo?: string;
  disabled?: boolean;
  /** Offer a "Send a message" card for this person. The person still confirms, then presses Send. */
  onSend: (person: Person) => void;
}

/** Family first: people saved with a relationship like "daughter" come before everyone else. */
const FAMILY = /\b(daughter|son|wife|husband|partner|sister|brother|grand(?:daughter|son|child|kid)|niece|nephew|mum|mom|mother|dad|father|family|carer|caregiver)\b/i;

export function pickHelpers(people: Person[], max = 3): Person[] {
  const family = people.filter((p) => p.relationship && FAMILY.test(p.relationship));
  const rest = people.filter((p) => !family.includes(p));
  return [...family, ...rest].slice(0, max);
}

/** "Send to my daughter (Anna)" when a relationship is saved, otherwise "Send to Anna". */
function helperLabel(p: Person): string {
  return p.relationship ? `Send to my ${p.relationship.toLowerCase()} (${p.name})` : `Send to ${p.name}`;
}

async function photoFile(dataUrl: string): Promise<File | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], "companion-photo.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

/**
 * Help Card: when the person is stuck, or has just been warned about a scam, they can let family
 * know in one tap. The text goes through the normal confirm card and the Messages hand-off, so they
 * see it and press Send themselves. Nothing is sent by Companion.
 */
export function FamilyNote({ note, photo, disabled, onSend }: FamilyNoteProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [canSharePhoto, setCanSharePhoto] = useState(false);
  const [canShareText, setCanShareText] = useState(false);
  const [confirm, setConfirm] = useState<"photo" | "text" | null>(null);

  useEffect(() => {
    const refresh = () => setPeople(pickHelpers(loadPeople()));
    refresh();
    return subscribePeople(refresh);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setCanShareText(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!photo || typeof navigator === "undefined" || typeof navigator.canShare !== "function") return;
    let live = true;
    void photoFile(photo).then((file) => {
      if (live && file) setCanSharePhoto(navigator.canShare({ files: [file] }));
    });
    return () => {
      live = false;
    };
  }, [photo]);

  const share = async (withPhoto: boolean) => {
    setConfirm(null);
    const file = withPhoto && photo ? await photoFile(photo) : null;
    try {
      // The phone's own share sheet: the person picks who, and presses Send there.
      await navigator.share(file ? { files: [file], text: note } : { text: note });
    } catch {
      /* they closed the share sheet; nothing was sent */
    }
  };

  const shareButtons = (
    <>
      {canSharePhoto && (
        <Button variant="secondary" icon={ImageIcon} fullWidth disabled={disabled} onClick={() => setConfirm("photo")}>
          Send it with the photo
        </Button>
      )}
      {canShareText && (
        <Button variant="secondary" icon={Share2} fullWidth disabled={disabled} onClick={() => setConfirm("text")}>
          Share another way
        </Button>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title="Open your phone's share screen?"
        description={`You'll choose who gets it${confirm === "photo" ? ", with your photo" : ""}. Nothing is sent until you press Send there.`}
        confirmLabel="Yes, open it"
        cancelLabel="No, don't share"
        onConfirm={() => void share(confirm === "photo")}
        onCancel={() => setConfirm(null)}
      />
    </>
  );

  return (
    <section aria-label="Let your family know" className="bw flex flex-col gap-3 rounded-3xl bg-surface-2 px-4 py-4">
      <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
        <HeartHandshake aria-hidden="true" className="size-6 shrink-0" />
        Let your family know?
      </h3>
      <blockquote className="border-l-4 border-accent pl-3 text-lg text-ink">{note}</blockquote>
      <p className="text-base text-muted">Only you decide if and where this goes. I never send it on my own.</p>
      {people.length > 0 ? (
        <div className="flex flex-col gap-3" role="group" aria-label="Who to send it to">
          {people.map((p) => (
            <Button key={p.id} variant="secondary" fullWidth disabled={disabled} onClick={() => onSend(p)}>
              {helperLabel(p)}
            </Button>
          ))}
          {shareButtons}
        </div>
      ) : (
        <>
          <p className="text-lg text-muted">Add someone you trust in People, and you can send this to them in one tap.</p>
          <Link href="/settings/people" className="text-lg font-bold text-accent-ink underline underline-offset-4">
            Add a person
          </Link>
          {shareButtons}
        </>
      )}
    </section>
  );
}
