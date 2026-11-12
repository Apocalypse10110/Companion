import type { Metadata } from "next";
import { AccessibilitySettings } from "@/ui/screens/settings/AccessibilitySettings";

export const metadata: Metadata = { title: "Accessibility settings" };

export default function Page() {
  return <AccessibilitySettings />;
}
