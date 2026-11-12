/**
 * GET /api/health: is Companion working? For the status page, uptime monitors and judges.
 * Never includes keys or personal data. The AI check is cached for 5 minutes.
 */
import { isConfigured, type AccountId } from "@/accounts/server/config";
import { geminiHealth, parseModelList, type GeminiHealth } from "./gemini";
import { providerName, type AIEnv } from "./handler";

const CACHE_MS = 5 * 60_000;
let cached: { at: number; key: string; value: GeminiHealth } | null = null;

export async function health(env: AIEnv, check: typeof geminiHealth = geminiHealth): Promise<Response> {
  const provider = providerName(env);
  let ai: { configured: boolean; provider: string | null; reachable?: boolean; model?: string; checkedMs?: number; problem?: string };
  if (provider === "gemini" || provider === "google") {
    const key = env.GEMINI_API_KEY || env.AI_API_KEY || "";
    if (!key) ai = { configured: false, provider: "gemini", problem: "missing-key" };
    else {
      const models = parseModelList(env.AI_MODEL);
      const cacheKey = `${key.length}:${models.join(",")}`;
      if (!cached || cached.key !== cacheKey || Date.now() - cached.at > CACHE_MS) cached = { at: Date.now(), key: cacheKey, value: await check(key, models) };
      const h = cached.value;
      ai = { configured: true, provider: "gemini", reachable: h.ok, model: h.model, checkedMs: h.ms, ...(h.problem ? { problem: h.problem } : {}) };
    }
  } else {
    ai = { configured: Boolean(provider), provider: provider || null };
  }
  const accounts = Object.fromEntries((["gmail", "google-calendar", "outlook", "spotify"] as AccountId[]).map((id) => [id, isConfigured(id, env)]));
  const ok = !ai.configured || ai.reachable !== false;
  return Response.json(
    {
      ok,
      time: new Date().toISOString(),
      version: (env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
      region: env.VERCEL_REGION ?? null,
      ai,
      accounts,
      // Works with no AI and no internet once open: calls, texts, reminders, settings.
      onDevice: true,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** For tests. */
export function resetHealthCache(): void {
  cached = null;
}
