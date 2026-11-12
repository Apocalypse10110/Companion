import type { Metadata } from "next";
import { HistoryScreen } from "@/ui/screens/HistoryScreen";

export const metadata: Metadata = { title: "History" };

export default function Page() {
  return <HistoryScreen />;
}
