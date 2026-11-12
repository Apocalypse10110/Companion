/**
 * Links that hand over to the phone's own apps. This is the honest limit of a web app: it can open
 * the dialer, Messages, email and maps with things filled in, but the person presses the final
 * Call or Send button themselves. Owner: Developer C.
 */
import { cleanPhone } from "@/people/store";
import type { OS } from "@/phone/platform";

export function telUrl(phone: string): string {
  return `tel:${cleanPhone(phone)}`;
}

/** iPhone wants `&body=`, Android wants `?body=`. */
export function smsUrl(phone: string, body: string | undefined, os: OS): string {
  const n = phone ? cleanPhone(phone) : "";
  if (!body) return `sms:${n}`;
  const sep = os === "ios" ? "&" : "?";
  return `sms:${n}${sep}body=${encodeURIComponent(body)}`;
}

export function mapsUrl(destination: string | undefined, os: OS): string {
  const dest = destination?.trim();
  if (os === "ios") return dest ? `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}` : "https://maps.apple.com/";
  return dest
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
    : "https://www.google.com/maps";
}

export function searchUrl(query: string | undefined): string {
  return query?.trim() ? `https://www.google.com/search?q=${encodeURIComponent(query.trim())}` : "https://www.google.com/";
}
