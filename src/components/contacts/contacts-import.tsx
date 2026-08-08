"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { importContacts } from "@/app/actions/contacts"
import { MAX_IMPORT_BYTES, tooLargeMessage } from "@/lib/upload/limits"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Import klientov z tabuľky.
 *
 * Podporuje zošit Excelu (.xlsx) aj CSV. Formát sa rozpoznáva z OBSAHU, nie
 * z prípony — premenovaný súbor je bežná vec a používateľ by inak dostal
 * hlášku, ktorá s príčinou nesúvisí.
 *
 * Vzorová tabuľka sa dá stiahnuť rovno tu a je generovaná z tých istých
 * konštánt, ktoré import očakáva, takže sa s ním nemôže rozísť.
 */
export function ContactsImport() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [report, setReport] = useState<string[] | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (file.size > MAX_IMPORT_BYTES) {
      toast.error(tooLargeMessage(file.size, MAX_IMPORT_BYTES))
      return
    }

    setReport(null)
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set("file", file)
        const res = await importContacts(fd)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.imported === 0) {
          toast.info("Nepribudol ani jeden nový kontakt.")
        } else {
          toast.success(
            `Importovaných ${res.imported}${
              res.skipped > 0 ? `, preskočených ${res.skipped}` : ""
            }.`,
          )
        }
        // Zoznam preskocenych a chybnych riadkov ostane na obrazovke —
        // v toaste by zmizol skor, nez by sa dal precitat.
        setReport(res.errors.length > 0 ? res.errors : null)
        router.refresh()
      } catch {
        toast.error("Súbor sa nepodarilo načítať. Skús to znova.")
      }
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import z tabuľky
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import klientov z tabuľky</DialogTitle>
            <DialogDescription>
              Zošit Excelu (.xlsx) aj CSV. Povinný je jediný stĺpec —{" "}
              <strong>Názov</strong>. Ostatné sú voliteľné a poradie stĺpcov
              nerozhoduje, hľadajú sa podľa názvu hlavičky.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Button asChild variant="outline" className="justify-start">
              <a href="/app/contacts/vzor" download>
                <Download className="size-4" />
                Stiahnuť vzorovú tabuľku
              </a>
            </Button>

            <div className="grid gap-2">
              <Input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFile}
                disabled={busy}
              />
              <p className="text-muted-foreground text-xs">
                Klient, ktorý už existuje (podľa IČO alebo názvu), sa preskočí —
                import nič neprepisuje.
              </p>
            </div>

            {busy ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Spracúvam…
              </p>
            ) : null}

            {report ? (
              <div className="grid gap-1">
                <p className="text-sm font-medium">Preskočené riadky</p>
                <ul className="text-muted-foreground max-h-48 overflow-y-auto text-xs">
                  {report.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
