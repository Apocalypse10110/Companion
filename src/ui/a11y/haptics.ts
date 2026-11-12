/** A short buzz, if the person has it on and the device can. Never required to understand anything. */
export function buzz(enabled: boolean, pattern: number | number[] = 20): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* unsupported or blocked */
  }
}
