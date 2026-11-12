import type { Metadata } from "next";
import { VoiceSettings } from "@/ui/screens/settings/VoiceSettings";

export const metadata: Metadata = { title: "Voice settings" };

export default function Page() {
  return <VoiceSettings />;
}
