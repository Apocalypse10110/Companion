/**
 * /api/scam-bait: Doris's next line for Scam Bait. Logic lives in src/ai/server/scamBait.ts.
 */
import { geminiWriter, handleScamBait } from "@/ai/server/scamBait";

export async function POST(request: Request): Promise<Response> {
  return handleScamBait(request, geminiWriter(process.env));
}
