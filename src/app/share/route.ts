/**
 * POST /share: only reached when the service worker isn't running yet (it normally receives shares
 * itself, see public/sw.js). Nothing is stored on the server: shared text is passed back to the page
 * in the address, and a shared photo is asked for again.
 */
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
  const target = new URL(text ? `/?sharedText=${encodeURIComponent(text)}` : "/?shared=failed", request.url);
  return Response.redirect(target, 303);
}
