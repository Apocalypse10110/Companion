import type { Metadata } from "next";
import { SkillsScreen } from "@/ui/skills/SkillsScreen";

export const metadata: Metadata = { title: "My Skills" };

export default function Page() {
  return <SkillsScreen />;
}
