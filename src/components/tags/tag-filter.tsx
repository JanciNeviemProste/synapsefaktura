import Link from "next/link"

import type { Database } from "@/lib/supabase/database.types"
import { contrastText } from "@/lib/validation/tag"
import { Button } from "@/components/ui/button"

type Tag = Database["public"]["Tables"]["tags"]["Row"]

/**
 * Filter zoznamu podla stitku.
 *
 * Server Component — je to len sada odkazov, ziadny stav. Vdaka tomu funguje
 * aj bez JavaScriptu a vybrany stitok zostava v URL, takze sa da poslat alebo
 * ulozit medzi zalozky.
 *
 * `basePath` je cesta zoznamu (`/app/invoices`), `keep` su parametre, ktore ma
 * filter zachovat — napr. uz zvoleny typ dokladu. Bez toho by kliknutie na
 * stitok ticho zrusilo ostatne filtre.
 */
export function TagFilter({
  tags,
  activeTagId,
  basePath,
  keep,
}: {
  tags: Tag[]
  activeTagId: string | null
  basePath: string
  keep?: Record<string, string | undefined>
}) {
  if (tags.length === 0) return null

  function href(tagId: string | null): string {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(keep ?? {})) {
      if (value) params.set(key, value)
    }
    if (tagId) params.set("tag", tagId)
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <nav aria-label="Filter podľa štítku" className="flex flex-wrap gap-1">
      <Button
        asChild
        size="sm"
        variant={activeTagId ? "ghost" : "secondary"}
        aria-current={activeTagId ? undefined : "page"}
      >
        <Link href={href(null)}>Všetky štítky</Link>
      </Button>
      {tags.map((tag) => {
        const active = tag.id === activeTagId
        return (
          <Button
            key={tag.id}
            asChild
            size="sm"
            variant={active ? "secondary" : "ghost"}
            aria-current={active ? "page" : undefined}
          >
            <Link href={href(active ? null : tag.id)}>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: tag.color ?? "var(--muted-foreground)",
                  // Aktivny farebny stitok dostane aj kontrastny okraj, aby
                  // sa svetla farba nestratila na svetlom pozadi.
                  outline: active && tag.color ? `1px solid ${contrastText(tag.color)}` : undefined,
                }}
                aria-hidden
              />
              {tag.name}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
