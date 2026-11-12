import { notFound } from "next/navigation";
import { HarnessClient } from "./HarnessClient";

/**
 * Developer-only page for looking at the UI with scripted services.
 * Returns 404 unless NEXT_PUBLIC_COMPANION_HARNESS=1, so it never ships by accident.
 */
export default function Page() {
  if (process.env.NEXT_PUBLIC_COMPANION_HARNESS !== "1") notFound();
  return <HarnessClient />;
}
