/**
 * Every phone permission people ask about, what Companion uses it for, whether this device can do it,
 * and what to do instead when it can't. Powers Settings -> Device permissions.
 * Honest by design: rows for things a website can't reach say so, with the alternative.
 * Owner: Developer D.
 */
import type { PermissionName, PermissionState, PermissionsService } from "@/contracts";
import { cameraSupported, screenShareSupported } from "@/phone/camera";
import { contactPicker, detectOS, isStandalone, type OS } from "@/phone/platform";

export type RowState = PermissionState | "available" | "not-on-web" | "not-needed";

export interface PermissionRow {
  id: string;
  title: string;
  /** What Companion uses it for, in plain words. */
  use: string;
  state: RowState;
  /** Set when a tap can ask for it now. */
  request?: PermissionName;
  /** How to turn it on in the phone's settings, if it was turned off. */
  howToEnable?: string;
  /** What to do when this device can't. */
  alternative?: string;
  /** A Companion screen that uses it. */
  link?: { href: string; label: string };
}

function enableHelp(os: OS, what: string): string {
  if (os === "ios")
    return `Open the Settings app, scroll down and tap Safari (or Companion, if you added it to your Home Screen), then ${what}, and choose Allow.`;
  if (os === "android")
    return `In Chrome, tap the icon to the left of the web address, then Permissions (or Site settings), then ${what}, and choose Allow.`;
  return `Click the icon to the left of the web address, find ${what}, and choose Allow.`;
}

export async function permissionRows(perms: PermissionsService): Promise<PermissionRow[]> {
  const os = detectOS();
  const check = (n: PermissionName) => perms.check(n).catch(() => "unsupported" as const);
  const [mic, cam, notif] = await Promise.all([check("microphone"), check("camera"), check("notifications")]);
  const w = typeof window === "undefined" ? undefined : (window as unknown as Record<string, unknown>);
  const speech = Boolean(w?.SpeechRecognition || w?.webkitSpeechRecognition);

  return [
    {
      id: "microphone",
      title: "Microphone",
      use: "So you can talk to me. I only listen while you tap the microphone button.",
      state: mic,
      request: "microphone",
      howToEnable: enableHelp(os, "Microphone"),
      alternative: "You can type to me instead.",
    },
    {
      id: "speech",
      title: "Speech recognition",
      use: "Turns what you say into words. Your phone does this itself.",
      state: speech ? "available" : "unsupported",
      alternative: "This browser can't turn speech into words. Try Chrome on Android or Safari on iPhone, or type instead.",
    },
    {
      id: "camera",
      title: "Camera",
      use: "For \"Show me\": point the camera at something confusing and I'll explain it. Only while the camera screen is open.",
      state: cameraSupported() ? cam : "unsupported",
      request: "camera",
      howToEnable: enableHelp(os, "Camera"),
      alternative: "You can still choose a photo or screenshot from your phone.",
    },
    {
      id: "photos",
      title: "Photos and screenshots",
      use: "For \"Show me\": you pick one photo or screenshot each time. I never see your other photos.",
      state: "not-needed",
      link: { href: "/", label: "Try Show me" },
    },
    {
      id: "notifications",
      title: "Notifications",
      use: "So I can alert you when a reminder is due.",
      state: os === "ios" && !isStandalone() && notif === "unsupported" ? "unsupported" : notif,
      request: "notifications",
      howToEnable: enableHelp(os, "Notifications"),
      alternative:
        os === "ios" && !isStandalone()
          ? "On iPhone, add Companion to your Home Screen first (see Quick access below). Until then I remind you on screen and out loud."
          : "I'll still remind you on screen and out loud while Companion is open.",
      link: { href: "/settings/reminders", label: "Your reminders" },
    },
    {
      id: "contacts",
      title: "Contacts",
      use: "So you can say \"call my daughter\". I only ever see the one person you choose.",
      state: contactPicker() ? "available" : "not-on-web",
      alternative:
        os === "ios"
          ? "iPhones don't let websites open your contacts. You can share a contact card from the Contacts app, or type their number, in People."
          : "You can type their name and number in People.",
      link: { href: "/settings/people", label: "Add people" },
    },
    {
      id: "screen",
      title: "Screen sharing",
      use: "On a computer: show me one picture of a window that's confusing you.",
      state: screenShareSupported() ? "available" : "not-on-web",
      alternative: "On a phone, take a screenshot (press the side and volume-up buttons together) and choose it in \"Show me\".",
    },
    {
      id: "location",
      title: "Location",
      use: "I don't use your location. Maps uses its own when I open directions for you.",
      state: "not-needed",
    },
    {
      id: "calendar",
      title: "Calendar",
      use: "Websites can't read or add to your phone's calendar.",
      state: "not-on-web",
      alternative: "Ask me to set a reminder instead. I keep them in Companion.",
      link: { href: "/settings/reminders", label: "Your reminders" },
    },
    {
      id: "bluetooth",
      title: "Bluetooth and Wi-Fi",
      use: "Websites can't switch these on or off.",
      state: "not-on-web",
      alternative: "Ask me \"how do I turn on Bluetooth?\" and I'll guide you step by step in your phone's Settings.",
    },
  ];
}
