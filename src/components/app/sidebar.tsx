"use client"

import { Suspense } from "react"
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
  Repeat,
  BarChart3,
  Bot,
  Settings,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  { href: "/app/recurring", key: "recurring", icon: Repeat, ready: true },
  { href: "/app/reports", key: "reports", icon: BarChart3, ready: true },
  { href: "/app/settings", key: "settings", icon: Settings, ready: true },
]

export function Sidebar() {
  return (
    <aside className="bg-background hidden w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <Sparkles className="text-primary size-5" />
        Synapse Faktúra
      </div>
      <Suspense fallback={<nav className="flex flex-1 flex-col gap-1 p-2" />}>
        <SidebarNav />
      </Suspense>
    </aside>
  )
}

// Vlastny komponent kvoli useSearchParams — potrebuje Suspense nad sebou.
function SidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("nav")
  const activeDocType = searchParams.get("type")

  return (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {NAV.map((item) => {
        const [itemPath] = item.href.split("?")
        const active =
          pathname === itemPath && (item.docType ?? null) === activeDocType
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
              <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                čoskoro
              </span>
            </span>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
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
