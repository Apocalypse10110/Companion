/**
 * POST /api/assistant: optional AI understanding for sentences the on-device rules can't place.
 * Keeps the AI key on the server. Answers 503 when no AI is configured, and the app then
 * works fully on the device. Logic lives in src/ai/server/handler.ts (Developer B).
 */

import { handleAssistantRequest, interpreterFromEnv } from "@/ai/server/handler";

export async function POST(request: Request): Promise<Response> {
  return handleAssistantRequest(request, interpreterFromEnv(process.env));
}
