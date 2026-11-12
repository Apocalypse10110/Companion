import { disconnect } from "@/accounts/server/handlers";

/** Forget one account on this phone (and ask Google to revoke access). */
export async function POST(request: Request, ctx: RouteContext<"/api/accounts/[id]/disconnect">): Promise<Response> {
  const { id } = await ctx.params;
  return disconnect(request, id, process.env);
}
