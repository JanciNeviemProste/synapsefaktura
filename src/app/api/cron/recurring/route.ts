import { runRecurring } from "@/lib/jobs/recurring"
import { isCronAuthorized } from "@/lib/jobs/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 })
  }
  const result = await runRecurring()
  return Response.json(result)
}
