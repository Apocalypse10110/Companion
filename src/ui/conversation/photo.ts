/**
 * Turns a photo from the camera or Photos into something small enough to send:
 * a JPEG no bigger than 1280px (about 100-250 KB), plus a tiny preview for the conversation.
 * Re-encoding also turns iPhone HEIC photos into JPEG and drops location data (EXIF).
 */
import type { AssistantImage } from "@/contracts";

const MAX_SIDE = 1280;
const THUMB_SIDE = 240;

export interface PreparedPhoto {
  image: AssistantImage;
  /** Small data: URL shown in the conversation and saved with it. */
  thumb: string;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" respects the photo's rotation, so it isn't sideways.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to <img> (older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function draw(src: { source: CanvasImageSource; width: number; height: number }, side: number, quality: number): string {
  const scale = Math.min(1, side / Math.max(src.width, src.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(src.width * scale));
  canvas.height = Math.max(1, Math.round(src.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(src.source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const decoded = await decode(file);
  try {
    const full = draw(decoded, MAX_SIDE, 0.78);
    const thumb = draw(decoded, THUMB_SIDE, 0.6);
    return { image: { mimeType: "image/jpeg", data: full.slice(full.indexOf(",") + 1) }, thumb };
  } finally {
    decoded.close?.();
  }
}
