"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Wallet, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import { cashBalancesByRegister, cashTotals } from "@/lib/cash/balance"
import { CASH_DIRECTION_LABELS } from "@/lib/validation/cash-register"
import {
  deleteCashItem,
  deleteCashRegister,
} from "@/app/actions/cash-registers"
import { CashRegisterForm } from "./cash-register-form"
import {
  CashItemForm,
  type ContactOption,
  type DocumentOption,
  type ExpenseOption,
} from "./cash-item-form"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type CashRegister = Database["public"]["Tables"]["cash_registers"]["Row"]
type CashItem = Database["public"]["Tables"]["cash_register_items"]["Row"] & {
  contacts?: { name: string } | null
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("sk-SK")
}

export function CashView({
  registers,
  items,
  contacts,
  documents,
  expenses,
}: {
  registers: CashRegister[]
  items: CashItem[]
  contacts: ContactOption[]
  documents: DocumentOption[]
  expenses: ExpenseOption[]
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(
    registers[0]?.id ?? null,
  )
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState<CashRegister | null>(null)
  const [deletingRegister, setDeletingRegister] = useState<CashRegister | null>(
    null,
  )
  const [itemOpen, setItemOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<CashItem | null>(null)
  const [pending, startTransition] = useTransition()

  const balances = useMemo(() => cashBalancesByRegister(items), [items])
  const selected = registers.find((r) => r.id === selectedId) ?? null
  const selectedItems = useMemo(
    () => items.filter((i) => i.cash_register_id === selectedId),
    [items, selectedId],
  )
  const totals = useMemo(() => cashTotals(selectedItems), [selectedItems])

  function openNewRegister() {
    setEditing(null)
    setRegisterOpen(true)
  }
  function handleRegisterDone() {
    setRegisterOpen(false)
    setEditing(null)
    router.refresh()
  }
  function handleItemDone() {
    setItemOpen(false)
    router.refresh()
  }
  function confirmDeleteRegister() {
    if (!deletingRegister) return
    const id = deletingRegister.id
    startTransition(async () => {
      const res = await deleteCashRegister(id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Pokladňa zmazaná.")
        if (selectedId === id) setSelectedId(null)
        router.refresh()
      }
      setDeletingRegister(null)
    })
  }
  function confirmDeleteItem() {
    if (!deletingItem) return
    startTransition(async () => {
      const res = await deleteCashItem(deletingItem.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Doklad zmazaný.")
        router.refresh()
      }
      setDeletingItem(null)
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pokladňa</h1>
          <p className="text-muted-foreground text-sm">
            Príjmové a výdavkové doklady v hotovosti.
          </p>
        </div>
        <Button onClick={openNewRegister}>
          <Plus className="size-4" />
          Nová pokladňa
        </Button>
      </div>

      {registers.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Wallet className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ nemáš pokladňu</p>
            <p className="text-muted-foreground text-sm">
              Vytvor pokladňu a zapisuj do nej hotovostné doklady.
            </p>
          </div>
          <Button onClick={openNewRegister} variant="outline">
            <Plus className="size-4" />
            Nová pokladňa
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pokladňa</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead className="text-right">Dokladov</TableHead>
                <TableHead className="text-right">Zostatok</TableHead>
                <TableHead className="w-24 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registers.map((r) => {
                const balance = balances[r.id] ?? 0
                const count = items.filter(
                  (i) => i.cash_register_id === r.id,
                ).length
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={
                      r.id === selectedId ? "bg-muted/60" : "cursor-pointer"
                    }
                  >
                    <TableCell className="font-medium">
                      {r.name}
                      {!r.active && (
                        <Badge variant="outline" className="ml-2">
                          neaktívna
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.description ?? "—"}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                    <TableCell
                      className={
                        balance < 0
                          ? "text-destructive text-right font-medium"
                          : "text-right font-medium"
                      }
                    >
                      {formatMoney(balance, r.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(r)
                          setRegisterOpen(true)
                        }}
                        title="Upraviť"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingRegister(r)
                        }}
                        title="Zmazať"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {selected && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Doklady — {selected.name}
              </h2>
              <p className="text-muted-foreground text-sm">
                Príjmy {formatMoney(totals.income, selected.currency)} · Výdavky{" "}
                {formatMoney(totals.expense, selected.currency)} · Zostatok{" "}
                <span
                  className={
                    totals.balance < 0
                      ? "text-destructive font-medium"
                      : "text-foreground font-medium"
                  }
                >
                  {formatMoney(totals.balance, selected.currency)}
                </span>
              </p>
            </div>
            <Button variant="outline" onClick={() => setItemOpen(true)}>
              <Plus className="size-4" />
              Nový doklad
            </Button>
          </div>

          {totals.balance < 0 && (
            <p className="text-destructive flex items-center gap-2 text-sm">
              <TriangleAlert className="size-4" />
              Záporný zostatok — pravdepodobne chýba príjmový doklad.
            </p>
          )}

          {selectedItems.length === 0 ? (
            <div className="bg-card text-muted-foreground rounded-lg border py-10 text-center text-sm">
              V tejto pokladni zatiaľ nie je žiadny doklad.
            </div>
          ) : (
            <div className="bg-card rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Číslo</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Popis</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead className="text-right">Suma</TableHead>
                    <TableHead className="text-right">z toho DPH</TableHead>
                    <TableHead className="w-12 text-right">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{formatDate(i.issued_on)}</TableCell>
                      <TableCell>{i.number ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            i.direction === "in" ? "secondary" : "outline"
                          }
                        >
                          {CASH_DIRECTION_LABELS[i.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell>{i.description ?? "—"}</TableCell>
                      <TableCell>{i.contacts?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {i.direction === "out" ? "− " : "+ "}
                        {formatMoney(i.amount, selected.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {formatMoney(i.vat_amount, selected.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeletingItem(i)}
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
        </div>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť pokladňu" : "Nová pokladňa"}
            </DialogTitle>
            <DialogDescription>
              Hotovostná pokladňa firmy. Doklady sa zapisujú do nej.
            </DialogDescription>
          </DialogHeader>
          <CashRegisterForm register={editing} onDone={handleRegisterDone} />
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nový pokladničný doklad</DialogTitle>
            <DialogDescription>
              Príjmový alebo výdavkový doklad pokladne
              {selected ? ` „${selected.name}"` : ""}.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <CashItemForm
              register={{
                id: selected.id,
                name: selected.name,
                currency: selected.currency,
              }}
              contacts={contacts}
              documents={documents}
              expenses={expenses}
              onDone={handleItemDone}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingRegister}
        onOpenChange={(o) => !o && setDeletingRegister(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať pokladňu?</AlertDialogTitle>
            <AlertDialogDescription>
              Pokladňa „{deletingRegister?.name}" sa zmaže aj so všetkými
              dokladmi, ktoré sú v nej zapísané.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRegister}
              disabled={pending}
            >
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deletingItem}
        onOpenChange={(o) => !o && setDeletingItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať doklad?</AlertDialogTitle>
            <AlertDialogDescription>
              Doklad bude natrvalo odstránený a zostatok pokladne sa prepočíta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} disabled={pending}>
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
