/**
 * /api/assistant: the server side of the assistant. Keeps the AI key on the server.
 *   POST: understand one sentence (answers 503 when no AI is configured; the app then works on the device).
 *   GET:  { configured, provider, problem } so the app and a deploy check can see whether AI is on.
 * Logic lives in src/ai/server/handler.ts.
 */
import { connection } from "next/server";
import { assistantStatus, handleAssistantRequest, interpreterFromEnv } from "@/ai/server/handler";

export async function POST(request: Request): Promise<Response> {
  return handleAssistantRequest(request, interpreterFromEnv(process.env));
}

export async function GET(): Promise<Response> {
  // Read the environment at request time, not once at build time.
  await connection();
  return assistantStatus(process.env);
}
