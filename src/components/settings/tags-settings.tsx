"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Ban } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { TAG_COLORS, contrastText } from "@/lib/validation/tag"
import { createTag, updateTag, deleteTag } from "@/app/actions/tags"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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

type Tag = Database["public"]["Tables"]["tags"]["Row"]

export function TagsSettings({ tags }: { tags: Tag[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)
  const [pending, startTransition] = useTransition()

  // Formular ma dve polia, react-hook-form by tu bol zbytocny.
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>("")

  function openNew() {
    setEditing(null)
    setName("")
    setColor(TAG_COLORS[5])
    setOpen(true)
  }

  function openEdit(t: Tag) {
    setEditing(t)
    setName(t.name)
    setColor(t.color ?? "")
    setOpen(true)
  }

  function save() {
    startTransition(async () => {
      const values = { name, color }
      const res = editing
        ? await updateTag(editing.id, values)
        : await createTag(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editing ? "Štítok upravený." : "Štítok pridaný.")
      setOpen(false)
      setEditing(null)
      router.refresh()
    })
  }

  function confirmDelete() {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteTag(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Štítok zmazaný.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="grid gap-1">
          <CardTitle>Štítky</CardTitle>
          <CardDescription>
            Štítkom označíš faktúry, náklady aj klientov a potom podľa neho
            filtruješ. Názov je jedinečný v rámci firmy.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="size-4" />
          Pridať
        </Button>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Zatiaľ žiadne štítky. Prvý si vytvoríš tlačidlom „Pridať".
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Štítok</TableHead>
                <TableHead>Farba</TableHead>
                <TableHead className="w-20 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Badge
                      variant={t.color ? "default" : "secondary"}
                      style={
                        t.color
                          ? {
                              backgroundColor: t.color,
                              color: contrastText(t.color),
                            }
                          : undefined
                      }
                    >
                      {t.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {t.color ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(t)}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(t)}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť štítok" : "Nový štítok"}
            </DialogTitle>
            <DialogDescription>
              Farba je voliteľná — bez nej sa štítok zobrazí neutrálne.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tag-name">Názov</Label>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Napr. Marketing"
                maxLength={40}
              />
            </div>
            <div className="grid gap-2">
              <Label>Farba</Label>
              <div className="flex flex-wrap items-center gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Farba ${c}`}
                    aria-pressed={color === c}
                    className={
                      color === c
                        ? "ring-ring size-6 rounded-full ring-2 ring-offset-2"
                        : "size-6 rounded-full"
                    }
                    style={{ backgroundColor: c }}
                  />
                ))}
                <Button
                  type="button"
                  variant={color === "" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setColor("")}
                >
                  <Ban className="size-4" />
                  Bez farby
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Náhľad:</span>
              <Badge
                variant={color ? "default" : "secondary"}
                style={
                  color
                    ? { backgroundColor: color, color: contrastText(color) }
                    : undefined
                }
              >
                {name.trim() === "" ? "Štítok" : name}
              </Badge>
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
            <AlertDialogTitle>Zmazať štítok?</AlertDialogTitle>
            <AlertDialogDescription>
              Štítok „{deleting?.name}" sa odstráni aj zo všetkých dokladov,
              nákladov a klientov, ktorým bol priradený. Samotné záznamy
              zostanú.
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
