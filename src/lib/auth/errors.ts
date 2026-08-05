/**
 * Preklad chýb prihlásenia na hlášky, ktoré hovoria pravdu (čisté, bez I/O).
 *
 * Dovtedy sa KAŽDÉ odmietnutie ohlásilo ako „Nesprávny e-mail alebo heslo."
 * Pri nepotvrdenom účte to bola nepravda, ktorá posielala človeka dokola
 * skúšať heslo, ktoré má správne — a skutočnú príčinu mu nikto nepovedal.
 */

export type AuthErrorLike = { message?: string; code?: string }

/**
 * Účet existuje, len nie je potvrdený e-mailom.
 *
 * Kód `email_not_confirmed` pridal GoTrue až neskôr, takže staršie projekty
 * vracajú iba text. Kontrolujú sa preto obe cesty.
 */
export function isUnconfirmedEmail(error: AuthErrorLike): boolean {
  if (error.code === "email_not_confirmed") return true
  return /email not confirmed/i.test(error.message ?? "")
}

/**
 * Supabase odmietol poslať e-mail, lebo naráža na strop za hodinu.
 *
 * Bez rozlíšenia by sa používateľovi ukázala anglická technická hláška
 * v čase, keď stačí počkať.
 */
export function isEmailRateLimited(error: AuthErrorLike): boolean {
  if (error.code === "over_email_send_rate_limit") return true
  return /rate limit|too many requests|after \d+ seconds/i.test(
    error.message ?? "",
  )
}
