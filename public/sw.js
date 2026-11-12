/*
 * Companion service worker.
 * - Makes the app installable and lets it show reminder notifications (Android requires a worker).
 * - Tapping a notification brings Companion to the front.
 * - Deliberately caches nothing, so a new deploy is always picked up and nothing stale is shown.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
