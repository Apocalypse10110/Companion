import type { Metadata } from "next";
import { PhoneSettings } from "@/ui/screens/settings/PhoneSettings";

export const metadata: Metadata = { title: "Device permissions" };

export default function Page() {
  return <PhoneSettings />;
}
