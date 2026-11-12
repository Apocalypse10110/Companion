/**
 * PermissionsService (contract: src/contracts/permissions.ts) on the browser's real permission APIs.
 *
 *  - check() never shows a prompt.
 *  - request() shows the system prompt, and is only called from a tap.
 *  - Browsers that can't tell us the state (for example Firefox for the microphone) report "prompt",
 *    so the UI explains first and then asks.
 *
 * Owner: Developer C.
 */
import type { PermissionName, PermissionState, PermissionsService } from "@/contracts";

type QueryName = "microphone" | "camera" | "notifications";

function hasMedia(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

function hasNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function fromBrowser(state: string): PermissionState {
  if (state === "granted" || state === "denied" || state === "prompt") return state;
  if (state === "default") return "prompt"; // Notification.permission
  return "prompt";
}

async function query(name: QueryName): Promise<PermissionState | null> {
  try {
    const status = await navigator.permissions?.query({ name } as unknown as PermissionDescriptor);
    return status ? fromBrowser(status.state) : null;
  } catch {
    return null; // This browser can't report this permission.
  }
}

async function checkMedia(kind: "microphone" | "camera"): Promise<PermissionState> {
  if (!hasMedia()) return "unsupported";
  return (await query(kind)) ?? "prompt";
}

async function requestMedia(kind: "microphone" | "camera"): Promise<PermissionState> {
  if (!hasMedia()) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia(kind === "microphone" ? { audio: true } : { video: true });
    // We only wanted the permission. Turn the microphone or camera straight off again.
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") return "denied";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "unsupported";
    // Some other failure (device busy). Report what the browser now says, if it can.
    return (await query(kind)) ?? "prompt";
  }
}

async function checkNotifications(): Promise<PermissionState> {
  if (!hasNotifications()) return "unsupported";
  return fromBrowser(Notification.permission);
}

async function requestNotifications(): Promise<PermissionState> {
  if (!hasNotifications()) return "unsupported";
  if (Notification.permission !== "default") return fromBrowser(Notification.permission);
  try {
    // Older Safari only supports the callback form.
    const result = await new Promise<NotificationPermission>((resolve) => {
      const maybe = Notification.requestPermission(resolve);
      if (maybe && typeof maybe.then === "function") maybe.then(resolve, () => resolve(Notification.permission));
    });
    return fromBrowser(result);
  } catch {
    return fromBrowser(Notification.permission);
  }
}

export const permissions: PermissionsService = {
  async check(name: PermissionName): Promise<PermissionState> {
    if (typeof window === "undefined") return "unsupported";
    switch (name) {
      case "microphone":
        return checkMedia("microphone");
      case "camera":
        return checkMedia("camera");
      case "notifications":
        return checkNotifications();
      default:
        return "unsupported";
    }
  },
  async request(name: PermissionName): Promise<PermissionState> {
    if (typeof window === "undefined") return "unsupported";
    switch (name) {
      case "microphone":
        return requestMedia("microphone");
      case "camera":
        return requestMedia("camera");
      case "notifications":
        return requestNotifications();
      default:
        return "unsupported";
    }
  },
};
