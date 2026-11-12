import type { Metadata } from "next";
import { PeopleSettings } from "@/ui/screens/settings/PeopleSettings";

export const metadata: Metadata = { title: "People" };

export default function Page() {
  return <PeopleSettings />;
}
