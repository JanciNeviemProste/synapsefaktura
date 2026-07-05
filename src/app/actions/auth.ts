"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export type AuthActionResult = { error: string } | undefined

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

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
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

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: parsed.data.fullName
        ? { full_name: parsed.data.fullName }
        : undefined,
    },
  })
  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  // When email confirmation is required, signUp returns no session — send the
  // user to confirm their inbox instead of into the app (middleware would
  // otherwise bounce them to /login).
  if (!data.session) {
    redirect("/registracia-hotova")
  }
  redirect("/app/onboarding")
}

export async function signInWithGoogle(): Promise<AuthActionResult> {
  const supabase = await createClient()
  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  })
  if (error || !data.url) {
    return { error: "Prihlásenie cez Google zlyhalo." }
  }

  redirect(data.url)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
