import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import { LEGAL_EFFECTIVE_DATE } from "@/lib/site"

/** Consistent chrome + prose container for public legal pages. */
export function LegalShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        {/* Rovnaký podpis značky ako v navigácii úvodnej stránky. */}
        <Link href="/" className="flex items-center gap-3">
          <span className="font-heading text-lg tracking-tight">
            Synapse Faktúra
          </span>
          <span aria-hidden="true" className="text-xl select-none">
            ✳︎
          </span>
        </Link>
        <Button asChild variant="ghost">
          <Link href="/">Späť na hlavnú</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-heading text-[clamp(28px,4vw,44px)] leading-tight tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Účinné od {LEGAL_EFFECTIVE_DATE}
        </p>
        <div className="[&_a]:text-primary mt-8 space-y-6 text-sm leading-relaxed [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

/** Prominent notice that legal text is a template pending review. */
export function LegalDraftNotice() {
  return (
    <div className="bg-muted text-foreground rounded-lg border p-4 text-sm">
      <strong>Poznámka:</strong> Tento dokument je vzorová šablóna. Pred ostrým
      predajom ho nechaj skontrolovať právnikovi a doplň firemné údaje
      prevádzkovateľa.
    </div>
  )
}
