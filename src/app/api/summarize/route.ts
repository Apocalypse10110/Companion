/**
 * /api/summarize: a printable lesson card or a family note from a conversation.
 * Logic lives in src/ai/server/summarize.ts.
 */
import { handleSummarize, summarizeWriter } from "@/ai/server/summarize";

export async function POST(request: Request): Promise<Response> {
  return handleSummarize(request, summarizeWriter(process.env));
}
