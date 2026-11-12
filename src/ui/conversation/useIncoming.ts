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

/**
 * Things that open Companion with a job to do:
 *  - the "Show me" home-screen shortcut (/?showme=1) opens the camera,
 *  - something shared TO Companion from another app (screenshot, photo, a suspicious text).
 * Returns true when the camera should open straight away.
 */
export function useIncoming(c: ConversationApi): boolean {
  const [openCamera, setOpenCamera] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return;
    window.history.replaceState(null, "", "/");
    if (params.get("showme") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- acting on how the app was opened
      setOpenCamera(true);
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
  return openCamera;
}
