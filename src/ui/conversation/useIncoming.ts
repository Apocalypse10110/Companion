"use client";

import { useEffect, useState } from "react";
import { SHARE_SESSION_KEY } from "@/phone/share";
import type { ConversationApi } from "./ConversationProvider";

const SHARE_CACHE = "companion-share";

async function takeShared(): Promise<{ photo?: Blob; text?: string }> {
  if (typeof caches === "undefined") return {};
  const cache = await caches.open(SHARE_CACHE);
  const [p, t] = await Promise.all([cache.match("/shared/photo"), cache.match("/shared/text")]);
  const out = { photo: p ? await p.blob() : undefined, text: t ? (await t.text()).trim() : undefined };
  // Read once, then gone: nothing shared is kept on the phone.
  await Promise.all([cache.delete("/shared/photo"), cache.delete("/shared/text")]);
  return out;
}

/** Text left by the /share fallback (see src/app/share/route.ts): read once, then removed. */
export function takeSessionShare(storage: Pick<Storage, "getItem" | "removeItem"> | undefined = typeof sessionStorage === "undefined" ? undefined : sessionStorage): string | null {
  try {
    const text = storage?.getItem(SHARE_SESSION_KEY) ?? null;
    storage?.removeItem(SHARE_SESSION_KEY);
    return text?.trim() ? text : null;
  } catch {
    return null;
  }
}

function askAboutText(text: string): string {
  return `Can you look at this message I got and tell me what it means, and if it's safe? "${text.slice(0, 1200)}"`;
}

export interface Incoming {
  /** Open the Show Me camera straight away. */
  openCamera: boolean;
  /** The question to send with that photo (kept from Live Help when it falls back to Show Me). */
  question?: string;
}

/**
 * Things that open Companion with a job to do:
 *  - the "Show me" home-screen shortcut (/?showme=1) opens the camera; Live Help's fallback adds
 *    the person's question (&q=...),
 *  - "Practise again" from My Skills (/?practise=connect%20to%20wifi),
 *  - something shared TO Companion from another app (screenshot, photo, a suspicious text).
 */
export function useIncoming(c: ConversationApi): Incoming {
  const [incoming, setIncoming] = useState<Incoming>({ openCamera: false });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return;
    window.history.replaceState(null, "", "/");
    if (params.get("showme") === "1") {
      const q = params.get("q")?.trim().slice(0, 500);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- acting on how the app was opened
      setIncoming({ openCamera: true, ...(q ? { question: q } : {}) });
      return;
    }
    const practise = params.get("practise")?.trim().slice(0, 60);
    if (practise) {
      // After this render settles: arriving on a new screen stops anything in progress first.
      // A fresh conversation first, then the request once it has rendered.
      setTimeout(() => {
        c.newConversation();
        setTimeout(() => c.sendText(`I'd like to practise: ${practise}.`), 50);
      }, 0);
      return;
    }
    if (params.get("shared") === "session") {
      const text = takeSessionShare();
      if (text) c.sendText(askAboutText(text));
      return;
    }
    if (params.get("shared") === "1") {
      void takeShared().then(({ photo, text }) => {
        if (photo) c.sendPhoto(photo, text ? `Can you help me with this? ${text}` : undefined);
        else if (text) c.sendText(askAboutText(text));
      });
    }
    // Run once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return incoming;
}
