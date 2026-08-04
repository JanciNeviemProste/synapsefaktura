"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Star } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatIban } from "@/lib/validation/bank-account"
import {
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
} from "@/app/actions/bank-accounts"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DialogFooter,
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

type BankAccount = Database["public"]["Tables"]["bank_accounts"]["Row"]

export function BankAccountsSettings({
  accounts,
}: {
  accounts: BankAccount[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)
  const [deleting, setDeleting] = useState<BankAccount | null>(null)
  const [pending, startTransition] = useTransition()

  // Controlled form state (small enough to skip react-hook-form here).
  const [iban, setIban] = useState("")
  const [swift, setSwift] = useState("")
  const [bankName, setBankName] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [isDefault, setIsDefault] = useState(false)

  function openNew() {
    setEditing(null)
    setIban("")
    setSwift("")
    setBankName("")
    setCurrency("EUR")
    setIsDefault(accounts.length === 0)
    setOpen(true)
  }

  function openEdit(a: BankAccount) {
    setEditing(a)
    setIban(formatIban(a.iban))
    setSwift(a.swift ?? "")
    setBankName(a.bank_name ?? "")
    setCurrency(a.currency)
    setIsDefault(a.is_default)
    setOpen(true)
  }

  function save() {
    startTransition(async () => {
      const values = { iban, swift, bankName, currency, isDefault }
      const res = editing
        ? await updateBankAccount(editing.id, values)
        : await createBankAccount(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editing ? "Účet upravený." : "Účet pridaný.")
      setOpen(false)
      setEditing(null)
      router.refresh()
    })
  }

  function makeDefault(a: BankAccount) {
    startTransition(async () => {
      const res = await setDefaultBankAccount(a.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Predvolený účet nastavený.")
      router.refresh()
    })
  }

  function confirmDelete() {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteBankAccount(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Účet zmazaný.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="grid gap-1">
          <CardTitle>Bankové účty</CardTitle>
          <CardDescription>
            Predvolený účet sa tlačí na faktúru a generuje sa z neho PAY by
            square QR kód.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="size-4" />
          Pridať
        </Button>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Zatiaľ žiadny bankový účet. Bez IBAN nebudú na faktúre platobné
            údaje ani QR kód.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IBAN</TableHead>
                <TableHead>Banka</TableHead>
                <TableHead>SWIFT</TableHead>
                <TableHead>Mena</TableHead>
                <TableHead className="w-28 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    <span className="mr-2">{formatIban(a.iban)}</span>
                    {a.is_default ? (
                      <Badge variant="secondary">Predvolený</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{a.bank_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.swift ?? "—"}
                  </TableCell>
                  <TableCell>{a.currency}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => makeDefault(a)}
                      disabled={a.is_default || pending}
                      title="Nastaviť ako predvolený"
                    >
                      <Star
                        className={
                          a.is_default ? "size-4 fill-current" : "size-4"
                        }
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(a)}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(a)}
                      title="Zmazať"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť bankový účet" : "Nový bankový účet"}
            </DialogTitle>
            <DialogDescription>
              IBAN sa ukladá bez medzier a kontroluje sa kontrolná číslica.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bank-iban">IBAN</Label>
              <Input
                id="bank-iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="SK89 7500 0000 0000 1234 5671"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bank-swift">SWIFT / BIC</Label>
                <Input
                  id="bank-swift"
                  value={swift}
                  onChange={(e) => setSwift(e.target.value)}
                  placeholder="TATRSKBX"
                  className="font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank-currency">Mena</Label>
                <Input
                  id="bank-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="EUR"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank-name">Názov banky</Label>
              <Input
                id="bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Napr. Tatra banka"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-1">
                <Label htmlFor="bank-default">Predvolený účet</Label>
                <p className="text-muted-foreground text-sm">
                  Použije sa na faktúrach. Predvolený môže byť len jeden účet.
                </p>
              </div>
              <Switch
                id="bank-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={save} disabled={pending}>
              {editing ? "Uložiť" : "Pridať"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať bankový účet?</AlertDialogTitle>
            <AlertDialogDescription>
              Účet {deleting ? formatIban(deleting.iban) : ""} bude natrvalo
              odstránený. Ak bol predvolený, prevezme to iný účet — ak je
              posledný, faktúry ostanú bez platobných údajov.
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
    </Card>
  )
}
