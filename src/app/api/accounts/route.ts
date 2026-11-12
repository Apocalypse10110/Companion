import { connection } from "next/server";
import { listAccounts } from "@/accounts/server/handlers";

/** Every connected-account slot, and whether it's connected (never the tokens). */
export async function GET(request: Request): Promise<Response> {
  await connection();
  return listAccounts(request, process.env);
}
