"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  setBrandingImage,
  removeOrgImage,
  getBrandingSignedUrl,
  type BrandingImage as BrandingImageKind,
} from "@/app/actions/org"
import { uploadDirect } from "@/lib/upload/direct"

import { MAX_IMAGE_BYTES, tooLargeMessage } from "@/lib/upload/limits"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Nahrávanie jedného firemného obrázka (logo / podpis / pečiatka).
 *
 * Náhľad ide cez podpísanú adresu platnú 10 minút — súbory sú v súkromnom
 * úložisku a verejná adresa obrázku podpisu by bola návod na falšovanie.
 * Preto ani `next/image`: podpísaná adresa má obmedzenú platnosť a optimalizér
 * by si ju cacheoval dlhšie, než platí.
 */
export function BrandingImageField({
  kind,
  label,
  description,
  path,
  canManage,
}: {
  kind: BrandingImageKind
  label: string
  description: string
  /** Uložená cesta v úložisku, alebo `null`. */
  path: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  // Podpisana adresa sa drzi SPOLU s cestou, ku ktorej patri. Bez toho by sa
  // po vymene obrazka na chvilu ukazal ten predchadzajuci — a vynulovat stav
  // priamo v efekte znamena kaskadu prekresleni.
  const [signed, setSigned] = useState<{ path: string; url: string | null }>({
    path: "",
    url: null,
  })

  // Starsie zaznamy mozu drzat priamu adresu; tie sa nepodpisuju.
  const directUrl = path && /^https?:\/\//i.test(path) ? path : null
  const storagePath = path && !directUrl ? path : null

  useEffect(() => {
    if (!storagePath) return
    let alive = true
    getBrandingSignedUrl(storagePath).then((url) => {
      if (alive) setSigned({ path: storagePath, url })
    })
    return () => {
      alive = false
    }
  }, [storagePath])

  const previewUrl =
    directUrl ?? (signed.path === storagePath ? signed.url : null)
  // Odlisi „este sa nacitava" od „nacitanie zlyhalo". Bez toho ostal nahlad
  // navzdy na „Nacitavam…", hoci sa uz nic nedialo.
  const previewFailed =
    storagePath !== null && signed.path === storagePath && signed.url === null

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const input = e.target
    // Pole sa cisti HNED a synchronne, nie az po `await`. Inak by sa po
    // zlyhani ten isty subor nedal vybrat druhy raz — prehliadac by na
    // rovnaku hodnotu nevyvolal `change`.
    input.value = ""
    if (!file) return

    // Velkost sa kontroluje uz tu. Server ma rovnaky limit, ale nad strop
    // Server Actions sa k nemu poziadavka vobec nedostane a spadla by na
    // HTTP 413 bez zrozumitelnej hlasky.
    if (file.size > MAX_IMAGE_BYTES) {
      // Hlaska sa odvodzuje z limitu, nie napisana rukou — inak sa pri zmene
      // stropu rozide s tym, co server naozaj pusti.
      toast.error(
        `${tooLargeMessage(file.size, MAX_IMAGE_BYTES)} Zmenši ho a skús znova.`,
      )
      return
    }

    startTransition(async () => {
      try {
        // Priamo do uloziska — cez server action by vacsi subor neprelezol.
        const uploaded = await uploadDirect("branding", file)
        if (!uploaded.ok) {
          toast.error(uploaded.error)
          return
        }
        const res = await setBrandingImage(kind, uploaded.path)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`${label} nahraté.`)
        router.refresh()
      } catch {
        // Vypadok siete alebo nedostupna sluzba — bez tohto by pouzivatel
        // namiesto hlasky dostal celoobrazovkovu chybu.
        toast.error("Súbor sa nepodarilo nahrať. Skús to znova.")
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await removeOrgImage(kind)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`${label} odstránené.`)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>

      <div className="flex items-start gap-4">
        <div className="bg-muted/30 flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {path && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={label}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-muted-foreground px-2 text-center text-xs">
              {!path
                ? "Nenahraté"
                : previewFailed
                  ? "Náhľad sa nenačítal"
                  : "Načítavam…"}
            </span>
          )}
        </div>

        <div className="grid flex-1 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFile}
              disabled={busy || !canManage}
              className="max-w-xs"
            />
            {busy ? (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            ) : null}
            {path ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={busy || !canManage}
              >
                <Trash2 className="size-4" />
                Odstrániť
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
    </div>
  )
}
