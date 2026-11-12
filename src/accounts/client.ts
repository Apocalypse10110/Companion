/**
 * ConnectionsService (contract: src/contracts/connections.ts) on top of /api/accounts.
 * Sign-in happens on the account's own page (Google, Microsoft, Spotify), then comes back to
 * Settings -> Connected accounts. The phone never sees the tokens: they're in an encrypted,
 * httpOnly cookie that only Companion's server can read.
 */
import type { ConnectionId, ConnectionInfo, ConnectionResult, ConnectionsService } from "@/contracts";

const NAMES: Record<string, string> = { gmail: "Gmail", "google-calendar": "Google Calendar", outlook: "Outlook", spotify: "Spotify" };

function info(id: ConnectionId, state: ConnectionInfo["state"] = "unavailable"): ConnectionInfo {
  return { id, name: NAMES[id] ?? "This account", state };
}

export function createConnections(fetchImpl: typeof fetch = (...a) => fetch(...a), go: (url: string) => void = (u) => window.location.assign(u)): ConnectionsService {
  return {
    async list() {
      const res = await fetchImpl("/api/accounts", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ConnectionInfo[];
    },

    connect(id) {
      // Leave for the sign-in page. This promise only settles if the page didn't change.
      go(`/api/accounts/${encodeURIComponent(id)}/connect`);
      return new Promise<ConnectionResult>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, connection: info(id, "disconnected"), message: "The sign-in page didn't open. Please try again." }),
          15_000,
        ),
      );
    },

    async disconnect(id) {
      try {
        const res = await fetchImpl(`/api/accounts/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok: true, connection: info(id, "disconnected"), message: `${NAMES[id] ?? "The account"} is disconnected. I've forgotten it on this phone.` };
      } catch {
        return { ok: false, connection: info(id, "connected"), message: "I couldn't disconnect it just now. Please try again." };
      }
    },
  };
}

export const connections = createConnections();

/** What came back from a sign-in, read from the address (?connected=gmail or ?error=gmail:cancelled). */
export function signInOutcome(search: string): { tone: "success" | "info" | "error"; text: string; id?: string } | null {
  const p = new URLSearchParams(search);
  const ok = p.get("connected");
  if (ok) return { tone: "success", id: ok, text: `${NAMES[ok] ?? "Your account"} is connected.` };
  const err = p.get("error");
  if (!err) return null;
  const [id, why] = err.split(":");
  const name = NAMES[id] ?? "That account";
  if (why === "cancelled") return { tone: "info", id, text: `You didn't finish signing in to ${name}, so nothing changed.` };
  if (why === "unavailable") return { tone: "error", id, text: `${name} hasn't been set up on Companion's server yet.` };
  return { tone: "error", id, text: `I couldn't connect ${name}. Please try again.` };
}
