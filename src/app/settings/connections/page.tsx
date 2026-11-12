import type { Metadata } from "next";
import { ConnectionsSettings } from "@/ui/screens/settings/ConnectionsSettings";

export const metadata: Metadata = { title: "Connected accounts" };

export default function Page() {
  return <ConnectionsSettings />;
}
