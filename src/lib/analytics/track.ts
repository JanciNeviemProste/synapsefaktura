/**
 * Fire a custom analytics event (Plausible). No-op when analytics isn't loaded,
 * so it's always safe to call from client components.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number>,
) {
  if (typeof window === "undefined") return
  const plausible = (
    window as unknown as {
      plausible?: (n: string, o?: { props?: Record<string, unknown> }) => void
    }
  ).plausible
  plausible?.(name, props ? { props } : undefined)
}
