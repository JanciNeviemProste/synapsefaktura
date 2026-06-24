"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Receipt, Sparkles } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import { deleteExpense } from "@/app/actions/expenses"
import { ExpenseForm } from "./expense-form"
import { AiCaptureDialog } from "./ai-capture-dialog"

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

type Expense = Database["public"]["Tables"]["expenses"]["Row"] & {
  contacts?: { name?: string } | null
}
type Supplier = { id: string; name: string }

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export function ExpensesView({
  expenses,
  suppliers,
}: {
  expenses: Expense[]
  suppliers: Supplier[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDone() {
    setOpen(false)
    setEditing(null)
    router.refresh()
  }
  function confirmDelete() {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteExpense(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Náklad zmazaný.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Náklady</h1>
          <p className="text-muted-foreground text-sm">
            Prijaté doklady a výdavky.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCaptureOpen(true)}>
            <Sparkles className="size-4" />
            Vyťažiť doklad (AI)
          </Button>
          <Button
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="size-4" />
            Nový náklad
          </Button>
        </div>
      </div>

      <AiCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />

      {expenses.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Receipt className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ žiadne náklady</p>
            <p className="text-muted-foreground text-sm">
              Pridaj prijatú faktúru alebo bloček.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Dodávateľ</TableHead>
                <TableHead>Číslo</TableHead>
                <TableHead>Kategória</TableHead>
                <TableHead className="text-right">Spolu</TableHead>
                <TableHead className="w-24 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmtDate(e.issue_date)}</TableCell>
                  <TableCell className="font-medium">
                    {e.contacts?.name ?? "—"}
                  </TableCell>
                  <TableCell>{e.document_number ?? "—"}</TableCell>
                  <TableCell>{e.category ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(e.total, e.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(e)
                        setOpen(true)
                      }}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(e)}
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
              {editing ? "Upraviť náklad" : "Nový náklad"}
            </DialogTitle>
            <DialogDescription>Prijatý doklad / výdavok.</DialogDescription>
          </DialogHeader>
          <ExpenseForm
            expense={editing}
            suppliers={suppliers}
            onDone={handleDone}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať náklad?</AlertDialogTitle>
            <AlertDialogDescription>
              Náklad bude natrvalo odstránený.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={pending}>
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
