import { runPeppolInbound } from "@/lib/jobs/peppol-inbound"
import { isCronAuthorized } from "@/lib/jobs/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 })
  }
  const result = await runPeppolInbound()
  return Response.json(result)
}
