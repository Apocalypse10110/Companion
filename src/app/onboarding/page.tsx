import type { Metadata } from "next";
import { OnboardingScreen } from "@/ui/screens/OnboardingScreen";

export const metadata: Metadata = { title: "Welcome" };

export default function Page() {
  return <OnboardingScreen />;
}
