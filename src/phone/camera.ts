/**
 * Live camera for "Show me": open the back or front camera, show a preview, take a still photo.
 * Uses getUserMedia (iPhone Safari 11+, Android Chrome). Needs https. Owner: Developer D.
 */

export type Facing = "environment" | "user";

export type CameraErrorCode = "denied" | "no-camera" | "busy" | "insecure" | "unsupported" | "unknown";

export class CameraError extends Error {
  constructor(readonly code: CameraErrorCode) {
    super(code);
    this.name = "CameraError";
  }
}

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Open a camera. "environment" is the back camera, "user" the front (selfie) one. */
export async function openCamera(facing: Facing): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) throw new CameraError("insecure");
  if (!cameraSupported()) throw new CameraError("unsupported");
  const preferred: MediaStreamConstraints = {
    audio: false,
    // 1280px is all we send (photos are shrunk to that), and it starts faster on older phones.
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
  };
  let lastName = "";
  // Some phones take a moment to release the camera after it was just turned off ("Take it again",
  // switching cameras), so try again once after a short pause before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 600));
    try {
      return await navigator.mediaDevices.getUserMedia(preferred);
    } catch (err) {
      lastName = err instanceof Error ? err.name : "";
      if (lastName === "NotAllowedError" || lastName === "SecurityError") throw new CameraError("denied");
      if (lastName === "NotFoundError" || lastName === "OverconstrainedError") {
        // Maybe this device has no camera facing that way (a laptop has no back camera): take any.
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (e2) {
          lastName = e2 instanceof Error ? e2.name : lastName;
        }
      }
    }
  }
  if (lastName === "NotReadableError" || lastName === "AbortError") throw new CameraError("busy");
  if (lastName === "NotFoundError" || lastName === "OverconstrainedError") throw new CameraError("no-camera");
  throw new CameraError("unknown");
}

export function stopCamera(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** How many cameras there are, so "Switch camera" is only offered when there is more than one. */
export async function countCameras(): Promise<number> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").length;
  } catch {
    return 1;
  }
}

/** Take a still photo from the live preview. */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new CameraError("unknown");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CameraError("unknown");
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new CameraError("unknown");
  return blob;
}

/** What to tell the person, and what to do instead. */
export const CAMERA_PROBLEMS: Record<CameraErrorCode, string> = {
  denied:
    "The camera is turned off for Companion. To turn it on: on an iPhone, open Settings, then Safari, then Camera, and choose Allow. On Android, tap the lock or settings icon next to the web address, then Permissions, then Camera. You can also choose a photo instead.",
  "no-camera": "I couldn't find a camera on this device. You can choose a photo or screenshot instead.",
  busy: "Another app is using the camera. Close it, then try again, or choose a photo instead.",
  insecure: "The camera only works on the secure (https) version of Companion. You can choose a photo instead.",
  unsupported: "This browser can't show a live camera. You can choose a photo or take one instead.",
  unknown: "The camera didn't start. Please try again, or choose a photo instead.",
};

/**
 * Screen sharing: computers only (iPhone and Android browsers don't offer it). The person picks a
 * window or screen in the browser's own prompt; we take ONE picture of it and stop sharing at once.
 */
export function screenShareSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints ?? 0) > 1;
  return !mobile && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

export async function captureScreenOnce(): Promise<Blob | null> {
  let s: MediaStream | null = null;
  try {
    s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = s;
    await v.play();
    await new Promise((r) => setTimeout(r, 300)); // let the first real frame arrive
    return await captureFrame(v);
  } catch {
    return null; // cancelled the browser's prompt, or it failed: nothing is shared
  } finally {
    stopCamera(s);
  }
}
