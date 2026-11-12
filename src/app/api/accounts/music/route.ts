import { music } from "@/accounts/server/handlers";

/** Find music on Spotify, and play it if the person's Spotify is connected (Premium). */
export async function POST(request: Request): Promise<Response> {
  return music(request, process.env);
}
