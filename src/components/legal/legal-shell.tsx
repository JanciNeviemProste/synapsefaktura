import Link from "next/link"
import { Sparkles } from "lucide-react"
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
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Sparkles className="text-primary size-5" />
          Synapse Faktúra
        </Link>
        <Button asChild variant="ghost">
          <Link href="/">Späť na hlavnú</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Účinné od {LEGAL_EFFECTIVE_DATE}
        </p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
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
    <div className="border-amber-500/40 bg-amber-500/10 text-foreground rounded-md border p-4 text-sm">
      <strong>Poznámka:</strong> Tento dokument je vzorová šablóna. Pred ostrým
      predajom ho nechaj skontrolovať právnikovi a doplň firemné údaje
      prevádzkovateľa.
    </div>
  )
}
