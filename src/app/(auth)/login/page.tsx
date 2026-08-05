import { LoginForm } from "@/components/auth/login-form"
import { isGoogleEnabled } from "@/lib/auth/providers"

export const metadata = { title: "Prihlásenie — Synapse Faktúra" }

export default async function LoginPage() {
  // Tlačidlo, ktoré nemôže fungovať, sa nemá ukazovať. Stav sa číta zo živého
  // nastavenia projektu, takže sa objaví samo, keď sa Google v Supabase zapne.
  return <LoginForm googleEnabled={await isGoogleEnabled()} />
}
