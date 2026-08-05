"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isGoogleEnabled } from "@/lib/auth/providers"
import { isUnconfirmedEmail, isEmailRateLimited } from "@/lib/auth/errors"

export type AuthActionResult =
  | {
      error: string
      /**
       * Účet existuje, len nie je potvrdený e-mailom. UI podľa toho ponúkne
       * poslať potvrdenie znova — inak by používateľ donekonečna skúšal heslo,
       * ktoré má správne.
       */
      unconfirmedEmail?: boolean
    }
  | undefined

const UNAVAILABLE =
  "Prihlásenie je momentálne nedostupné (služba neodpovedá). Skús to prosím o chvíľu."

/**
 * Runs a Supabase auth call and turns an *infrastructure* failure (unset env,
 * unreachable or paused project) into a readable message. Without this the
 * exception escapes the Server Action and the user only sees the generic
 * „Niečo sa pokazilo" screen from `global-error.tsx`. Auth failures the API
 * reports normally (bad password, taken e-mail) stay in `data.error` and are
 * handled by each caller.
 */
async function withSupabase<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>) => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    return { ok: true, data: await fn(supabase) }
  } catch (err) {
    console.error("[auth] Supabase nedostupné", err)
    return { ok: false, error: UNAVAILABLE }
  }
}

const credentialsSchema = z.object({
  email: z.string().email("Zadaj platný e-mail."),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov."),
})

const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Zadaj meno.").optional(),
})

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const res = await withSupabase((supabase) =>
    supabase.auth.signInWithPassword(parsed.data),
  )
  if (!res.ok) return { error: res.error }
  if (res.data.error) {
    // Doteraz sa KAŽDÉ zlyhanie ohlásilo ako „Nesprávny e-mail alebo heslo."
    // Pri nepotvrdenom účte to bola nepravda, ktorá posielala človeka skúšať
    // heslo, ktoré má správne — a skutočnú príčinu mu nikto nepovedal.
    if (isUnconfirmedEmail(res.data.error)) {
      return {
        error:
          "Účet ešte nie je potvrdený. Pozri sa do e-mailu na potvrdzovací odkaz.",
        unconfirmedEmail: true,
      }
    }
    return { error: "Nesprávny e-mail alebo heslo." }
  }

  revalidatePath("/", "layout")
  redirect("/app/dashboard")
}

export async function signUp(formData: FormData): Promise<AuthActionResult> {
  if (formData.get("consent") !== "on") {
    return { error: "Pre registráciu musíš súhlasiť s podmienkami a spracovaním údajov." }
  }

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const res = await withSupabase((supabase) =>
    supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: parsed.data.fullName
          ? { full_name: parsed.data.fullName }
          : undefined,
      },
    }),
  )
  if (!res.ok) return { error: res.error }
  const { data, error } = res.data
  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  // When email confirmation is required, signUp returns no session — send the
  // user to confirm their inbox instead of into the app (middleware would
  // otherwise bounce them to /login).
  if (!data.session) {
    // Adresa ide so sebou, aby si používateľ vedel nechať poslať potvrdenie
    // znova bez toho, aby ju písal druhýkrát.
    redirect(`/registracia-hotova?email=${encodeURIComponent(parsed.data.email)}`)
  }
  redirect("/app/onboarding")
}

/**
 * Pošle potvrdzovací e-mail znova.
 *
 * Bez toho bol nepotvrdený účet slepá ulička: prihlásiť sa nedalo a registrácia
 * na tú istú adresu druhýkrát tiež nie.
 */
export async function resendConfirmation(
  formData: FormData,
): Promise<AuthActionResult | { ok: true }> {
  const email = z.string().email().safeParse(formData.get("email"))
  if (!email.success) return { error: "Zadaj platný e-mail." }

  const res = await withSupabase((supabase) =>
    supabase.auth.resend({ type: "signup", email: email.data }),
  )
  if (!res.ok) return { error: res.error }
  if (res.data.error) {
    // Časté a mätúce: Supabase má strop na počet odoslaných e-mailov za hodinu.
    if (isEmailRateLimited(res.data.error)) {
      return {
        error:
          "E-mail sa práve posielať nedá (limit odosielania). Skús to o pár minút.",
      }
    }
    return { error: res.data.error.message }
  }
  return { ok: true }
}

export async function signInWithGoogle(): Promise<AuthActionResult> {
  // Overuje sa PRED presmerovaním. `signInWithOAuth` poskytovateľa nekontroluje
  // a vždy vráti adresu, takže pri vypnutom Google používateľ dovtedy pristál
  // na bielej stránke so surovým JSON-om od Supabase.
  if (!(await isGoogleEnabled())) {
    return {
      error:
        "Prihlásenie cez Google zatiaľ nie je nastavené. Použi e-mail a heslo.",
    }
  }

  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL

  const res = await withSupabase((supabase) =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    }),
  )
  if (!res.ok) return { error: res.error }
  const { data, error } = res.data
  if (error || !data.url) {
    return { error: "Prihlásenie cez Google zlyhalo." }
  }

  redirect(data.url)
}

export async function signOut(): Promise<void> {
  // Best effort: even if the service is down, clear the UI and send them out.
  await withSupabase((supabase) => supabase.auth.signOut())
  revalidatePath("/", "layout")
  redirect("/login")
}
