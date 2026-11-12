"use client";

import { HeartHandshake, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadPeople, subscribePeople, type Person } from "@/people/store";
import { Button } from "../components/Button";

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

function helperLabel(p: Person): string {
  return p.relationship ? `Send to ${p.name} (${p.relationship})` : `Send to ${p.name}`;
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

  useEffect(() => {
    const refresh = () => setPeople(pickHelpers(loadPeople()));
    refresh();
    return subscribePeople(refresh);
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

  const sharePhoto = async () => {
    if (!photo) return;
    const file = await photoFile(photo);
    if (!file) return;
    try {
      // The phone's own share sheet: the person picks who, and presses Send there.
      await navigator.share({ files: [file], text: note });
    } catch {
      /* they closed the share sheet; nothing was sent */
    }
  };

  return (
    <section aria-label="Let your family know" className="bw flex flex-col gap-3 rounded-3xl bg-surface-2 px-4 py-4">
      <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
        <HeartHandshake aria-hidden="true" className="size-6 shrink-0" />
        Let your family know?
      </h3>
      <blockquote className="border-l-4 border-accent pl-3 text-lg text-ink">{note}</blockquote>
      {people.length > 0 ? (
        <div className="flex flex-col gap-3" role="group" aria-label="Who to send it to">
          {people.map((p) => (
            <Button key={p.id} variant="secondary" fullWidth disabled={disabled} onClick={() => onSend(p)}>
              {helperLabel(p)}
            </Button>
          ))}
          {canSharePhoto && (
            <Button variant="secondary" icon={ImageIcon} fullWidth disabled={disabled} onClick={() => void sharePhoto()}>
              Send it with the photo
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-lg text-muted">Add someone you trust in People, and you can send this to them in one tap.</p>
          <Link href="/settings/people" className="text-lg font-bold text-accent-ink underline underline-offset-4">
            Add a person
          </Link>
          {canSharePhoto && (
            <Button variant="secondary" icon={ImageIcon} fullWidth disabled={disabled} onClick={() => void sharePhoto()}>
              Send it with the photo
            </Button>
          )}
        </>
      )}
    </section>
  );
}
