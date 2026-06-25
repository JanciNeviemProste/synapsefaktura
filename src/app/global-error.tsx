"use client"

import { useEffect } from "react"

// global-error.tsx replaces the root layout when an error escapes it, so it must
// render its own <html>/<body>. (A plain root error.tsx renders *inside* the
// layout and must NOT emit <html>.)
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="sk">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#0a0a0a",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 28 + "rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Niečo sa pokazilo
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#71717a", margin: "0 0 1.5rem" }}>
            Vyskytla sa neočakávaná chyba. Skús to prosím znova.
          </p>
          <button
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0a0a0a",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "0.5rem 1rem",
            }}
          >
            Skúsiť znova
          </button>
        </div>
      </body>
    </html>
  )
}
