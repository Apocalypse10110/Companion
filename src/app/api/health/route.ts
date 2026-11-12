import { connection } from "next/server";
import { health } from "@/ai/server/health";

/** Health check for the status page and uptime monitors. 200 when working, 503 when the AI is down. */
export async function GET(): Promise<Response> {
  await connection();
  return health(process.env);
}
