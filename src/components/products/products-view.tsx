"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Package, Boxes } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import { vatRateLabel } from "@/lib/vat/rates"
import { deleteProduct } from "@/app/actions/products"
import { ProductForm } from "./product-form"
import { StockMovementsPanel, formatStockQty } from "./stock-movements-panel"

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

type Product = Database["public"]["Tables"]["products"]["Row"]

export function ProductsView({ products }: { products: Product[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [stockId, setStockId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Zamerne cez id, nie ulozeny objekt — po `router.refresh()` tak panel dostane
  // cerstvy riadok a nie stav spred zapisu pohybu.
  const stockOf = products.find((p) => p.id === stockId) ?? null

  function openNew() {
    setEditing(null)
    setOpen(true)
  }
  function handleDone() {
    setOpen(false)
    setEditing(null)
    router.refresh()
  }
  function confirmDelete() {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteProduct(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Položka zmazaná.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[clamp(24px,3.2vw,34px)] leading-tight tracking-tight">Cenník</h1>
          <p className="text-muted-foreground text-sm">
            Položky a služby pre rýchle pridanie na faktúru.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nová položka
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Package className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Cenník je prázdny</p>
            <p className="text-muted-foreground text-sm">
              Pridaj položku alebo službu.
            </p>
          </div>
          <Button onClick={openNew} variant="outline">
            <Plus className="size-4" />
            Nová položka
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Cena / j.</TableHead>
                <TableHead>Jedn.</TableHead>
                <TableHead>DPH</TableHead>
                <TableHead className="text-right">Sklad</TableHead>
                <TableHead className="w-32 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(p.unit_price, p.currency)}
                  </TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell>{vatRateLabel(p.vat_rate)}</TableCell>
                  <TableCell className="text-right">
                    {formatStockQty(p.stock_qty)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setStockId(p.id)}
                      title="Skladové pohyby"
                    >
                      <Boxes className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(p)
                        setOpen(true)
                      }}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(p)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť položku" : "Nová položka"}
            </DialogTitle>
            <DialogDescription>Položka cenníka.</DialogDescription>
          </DialogHeader>
          <ProductForm product={editing} onDone={handleDone} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockOf} onOpenChange={(o) => !o && setStockId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Skladové pohyby — {stockOf?.name}</DialogTitle>
            <DialogDescription>
              História príjmov a výdajov. Stav v cenníku je ich súčet.
            </DialogDescription>
          </DialogHeader>
          {stockOf && (
            <StockMovementsPanel
              product={stockOf}
              onSaved={() => router.refresh()}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať položku?</AlertDialogTitle>
            <AlertDialogDescription>
              Položka „{deleting?.name}" bude natrvalo odstránená.
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
