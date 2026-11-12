/**
 * What kind of device and browser this is, and what it can honestly do.
 * Everything here is read lazily (never at import time) so server rendering stays safe.
 * Owner: Developer C.
 */

export type OS = "ios" | "android" | "desktop";

export function detectOS(nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator): OS {
  if (!nav) return "desktop";
  const ua = nav.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS 13+ reports itself as a Mac, but has a touch screen.
  if (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return "ios";
  return "desktop";
}

export function isMobile(): boolean {
  return detectOS() !== "desktop";
}

/** Installed to the home screen and opened from there. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || Boolean(window.matchMedia?.("(display-mode: standalone)").matches);
}

/** Android Chrome's Contact Picker. Not available on iPhone or desktop. */
export interface ContactPicker {
  select(properties: Array<"name" | "tel" | "email">, options?: { multiple?: boolean }): Promise<Array<{ name?: string[]; tel?: string[] }>>;
  getProperties?(): Promise<string[]>;
}

export function contactPicker(): ContactPicker | null {
  if (typeof navigator === "undefined" || typeof window === "undefined") return null;
  const contacts = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
  return contacts && "ContactsManager" in window ? contacts : null;
}

export interface Capabilities {
  os: OS;
  standalone: boolean;
  secure: boolean;
  /** tel: links open a dialer (phones only; desktops may offer a linked phone app). */
  calls: boolean;
  /** sms: links open the messages app. */
  messages: boolean;
  contactPicker: boolean;
  share: boolean;
  notifications: boolean;
  serviceWorker: boolean;
  speechInput: boolean;
  speechOutput: boolean;
  microphone: boolean;
  camera: boolean;
  vibration: boolean;
}

export function capabilities(): Capabilities {
  const hasWindow = typeof window !== "undefined";
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const os = detectOS(nav);
  const w = (hasWindow ? window : {}) as Window & Record<string, unknown>;
  const media = Boolean(nav?.mediaDevices?.getUserMedia);
  return {
    os,
    standalone: isStandalone(),
    secure: hasWindow ? window.isSecureContext : false,
    calls: os !== "desktop",
    messages: os !== "desktop",
    contactPicker: contactPicker() !== null,
    share: Boolean(nav && "share" in nav),
    notifications: hasWindow && "Notification" in window,
    serviceWorker: Boolean(nav && "serviceWorker" in nav),
    speechInput: Boolean(w.SpeechRecognition || w.webkitSpeechRecognition),
    speechOutput: hasWindow && "speechSynthesis" in window,
    microphone: media,
    camera: media,
    vibration: Boolean(nav && "vibrate" in nav),
  };
}

/** Open a link that hands over to another app (tel:, sms:, mailto:, maps). Injectable for tests. */
export type Launcher = (url: string) => void;

export const defaultLauncher: Launcher = (url) => {
  if (typeof window === "undefined") return;
  if (/^https?:/i.test(url)) {
    // Web pages open in a new tab so Companion stays open behind them.
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) window.location.href = url;
    return;
  }
  window.location.href = url;
};
