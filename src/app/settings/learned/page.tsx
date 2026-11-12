import type { Metadata } from "next";
import { LearnedSettings } from "@/ui/screens/settings/LearnedSettings";

export const metadata: Metadata = { title: "Things you can do" };

export default function Page() {
  return <LearnedSettings />;
}
