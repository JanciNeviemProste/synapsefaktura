"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, ChevronsUpDown } from "lucide-react"

import { setActiveOrg } from "@/app/actions/preferences"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Org = { id: string; name: string; role: string }

export function OrgSwitcher({
  orgs,
  activeId,
}: {
  orgs: Org[]
  activeId: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const active = orgs.find((o) => o.id === activeId) ?? orgs[0]
  const activeName = active?.name ?? "Firma"

  // A single org: render a static, non-interactive label.
  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
        <Building2 className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate">{activeName}</span>
      </div>
    )
  }

  function select(id: string) {
    if (id === active?.id) return
    startTransition(async () => {
      await setActiveOrg(id)
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium outline-none focus-visible:ring-2 disabled:opacity-50"
      >
        <Building2 className="text-muted-foreground size-4 shrink-0" />
        <span className="flex-1 truncate">{activeName}</span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Firmy</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {orgs.map((o) => (
          <DropdownMenuItem
            key={o.id}
            disabled={pending}
            onClick={() => select(o.id)}
          >
            <span className="flex-1 truncate">{o.name}</span>
            {o.id === active?.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
