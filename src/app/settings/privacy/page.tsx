import type { Metadata } from "next";
import { PrivacySettings } from "@/ui/screens/settings/PrivacySettings";

export const metadata: Metadata = { title: "Privacy settings" };

export default function Page() {
  return <PrivacySettings />;
}
