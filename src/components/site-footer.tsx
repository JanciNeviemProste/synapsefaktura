import Link from "next/link"
import { SITE } from "@/lib/site"

const LINKS = [
  { href: "/podmienky", label: "Obchodné podmienky" },
  { href: "/ochrana-osobnych-udajov", label: "Ochrana osobných údajov" },
  { href: "/cookies", label: "Cookies" },
  { href: "/kontakt", label: "Kontakt" },
]

/** Shared public footer with legal links + support contact. */
export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t px-6 py-8 text-sm">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="hover:text-foreground"
          >
            {SITE.supportEmail}
          </a>
        </nav>
        <p>© 2026 {SITE.name} — moderná slovenská fakturácia s AI.</p>
      </div>
    </footer>
  )
}
