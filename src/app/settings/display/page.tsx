import type { Metadata } from "next";
import { DisplaySettings } from "@/ui/screens/settings/DisplaySettings";

export const metadata: Metadata = { title: "Display settings" };

export default function Page() {
  return <DisplaySettings />;
}
