import type { Metadata } from "next";
import { SafetyScreen } from "@/ui/safety/SafetyScreen";

export const metadata: Metadata = { title: "Safety" };

export default function Page() {
  return <SafetyScreen />;
}
