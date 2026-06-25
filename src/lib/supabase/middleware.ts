import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseEnv } from "./env"

type CookieToSet = { name: string; value: string; options?: CookieOptions }

/**
 * Refreshes the Supabase auth session on every request and guards the
 * authenticated app area. Unauthenticated users hitting protected routes are
 * redirected to /login; authenticated users on auth pages go to the dashboard.
 *
 * This runs on the Edge for EVERY request, so it must never throw — a missing
 * env var or transient auth error would otherwise 500 the entire site with
 * `MIDDLEWARE_INVOCATION_FAILED`. It fails open (lets the request through); the
 * `(shell)` server layout still guards `/app` via its own session check.
 */
export async function updateSession(request: NextRequest) {
  const env = supabaseEnv()
  if (!env.configured) {
    // Not configured yet (e.g. env not set on the deploy) — don't crash the Edge.
    return NextResponse.next({ request })
  }

  try {
    return await refreshAndGuard(
      request,
      env.url as string,
      env.anonKey as string,
    )
  } catch (err) {
    console.error("[middleware] auth refresh failed", err)
    return NextResponse.next({ request })
  }
}

async function refreshAndGuard(
  request: NextRequest,
  url: string,
  anonKey: string,
) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // IMPORTANT: do not run any code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage = pathname === "/login" || pathname === "/register"
  const isProtected = pathname.startsWith("/app")

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/app/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
