"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Truck,
  Users,
  Package,
  Receipt,
  Inbox,
  Landmark,
  Wallet,
  Car,
  Repeat,
  BarChart3,
  Bot,
  Settings,
  Sparkles,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type NavItem = {
  href: string
  key: string
  icon: React.ComponentType<{ className?: string }>
  // false = polozka sa neda kliknut a ukaze pilulku "coskoro"
  ready: boolean
  // Doklady maju spolocny zoznam; polozka si predvolia filter ?type=.
  docType?: string
}

// Vsetky polozky su zive. `ready: false` je rezerva pre polozky, ktore chceme
// ukazat skor, nez su hotove.
const NAV: NavItem[] = [
  {
    href: "/app/dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  { href: "/app/invoices", key: "invoices", icon: FileText, ready: true },
  {
    href: "/app/invoices?type=quote",
    key: "quotes",
    icon: ClipboardList,
    ready: true,
    docType: "quote",
  },
  {
    href: "/app/invoices?type=delivery_note",
    key: "deliveryNotes",
    icon: Truck,
    ready: true,
    docType: "delivery_note",
  },
  { href: "/app/assistant", key: "assistant", icon: Bot, ready: true },
  { href: "/app/contacts", key: "contacts", icon: Users, ready: true },
  { href: "/app/products", key: "products", icon: Package, ready: true },
  { href: "/app/expenses", key: "expenses", icon: Receipt, ready: true },
  { href: "/app/einvoices", key: "einvoices", icon: Inbox, ready: true },
  { href: "/app/bank", key: "bank", icon: Landmark, ready: true },
  { href: "/app/cash", key: "cash", icon: Wallet, ready: true },
  { href: "/app/logbook", key: "logbook", icon: Car, ready: true },
  { href: "/app/recurring", key: "recurring", icon: Repeat, ready: true },
  { href: "/app/reports", key: "reports", icon: BarChart3, ready: true },
  { href: "/app/settings", key: "settings", icon: Settings, ready: true },
]

export function Sidebar() {
  return (
    <aside className="bg-sidebar hidden w-60 shrink-0 flex-col border-r md:flex">
      <div className="font-heading flex h-14 items-center gap-2 border-b px-4 text-[15px] tracking-tight">
        <Sparkles className="text-primary size-5" />
        Synapse Faktúra
      </div>
      <Suspense fallback={<nav className="flex flex-1 flex-col gap-1 p-2" />}>
        <SidebarNav />
      </Suspense>
    </aside>
  )
}

/**
 * Mobilna navigacia. Pod `md` je `Sidebar` skryty, takze bez tohto tlacidla sa
 * pouzivatel na telefone nedostal z aktualnej stranky prec. Panel renderuje ten
 * isty NAV zoznam (jeden zdroj pravdy) a Dialog riesi focus trap aj Escape.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Otvoriť menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <Menu />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="data-open:slide-in-from-left data-closed:slide-out-to-left top-0 left-0 flex h-full w-72 max-w-[85%] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-[85%]">
          <DialogTitle className="font-heading flex h-14 shrink-0 items-center gap-2 border-b px-4 text-[15px] tracking-tight">
            <Sparkles className="text-primary size-5" />
            Synapse Faktúra
          </DialogTitle>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <Suspense
              fallback={<nav className="flex flex-1 flex-col gap-1 p-2" />}
            >
              <SidebarNav onNavigate={() => setOpen(false)} />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Vlastny komponent kvoli useSearchParams — potrebuje Suspense nad sebou.
// `onNavigate` pouziva iba mobilny panel, aby sa po kliku zavrel.
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("nav")
  const activeDocType = searchParams.get("type")

  return (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {NAV.map((item) => {
        const [itemPath] = item.href.split("?")
        // Podstranky dokladu (`/app/invoices/new`, `/app/invoices/<id>`) patria
        // pod polozku „Faktury". Bez toho sa pri vystavovani dokladu zhasla
        // cela navigacia a pouzivatel nevidel, kde vlastne je.
        const onSubPage =
          itemPath !== "/app" && pathname.startsWith(`${itemPath}/`)
        const active =
          (pathname === itemPath || onSubPage) &&
          (item.docType ?? null) === activeDocType
        const Icon = item.icon

        if (!item.ready) {
          return (
            <span
              key={item.href}
              className="text-muted-foreground/60 flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-3 py-2 text-sm"
              title="Čoskoro"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4" />
                {t(item.key)}
              </span>
              <span className="bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium uppercase">
                čoskoro
              </span>
            </span>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              // Pilulka, rovnako ako tlacidla — jeden tvar drzi cely produkt.
              "flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(item.key)}
          </Link>
        )
      })}
    </nav>
  )
}
