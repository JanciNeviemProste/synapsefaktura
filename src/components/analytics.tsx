import Script from "next/script"

/**
 * Privacy-first analytics (Plausible). Renders nothing unless
 * `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set — mirrors the graceful-degradation pattern
 * used for AI/email. No cookies, so no consent gating needed.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  if (!domain) return null
  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  )
}
