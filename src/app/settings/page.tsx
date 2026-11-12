import type { Metadata } from "next";
import { SettingsHome } from "@/ui/screens/settings/SettingsHome";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <SettingsHome />;
}
