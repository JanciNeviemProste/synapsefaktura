"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Play, Repeat } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { CADENCE_LABELS } from "@/lib/validation/recurring"
import { deleteRecurring, runRecurringNow } from "@/app/actions/recurring"
import { RecurringForm } from "./recurring-form"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Recurring = Database["public"]["Tables"]["recurring_invoices"]["Row"] & {
  contacts?: { name?: string } | null
}
type Contact = { id: string; name: string }

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export function RecurringView({
  recurring,
  contacts,
}: {
  recurring: Recurring[]
  contacts: Contact[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Recurring | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDone() {
    setOpen(false)
    setEditing(null)
    router.refresh()
  }

  function runNow(id: string) {
    startTransition(async () => {
      const res = await runRecurringNow(id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Faktúra vygenerovaná.")
        router.refresh()
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteRecurring(id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Zmazané.")
        router.refresh()
      }
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pravidelné faktúry</h1>
          <p className="text-muted-foreground text-sm">
            Automaticky vystavované faktúry podľa rozvrhu.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus className="size-4" />
          Nová pravidelná
        </Button>
      </div>

      {recurring.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Repeat className="text-muted-foreground size-6" />
          </div>
          <p className="font-medium">Žiadne pravidelné faktúry</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov</TableHead>
                <TableHead>Odberateľ</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Najbližšie</TableHead>
                <TableHead>Po vystavení</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-32 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.contacts?.name ?? "—"}</TableCell>
                  <TableCell>
                    {CADENCE_LABELS[r.cadence as keyof typeof CADENCE_LABELS]}
                  </TableCell>
                  <TableCell>{fmtDate(r.next_run_at)}</TableCell>
                  <TableCell>
                    {r.send_method === "none" ? (
                      <span className="text-muted-foreground text-sm">
                        Len vystaviť
                      </span>
                    ) : (
                      <Badge variant="secondary">
                        {r.send_method === "email" ? "E-mail" : "Peppol"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.active ? (
                      <Badge>Aktívne</Badge>
                    ) : (
                      <Badge variant="outline">Pozastavené</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => runNow(r.id)}
                      disabled={pending}
                      title="Vystaviť teraz"
                    >
                      <Play className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(r)
                        setOpen(true)
                      }}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(r.id)}
                      disabled={pending}
                      title="Zmazať"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Upraviť pravidelnú faktúru"
                : "Nová pravidelná faktúra"}
            </DialogTitle>
            <DialogDescription>
              Šablóna sa použije pri každom automatickom vystavení.
            </DialogDescription>
          </DialogHeader>
          <RecurringForm
            recurring={editing}
            contacts={contacts}
            onDone={handleDone}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
