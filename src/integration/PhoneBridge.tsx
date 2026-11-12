"use client";

/**
 * Connects Developer C's phone services to the running app:
 *  - lets the ActionService change settings ("make the text bigger"),
 *  - registers the service worker (installable app, notifications),
 *  - watches for due reminders and shows them: a phone notification when allowed,
 *    and always on screen and spoken, with "Done" and "Remind me in 10 minutes".
 * Owner: Developer C.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markLeft, takeReturn, welcomeBackText } from "@/phone/handoff";
import { useConversation } from "@/ui/conversation/ConversationProvider";
import { connectSettings } from "@/actions/settingsBridge";
import { dueReminders, finishReminder, showSystemNotification, snoozeReminder, type Reminder } from "@/actions/reminders";
import { useServices } from "@/integration/ServicesProvider";
import { useAnnounce } from "@/ui/a11y/LiveAnnouncer";
import { buzz } from "@/ui/a11y/haptics";
import { ConfirmDialog } from "@/ui/components/ConfirmDialog";
import { useSettings } from "@/ui/settings/SettingsProvider";

const CHECK_EVERY_MS = 15_000;

export function PhoneBridge() {
  const { settings, update } = useSettings();
  const { voiceOutput } = useServices();
  const announce = useAnnounce();
  const [due, setDue] = useState<Reminder | null>(null);
  const settingsRef = useRef(settings);
  const shown = useRef(new Set<string>());
  const conversation = useConversation();
  const convRef = useRef(conversation);
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);

  useEffect(() => {
    convRef.current = conversation;
    pathRef.current = pathname;
  });

  // Coming back from a call or Messages: put the conversation back and offer to carry on.
  useEffect(() => {
    const resume = (minAwayMs?: number) => {
      const h = takeReturn(minAwayMs);
      if (!h) return;
      const c = convRef.current;
      if (h.conversationId && h.conversationId !== c.activeId && c.history.some((x) => x.id === h.conversationId)) {
        c.openConversation(h.conversationId);
      }
      if (h.path && h.path !== pathRef.current) router.push(h.path);
      // Give the reopened conversation a moment to appear, then greet.
      setTimeout(() => convRef.current.addNotice(welcomeBackText(h)), 300);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") markLeft(convRef.current.activeId, pathRef.current);
      else resume();
    };
    // pagehide also covers the phone unloading the page while it's away.
    const onHide = () => markLeft(convRef.current.activeId, pathRef.current);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    // If the phone reloaded Companion while the person was on the call, resume after saved
    // conversations have loaded.
    const startup = setTimeout(() => resume(0), 800);
    return () => {
      clearTimeout(startup);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [router]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Let actions read and change settings.
  useEffect(() => connectSettings({ get: () => settingsRef.current, update }), [update]);

  // Service worker: needed for notifications on Android and for installing the app.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* The app still works without it. */
    });
  }, []);

  // Watch for reminders that are due.
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (!alive) return;
      const next = dueReminders().find((r) => !shown.current.has(`${r.id}@${r.at}`));
      if (!next) return;
      shown.current.add(`${next.id}@${next.at}`);
      setDue((current) => current ?? next);
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // When one is due: notify, announce, vibrate and say it.
  useEffect(() => {
    if (!due) return;
    const text = `Reminder: ${due.text}`;
    if (due.notify !== false) void showSystemNotification("Companion reminder", due.text, `reminder-${due.id}`);
    announce(text, "assertive");
    buzz(settingsRef.current.haptics, [200, 100, 200]);
    const s = settingsRef.current;
    if (s.speakReplies && voiceOutput.isSupported()) {
      voiceOutput
        .speak(`Here's your reminder. ${due.text}.`, { rate: s.speechRate, volume: s.volume, voiceId: s.voiceId, language: navigator.language || "en-US" })
        .catch(() => {});
    }
  }, [due, announce, voiceOutput]);

  return (
    <ConfirmDialog
      open={due !== null}
      title="Reminder"
      description={due ? capitalize(due.text) : ""}
      confirmLabel="Done"
      cancelLabel="Remind me in 10 minutes"
      onConfirm={() => {
        if (due) finishReminder(due.id);
        voiceOutput.cancel();
        setDue(null);
      }}
      onCancel={() => {
        if (due) snoozeReminder(due.id, 10);
        voiceOutput.cancel();
        setDue(null);
        announce("Okay, I'll remind you again in 10 minutes.");
      }}
    />
  );
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
