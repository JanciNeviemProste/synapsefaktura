import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a parent pnpm-lock.yaml exists in the
  // home directory, which would otherwise be inferred as the tracing root).
  outputFileTracingRoot: __dirname,
}

export default nextConfig
