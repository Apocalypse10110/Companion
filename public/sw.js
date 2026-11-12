/*
 * Companion service worker.
 * - Makes the app installable and lets it show reminder notifications (Android requires a worker).
 * - Tapping a notification brings Companion to the front.
 * - Receives things shared TO Companion (Android, installed): a screenshot, photo or text. It keeps
 *   the shared item in a private cache on this phone for a moment, then opens Companion, which
 *   reads it, shows it, and deletes it.
 * - With no internet, opening Companion shows a friendly page (built in below) instead of the
 *   browser's error, with what still works and a Try again button.
 * - Caches no app pages, so a new deploy is always picked up and nothing stale is shown.
 */
const SHARE_CACHE = "companion-share";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/share") {
    event.respondWith(receiveShare(request));
    return;
  }
  // Opening a page: always from the network (fresh); only if that fails, the offline page.
  if (request.mode === "navigate" && request.method === "GET" && url.origin === self.location.origin) {
    event.respondWith(fetch(request).catch(() => offlinePage()));
  }
});

function offlinePage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>No internet · Companion</title>
<style>
  :root { --bg: #fbf8f3; --ink: #1f1a17; --muted: #5c524b; --accent: #b84a06; --btn: #3a302a; --on-btn: #fff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #161210; --ink: #f5efe8; --muted: #c9bfb6; --accent: #ff9a52; --btn: #f5efe8; --on-btn: #161210; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 1.375rem/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 34rem; margin: 0 auto; padding: max(2rem, env(safe-area-inset-top)) 1.25rem 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
  h1 { font-size: 2.25rem; line-height: 1.15; margin: 0; }
  p, li { margin: 0; }
  ul { margin: 0; padding-left: 1.4rem; display: flex; flex-direction: column; gap: .5rem; }
  .muted { color: var(--muted); }
  button { font: inherit; font-weight: 700; min-height: 3.5rem; border: 0; border-radius: 1.25rem; background: var(--btn); color: var(--on-btn); padding: .75rem 1.25rem; }
  button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
</style></head><body><main>
<h1>No internet right now</h1>
<p>Companion needs the internet to open. Nothing is wrong with your phone.</p>
<p><strong>Your phone still works as normal:</strong></p>
<ul><li>Use the green Phone app to call someone.</li><li>Use Messages to send a text.</li></ul>
<p class="muted">Check that Wi-Fi or mobile data is on, or move closer to the window, then try again.</p>
<button type="button" onclick="location.reload()">Try again</button>
</main><script>addEventListener("online", function () { location.reload(); });</script></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

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
