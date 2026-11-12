import { connect } from "@/accounts/server/handlers";

/** Start signing in to one account (Google, Microsoft or Spotify). */
export async function GET(request: Request, ctx: RouteContext<"/api/accounts/[id]/connect">): Promise<Response> {
  const { id } = await ctx.params;
  return connect(request, id, process.env);
}
