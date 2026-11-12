import { connection } from "next/server";
import { calendar } from "@/accounts/server/handlers";

/** Calendar events between ?from= and ?to= (the phone's own day, worked out on the phone). */
export async function GET(request: Request): Promise<Response> {
  await connection();
  return calendar(request, process.env);
}
