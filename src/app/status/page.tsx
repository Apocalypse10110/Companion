import type { Metadata } from "next";
import { StatusScreen } from "@/ui/screens/StatusScreen";

export const metadata: Metadata = { title: "Status" };

export default function Page() {
  return <StatusScreen />;
}
