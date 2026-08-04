"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import {
  stockBalanceHistory,
  type StockMovementType,
} from "@/lib/stock/balance"
import {
  stockMovementSchema,
  type StockMovementValues,
} from "@/lib/validation/stock-movement"
import {
  createStockMovement,
  listStockMovements,
  type StockMovementRow,
} from "@/app/actions/stock-movements"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Product = Database["public"]["Tables"]["products"]["Row"]

const TYPE_LABELS: Record<StockMovementType, string> = {
  in: "Príjem",
  out: "Výdaj",
  adjustment: "Inventúra",
  return: "Vratka",
}

const TYPE_VARIANTS: Record<
  StockMovementType,
  "secondary" | "destructive" | "outline"
> = {
  in: "secondary",
  out: "destructive",
  adjustment: "outline",
  return: "secondary",
}

/** Mnozstvo na sklade — az 3 desatinne miesta, bez zbytocnych nul. */
export function formatStockQty(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 3 }).format(
    value,
  )
}

/** `adjustment` stav prepisuje, preto "=" a nie znamienko. */
function signOf(type: StockMovementType): string {
  if (type === "out") return "−"
  if (type === "adjustment") return "="
  return "+"
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("sk-SK")
}

/** Dnesok pre `<input type="date">` v lokalnom case, nie v UTC. */
function todayInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function emptyForm(productId: string, type: StockMovementType) {
  return {
    productId,
    type,
    quantity: 1,
    unitCost: undefined,
    movedAt: todayInput(),
    note: "",
  }
}

/**
 * Historia skladovych pohybov polozky + zapis noveho pohybu.
 *
 * Stav sa tu zobrazuje dopocitany z pohybov, nie z `products.stock_qty` —
 * pohyby su zdroj pravdy a `stock_qty` je len ich ulozeny sucet.
 */
export function StockMovementsPanel({
  product,
  onSaved,
}: {
  product: Product
  onSaved?: () => void
}) {
  const [movements, setMovements] = useState<StockMovementRow[] | null>(null)
  const [version, setVersion] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [submitting, startSubmit] = useTransition()

  useEffect(() => {
    let active = true
    listStockMovements(product.id).then((rows) => {
      if (active) setMovements(rows)
    })
    return () => {
      active = false
    }
  }, [product.id, version])

  const form = useForm<StockMovementValues>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: emptyForm(product.id, "in"),
  })

  function onSubmit(values: StockMovementValues) {
    startSubmit(async () => {
      const res = await createStockMovement(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Pohyb zapísaný.")
      form.reset(emptyForm(product.id, values.type))
      setShowForm(false)
      setVersion((v) => v + 1)
      onSaved?.()
    })
  }

  const history = movements ? stockBalanceHistory(movements) : []
  // Najnovsie hore; vypocet ale bezi chronologicky, preto az teraz otacame.
  const rows = [...history].reverse()
  const balance =
    history.length > 0 ? history[history.length - 1].balance : product.stock_qty

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">Stav podľa pohybov</p>
          <p className="text-2xl font-semibold">
            {formatStockQty(balance)}{" "}
            <span className="text-muted-foreground text-base font-normal">
              {product.unit}
            </span>
          </p>
        </div>
        <Button
          variant={showForm ? "outline" : "default"}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="size-4" />
          Nový pohyb
        </Button>
      </div>

      {showForm && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="bg-muted/40 grid gap-4 rounded-lg border p-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typ pohybu</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string) =>
                              TYPE_LABELS[v as StockMovementType] ?? v
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(TYPE_LABELS) as StockMovementType[]).map(
                          (t) => (
                            <SelectItem key={t} value={t}>
                              {TYPE_LABELS[t]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Množstvo</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="movedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dátum</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Obstarávacia cena / j. (voliteľné)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poznámka</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={1}
                        placeholder="Napr. dodávateľ, číslo dodacieho listu"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Množstvo zadávaj vždy kladné — smer určuje typ pohybu. Pri
              inventúre zapíš skutočne zistený stav; prepíše doterajší súčet.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Zrušiť
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Zapísať pohyb
              </Button>
            </div>
          </form>
        </Form>
      )}

      {movements === null ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Načítavam pohyby…
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border py-10 text-center">
          <p className="font-medium">Zatiaľ žiadne pohyby</p>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            Zapíš prvý príjem alebo výdaj. Doterajší stav z cenníka sa uloží ako
            počiatočná inventúra, aby stav sedel s históriou.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Množstvo</TableHead>
                <TableHead className="text-right">Stav po</TableHead>
                <TableHead className="text-right">Obst. cena</TableHead>
                <TableHead>Poznámka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ movement, balance: after }) => (
                <TableRow key={movement.id}>
                  <TableCell>{fmtDate(movement.moved_at)}</TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANTS[movement.type]}>
                      {TYPE_LABELS[movement.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {signOf(movement.type)}
                    {formatStockQty(movement.quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatStockQty(after)}
                  </TableCell>
                  <TableCell className="text-right">
                    {movement.unit_cost === null
                      ? "—"
                      : formatMoney(movement.unit_cost, product.currency)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {movement.note ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
