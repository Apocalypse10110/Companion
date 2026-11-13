import type { Metadata } from "next";
import { LiveScreen } from "@/ui/live/LiveScreen";

export const metadata: Metadata = { title: "Live Help" };

export default function Page() {
  return <LiveScreen />;
}
