"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Pencil,
  Download,
  CheckCircle2,
  Send,
  Bell,
  Copy,
  Trash2,
  ArrowRightLeft,
} from "lucide-react"
import { toast } from "sonner"

import {
  markAsPaid,
  markAsSent,
  duplicateDocument,
  deleteDocument,
  convertDocument,
} from "@/app/actions/documents"
import { sendReminder } from "@/app/actions/reminders"
import { conversionTargets } from "@/lib/documents/convert"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DocumentActions({
  id,
  status,
  type,
}: {
  id: string
  status: string
  type: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const isPaid = status === "paid"

  // Typ z DB je obycajny string — pre neznamy typ neponukame ziadny prevod.
  const targets: readonly DocumentType[] =
    type in DOCUMENT_TYPE_LABELS ? conversionTargets(type as DocumentType) : []

  function run<T extends { ok: boolean; error?: string }>(
    fn: () => Promise<T>,
    msg: string | ((res: T) => string),
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? "Akcia zlyhala.")
        return
      }
      toast.success(typeof msg === "function" ? msg(res) : msg)
      router.refresh()
    })
  }

  // Prevod nemeni zdrojovy doklad — vznika novy KONCEPT, ktory otvorime v editore.
  function convert(target: DocumentType) {
    startTransition(async () => {
      const res = await convertDocument(id, target)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Vytvorený koncept „${DOCUMENT_TYPE_LABELS[target]}“. Skontroluj ho a vystav.`,
      )
      router.push(`/app/invoices/${res.id}/edit`)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link href={`/app/invoices/${id}/edit`}>
          <Pencil className="size-4" />
          Upraviť
        </Link>
      </Button>
      <Button asChild variant="outline">
        <a href={`/app/invoices/${id}/pdf`} target="_blank" rel="noreferrer">
          <Download className="size-4" />
          PDF
        </a>
      </Button>
      {!isPaid && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => markAsPaid(id), "Označené ako uhradené.")}
        >
          <CheckCircle2 className="size-4" />
          Uhradené
        </Button>
      )}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => markAsSent(id), (res) =>
            res.delivered
              ? "Faktúra odoslaná e-mailom."
              : "Označené ako odoslané (e-mail nie je nakonfigurovaný).",
          )
        }
      >
        <Send className="size-4" />
        Odoslať e-mailom
      </Button>
      {!isPaid && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => sendReminder(id), "Upomienka odoslaná.")}
        >
          <Bell className="size-4" />
          Upomienka
        </Button>
      )}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await duplicateDocument(id)
            if (!res.ok) {
              toast.error(res.error)
              return
            }
            toast.success("Doklad duplikovaný.")
            router.push(`/app/invoices/${res.id}/edit`)
          })
        }
      >
        <Copy className="size-4" />
        Duplikovať
      </Button>
      {targets.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" disabled={pending}>
                <ArrowRightLeft className="size-4" />
                Previesť na…
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                Vytvorí sa nový koncept, pôvodný doklad zostane bez zmeny.
              </DropdownMenuLabel>
              {targets.map((t) => (
                <DropdownMenuItem
                  key={t}
                  disabled={pending}
                  onClick={() => convert(t)}
                >
                  {DOCUMENT_TYPE_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="ghost" disabled={pending}>
              <Trash2 className="size-4" />
              Zmazať
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať doklad?</AlertDialogTitle>
            <AlertDialogDescription>
              Doklad bude natrvalo odstránený.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteDocument(id)
                  if (!res.ok) {
                    toast.error(res.error)
                    return
                  }
                  toast.success("Doklad zmazaný.")
                  router.push("/app/invoices")
                })
              }
            >
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
