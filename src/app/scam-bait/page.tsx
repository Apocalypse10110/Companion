import type { Metadata } from "next";
import { ScamBaitScreen } from "@/ui/screens/ScamBaitScreen";

export const metadata: Metadata = { title: "Scam Bait" };

export default function Page() {
  return <ScamBaitScreen />;
}
