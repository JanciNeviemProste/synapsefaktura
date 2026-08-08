import "server-only"

/**
 * Email delivery via the Resend HTTP API (no SDK dependency — mirrors the AI
 * provider's lightweight `fetch` approach). Degrades gracefully: without
 * `RESEND_API_KEY` every send is skipped (never throws), so the app runs and the
 * feature activates the moment the key is present.
 *
 * `EMAIL_FROM` must be a verified Resend sender (e.g. "Faktúry <faktury@tvoja-domena.sk>").
 */

export type EmailAttachment = { filename: string; content: Buffer | Uint8Array }

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
}

export type SendEmailResult = {
  ok: boolean
  /** True when no key is configured — a benign no-op, not an error. */
  skipped?: boolean
  id?: string
  error?: string
}

/** True when an email key is configured; email features degrade gracefully otherwise. */
export function hasEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

const DEFAULT_FROM = "Synapse Faktúra <no-reply@synapse-faktura.sk>"

/** Sends one email with optional attachments. Never throws — errors are returned. */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, skipped: true }

  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content).toString("base64"),
        })),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return {
        ok: false,
        error: `Resend ${res.status}: ${detail.slice(0, 200)}`,
      }
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
