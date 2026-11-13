/** Small helpers for Live Help audio and pictures. Pure functions, so they can be tested. */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** 16-bit little-endian PCM to floats between -1 and 1, for playing through Web Audio. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

/** "audio/pcm;rate=24000" -> 24000. */
export function rateOf(mimeType: string | undefined, fallback = 24000): number {
  const m = /rate=(\d+)/.exec(mimeType ?? "");
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 8000 && n <= 48000 ? n : fallback;
}

/** Fit a picture inside `max` pixels on its longest side, keeping its shape. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
