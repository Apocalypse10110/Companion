import { connection } from "next/server";
import { email } from "@/accounts/server/handlers";

/** The latest emails from Gmail and/or Outlook, for reading aloud. */
export async function GET(request: Request): Promise<Response> {
  await connection();
  return email(request, process.env);
}
