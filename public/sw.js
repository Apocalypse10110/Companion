/*
 * Companion service worker.
 * - Makes the app installable and lets it show reminder notifications (Android requires a worker).
 * - Tapping a notification brings Companion to the front.
 * - Receives things shared TO Companion (Android, installed): a screenshot, photo or text. It keeps
 *   the shared item in a private cache on this phone for a moment, then opens Companion, which
 *   reads it, shows it, and deletes it.
 * - Caches nothing else, so a new deploy is always picked up and nothing stale is shown.
 */
const SHARE_CACHE = "companion-share";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share") {
    event.respondWith(receiveShare(event.request));
  }
});

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    const photo = form.get("photo");
    const text = [form.get("title"), form.get("text"), form.get("url")].filter((v) => typeof v === "string" && v.trim()).join("\n");
    if (photo && typeof photo === "object" && photo.size > 0 && photo.size < 25_000_000) {
      await cache.put("/shared/photo", new Response(photo, { headers: { "Content-Type": photo.type || "image/jpeg" } }));
    }
    if (text) await cache.put("/shared/text", new Response(text.slice(0, 2000), { headers: { "Content-Type": "text/plain" } }));
    return Response.redirect("/?shared=1", 303);
  } catch {
    return Response.redirect("/?shared=failed", 303);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
