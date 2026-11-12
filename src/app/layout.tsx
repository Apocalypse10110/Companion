import type { Metadata, Viewport } from "next";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import { BOOTSTRAP_SCRIPT } from "@/ui/settings/bootstrap-script";
import { AppFrame } from "@/ui/shell/AppFrame";
import { Providers } from "@/ui/shell/Providers";

export const metadata: Metadata = {
  title: { default: "Companion", template: "%s · Companion" },
  description: "A friendly voice helper that makes your phone easier to use.",
  applicationName: "Companion",
  appleWebApp: { capable: true, title: "Companion", statusBarStyle: "default" },
};

// Zooming is never disabled: people must be able to pinch-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // When the on-screen keyboard opens, shrink the page so the Send button stays visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2eb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d141b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline script sets data-* attributes before first paint, so React must not flag them.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
