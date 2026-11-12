import { describe, expect, it } from "vitest";
import { POST } from "./route";

function share(text: string) {
  const form = new FormData();
  form.set("text", text);
  return POST(new Request("https://companion.example/share", { method: "POST", body: form }));
}

describe("POST /share fallback (no service worker yet)", () => {
  it("never puts the shared text in an address (addresses end up in server logs and history)", async () => {
    const res = await share("Your parcel is held. Call 07700 900123 now");
    expect(res.headers.get("location") ?? "").not.toMatch(/07700|parcel/);
    expect(res.url).not.toMatch(/07700|parcel/);
    const html = await res.text();
    // The text travels in the page body to this phone only, and is kept in sessionStorage.
    expect(html).toContain("sessionStorage");
    expect(html).toContain('"Your parcel is held. Call 07700 900123 now"');
    expect(html).toContain('location.replace("/?shared=session")');
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("can't be used to inject script", async () => {
    const html = await (await share('</script><script>alert(1)</script>')).text();
    expect(html).not.toContain("</script><script>alert(1)");
  });

  it("an empty share just goes home", async () => {
    const res = await share("   ");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://companion.example/?shared=failed");
  });
});
