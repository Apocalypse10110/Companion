import type { Metadata } from "next";
import { PhoneSettings } from "@/ui/screens/settings/PhoneSettings";

export const metadata: Metadata = { title: "Phone and permissions" };

export default function Page() {
  return <PhoneSettings />;
}
