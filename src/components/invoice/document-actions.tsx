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
} from "lucide-react"
import { toast } from "sonner"

import {
  markAsPaid,
  markAsSent,
  duplicateDocument,
  deleteDocument,
} from "@/app/actions/documents"
import { sendReminder } from "@/app/actions/reminders"
import { Button } from "@/components/ui/button"
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
}: {
  id: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const isPaid = status === "paid"

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
