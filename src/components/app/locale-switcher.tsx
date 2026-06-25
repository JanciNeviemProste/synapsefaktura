"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { Languages, Check } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { setLocale } from "@/app/actions/preferences"
import type { Locale } from "@/i18n/request"

const LABELS: Record<Locale, string> = {
  sk: "Slovenčina",
  cz: "Čeština",
  en: "English",
}

const SHORT: Record<Locale, string> = { sk: "SK", cz: "CZ", en: "EN" }

export function LocaleSwitcher() {
  const active = useLocale() as Locale
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function pick(locale: Locale) {
    startTransition(async () => {
      await setLocale(locale)
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label="Jazyk"
          />
        }
      >
        <Languages className="size-4" />
        <span className="sr-only">{SHORT[active]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {(Object.keys(LABELS) as Locale[]).map((loc) => (
            <DropdownMenuItem key={loc} onClick={() => pick(loc)}>
              <Check
                className={
                  loc === active ? "size-4 opacity-100" : "size-4 opacity-0"
                }
              />
              {LABELS[loc]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
