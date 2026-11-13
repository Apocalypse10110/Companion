/**
 * /api/live/token: a short-lived Gemini Live token for Live Help. The real key stays on the server.
 * Logic lives in src/ai/server/live.ts.
 */
import { geminiTokenMaker, handleLiveToken, liveModels } from "@/ai/server/live";

export async function POST(request: Request): Promise<Response> {
  return handleLiveToken(request, geminiTokenMaker(process.env), liveModels(process.env));
}
