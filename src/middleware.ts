import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  /*
   * Only the routes that actually need a Supabase session: the protected app
   * area and the two auth pages (session refresh + the two redirects in
   * `updateSession`). Deliberately NOT the marketing/legal/SEO pages — running
   * an auth fetch there made a Supabase outage take down the whole site
   * (2026-08-03: paused project → DNS ENOTFOUND → 25s edge timeout → 504 on `/`).
   * `/auth/callback` is excluded on purpose: it exchanges the OAuth code with
   * its own client and must not be intercepted.
   */
  matcher: ["/app/:path*", "/login", "/register"],
}
