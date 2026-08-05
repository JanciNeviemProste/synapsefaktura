import { RegisterForm } from "@/components/auth/register-form"
import { isGoogleEnabled } from "@/lib/auth/providers"

export const metadata = { title: "Registrácia — Synapse Faktúra" }

export default async function RegisterPage() {
  return <RegisterForm googleEnabled={await isGoogleEnabled()} />
}
