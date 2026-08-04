"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Pencil, Plus, Star, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  contactPersonSchema,
  type ContactPersonValues,
} from "@/lib/validation/contact-person"
import {
  createContactPerson,
  deleteContactPerson,
  listContactPersons,
  setPrimaryContactPerson,
  updateContactPerson,
} from "@/app/actions/contact-persons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

type ContactPerson = Database["public"]["Tables"]["contact_persons"]["Row"]

/**
 * Formular osoby je zamerne inline (nie vnoreny Dialog) — panel uz sam bezi v
 * dialogu klienta a stohovanie dvoch popupov nad sebou len komplikuje fokus.
 */
function PersonForm({
  contactId,
  person,
  onSaved,
  onCancel,
}: {
  contactId: string
  person: ContactPerson | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<ContactPersonValues>({
    resolver: zodResolver(contactPersonSchema),
    defaultValues: {
      name: person?.name ?? "",
      position: person?.position ?? "",
      email: person?.email ?? "",
      phone: person?.phone ?? "",
      isPrimary: person?.is_primary ?? false,
      note: person?.note ?? "",
    },
  })

  function onSubmit(values: ContactPersonValues) {
    startSubmit(async () => {
      const res = person
        ? await updateContactPerson(person.id, values)
        : await createContactPerson(contactId, values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(person ? "Osoba upravená." : "Osoba pridaná.")
      onSaved()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-4 rounded-lg border p-3"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meno a priezvisko</FormLabel>
                <FormControl>
                  <Input placeholder="Ján Novák" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Funkcia</FormLabel>
                <FormControl>
                  <Input placeholder="Účtovníčka / nákup" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefón</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Poznámka</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isPrimary"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Hlavná kontaktná osoba</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Zrušiť
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {person ? "Uložiť" : "Pridať"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export function ContactPersonsPanel({ contactId }: { contactId: string }) {
  const [persons, setPersons] = useState<ContactPerson[]>([])
  const [loaded, setLoaded] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ContactPerson | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()
  const [pending, startTransition] = useTransition()

  // Zoznam sa cita az po otvoreni dialogu (server action, nie prop) — stranka
  // klientov by inak tahala osoby vsetkych klientov naraz.
  const reload = useCallback(() => {
    startLoad(async () => {
      const res = await listContactPersons(contactId)
      if (!res.ok) {
        toast.error(res.error)
        setPersons([])
      } else {
        setPersons(res.persons)
      }
      setLoaded(true)
    })
  }, [contactId])

  useEffect(reload, [reload])

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(p: ContactPerson) {
    setEditing(p)
    setFormOpen(true)
  }
  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }
  function handleSaved() {
    closeForm()
    reload()
  }
  function handleSetPrimary(p: ContactPerson) {
    startTransition(async () => {
      const res = await setPrimaryContactPerson(p.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Hlavná osoba nastavená.")
        reload()
      }
    })
  }
  function handleDelete(p: ContactPerson) {
    startTransition(async () => {
      const res = await deleteContactPerson(p.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Osoba zmazaná.")
        reload()
      }
      setConfirmingId(null)
    })
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Ľudia na strane klienta — nákup, účtovníctvo, prevádzka.
        </p>
        {!formOpen && (
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="size-4" />
            Pridať osobu
          </Button>
        )}
      </div>

      {formOpen && (
        <PersonForm
          key={editing?.id ?? "new"}
          contactId={contactId}
          person={editing}
          onSaved={handleSaved}
          onCancel={closeForm}
        />
      )}

      {!loaded || loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Načítavam…
        </div>
      ) : persons.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border py-8 text-center text-sm">
          <UserRound className="size-5" />
          Zatiaľ žiadne kontaktné osoby.
        </div>
      ) : (
        <ul className="grid gap-2">
          {persons.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="grid gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.is_primary && <Badge variant="secondary">Hlavná</Badge>}
                  {p.position && (
                    <span className="text-muted-foreground text-xs">
                      {p.position}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {p.email ?? "—"} · {p.phone ?? "—"}
                </div>
                {p.note && (
                  <div className="text-muted-foreground text-xs">{p.note}</div>
                )}
              </div>
              {confirmingId === p.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    Naozaj zmazať?
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingId(null)}
                  >
                    Nie
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(p)}
                    disabled={pending}
                  >
                    Áno, zmazať
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleSetPrimary(p)}
                    disabled={pending || p.is_primary}
                    title="Nastaviť ako hlavnú"
                  >
                    <Star className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(p)}
                    title="Upraviť"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setConfirmingId(p.id)}
                    title="Zmazať"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
