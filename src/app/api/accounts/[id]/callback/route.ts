import { callback } from "@/accounts/server/handlers";

/** Back from the sign-in page: keep the account in an encrypted cookie, then return to Settings. */
export async function GET(request: Request, ctx: RouteContext<"/api/accounts/[id]/callback">): Promise<Response> {
  const { id } = await ctx.params;
  return callback(request, id, process.env);
}
