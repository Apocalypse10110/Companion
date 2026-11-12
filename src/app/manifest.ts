import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Companion",
    short_name: "Companion",
    description: "A friendly voice helper that makes your phone easier to use.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf8f3",
    theme_color: "#d4580a",
    // Press and hold the icon (Android) for these.
    shortcuts: [
      { name: "Talk to Companion", short_name: "Talk", url: "/?from=shortcut", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Show me with a photo", short_name: "Show me", url: "/?showme=1", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    // Installed on Android: share a screenshot, photo or suspicious text straight to Companion.
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "photo", accept: ["image/*"] }] },
    },
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed version for Android launchers that crop icons into circles or squircles.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
