"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { CONTACT_TYPE_LABELS } from "@/lib/validation/contact"
import { deleteContact } from "@/app/actions/contacts"
import { ContactForm } from "./contact-form"

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

type Contact = Database["public"]["Tables"]["contacts"]["Row"]

export function ContactsView({ contacts }: { contacts: Contact[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState<Contact | null>(null)
  const [pending, startTransition] = useTransition()

  function openNew() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(c: Contact) {
    setEditing(c)
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
      const res = await deleteContact(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Kontakt zmazaný.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kontakty</h1>
          <p className="text-muted-foreground text-sm">
            Odberatelia a dodávatelia.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nový kontakt
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Users className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ žiadne kontakty</p>
            <p className="text-muted-foreground text-sm">
              Pridaj odberateľa alebo dodávateľa.
            </p>
          </div>
          <Button onClick={openNew} variant="outline">
            <Plus className="size-4" />
            Nový kontakt
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>IČO</TableHead>
                <TableHead>IČ DPH</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-24 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {CONTACT_TYPE_LABELS[
                        c.type as keyof typeof CONTACT_TYPE_LABELS
                      ] ?? c.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.ico ?? "—"}</TableCell>
                  <TableCell>{c.ic_dph ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(c)}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(c)}
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
              {editing ? "Upraviť kontakt" : "Nový kontakt"}
            </DialogTitle>
            <DialogDescription>
              Zadaj IČO a načítaj údaje z registra, alebo vyplň ručne.
            </DialogDescription>
          </DialogHeader>
          <ContactForm contact={editing} onDone={handleDone} />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať kontakt?</AlertDialogTitle>
            <AlertDialogDescription>
              Kontakt „{deleting?.name}" bude natrvalo odstránený.
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
