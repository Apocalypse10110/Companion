/**
 * Privacy: phone numbers never leave the phone. Before anything is sent to the AI, numbers that look
 * like phone numbers (7+ digits, with spaces, dashes, dots or brackets) are replaced with
 * "[phone number]". Calling and texting still work: those are understood on the device.
 */
const PHONE = /(?:\+|\b00)?\d[\d\s().-]{5,}\d/g;

function digits(s: string): number {
  return s.replace(/\D/g, "").length;
}

/** Times ("8:30"), years and short counts are left alone; only 7+ digit runs are numbers. */
export function redactPhoneNumbers(text: string): string {
  return text.replace(PHONE, (m) => (digits(m) >= 7 ? "[phone number]" : m));
}
