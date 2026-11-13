import type { Metadata } from "next";
import { CallShieldScreen } from "@/ui/safety/CallShieldScreen";

export const metadata: Metadata = { title: "Call Shield" };

export default function Page() {
  return <CallShieldScreen />;
}
