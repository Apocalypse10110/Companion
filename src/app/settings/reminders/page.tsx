import type { Metadata } from "next";
import { RemindersSettings } from "@/ui/screens/settings/RemindersSettings";

export const metadata: Metadata = { title: "Reminders" };

export default function Page() {
  return <RemindersSettings />;
}
