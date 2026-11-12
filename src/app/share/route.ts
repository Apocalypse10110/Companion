/**
 * POST /share: only reached when the service worker isn't running yet (it normally receives shares
 * itself, see public/sw.js). Nothing is stored on the server.
 *
 * Privacy: the shared text (often a scam message with a phone number in it) must never go into an
 * address, because addresses are kept in server request logs and browser history. Instead it goes
 * back in this one page's body, which puts it in sessionStorage on this phone and opens Companion.
 */
import { SHARE_SESSION_KEY } from "@/phone/share";

export async function POST(request: Request): Promise<Response> {
  let text = "";
  try {
    const form = await request.formData();
    text = [form.get("title"), form.get("text"), form.get("url")]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join("\n")
      .slice(0, 1500);
  } catch {
    /* nothing usable */
  }
  if (!text.trim()) {
    return Response.redirect(new URL("/?shared=failed", request.url), 303);
  }
  // JSON-encode, then escape "<" so the text can't close the script tag.
  const value = JSON.stringify(text).replace(/</g, "\\u003c");
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Companion</title><p>Opening Companion…</p><script>try{sessionStorage.setItem(${JSON.stringify(SHARE_SESSION_KEY)},${value})}catch(e){}location.replace("/?shared=session")</script>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
