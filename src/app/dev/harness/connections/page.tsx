import { notFound } from "next/navigation";
import { ConnectionsHarnessClient } from "./ConnectionsHarnessClient";

/**
 * Developer-only: the Connected accounts screen with demo accounts (one connected, one not),
 * so its states can be seen before Developer C's real sign-in exists.
 * Returns 404 unless NEXT_PUBLIC_COMPANION_HARNESS=1, so it never ships by accident.
 */
export default function Page() {
  if (process.env.NEXT_PUBLIC_COMPANION_HARNESS !== "1") notFound();
  return <ConnectionsHarnessClient />;
}
