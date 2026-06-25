import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a parent pnpm-lock.yaml exists in the
  // home directory, which would otherwise be inferred as the tracing root).
  outputFileTracingRoot: __dirname,
}

// next-intl without locale-prefixed routing — locale resolved from a cookie in
// src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

export default withNextIntl(nextConfig)
