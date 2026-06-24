"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlugZap, Save } from "lucide-react"
import { toast } from "sonner"

import { POSTMAN_PROVIDERS } from "@/lib/peppol/provider/catalog"
import {
  updateEInvoiceSettings,
  testEInvoiceConnection,
  type EInvoiceSettings as EInvoiceSettingsData,
} from "@/app/actions/einvoice-settings"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  POSTMAN_PROVIDERS.map((p) => [p.value, p.label]),
)

export function EInvoiceSettings({
  initial,
}: {
  initial: EInvoiceSettingsData
}) {
  const router = useRouter()
  const [saving, startSaving] = useTransition()
  const [testing, startTesting] = useTransition()

  const [enabled, setEnabled] = useState(initial.enabled)
  const [peppolId, setPeppolId] = useState(initial.peppolId ?? "")
  const [provider, setProvider] = useState(initial.provider || "mock")

  function save() {
    startSaving(async () => {
      const res = await updateEInvoiceSettings({ enabled, peppolId, provider })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Nastavenia e-fakturácie uložené.")
      router.refresh()
    })
  }

  function test() {
    startTesting(async () => {
      const res = await testEInvoiceConnection()
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      if (res.found) {
        toast.success(res.message)
      } else {
        toast.info(res.message)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-fakturácia (Peppol)</CardTitle>
        <CardDescription>
          Od roku 2027 bude elektronická fakturácia cez sieť Peppol povinná;
          rok 2026 je dobrovoľné testovacie obdobie, počas ktorého si zapojenie
          môžete vyskúšať nezáväzne.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <Label htmlFor="einvoice-enabled">Zapnúť e-fakturáciu</Label>
            <p className="text-muted-foreground text-sm">
              Povolí odosielanie a príjem faktúr cez sieť Peppol.
            </p>
          </div>
          <Switch
            id="einvoice-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="peppol-id">Peppol ID</Label>
          <Input
            id="peppol-id"
            value={peppolId}
            onChange={(e) => setPeppolId(e.target.value)}
            placeholder={initial.suggestedPeppolId ?? "0245:2020317068"}
            className="font-mono"
          />
          {initial.suggestedPeppolId ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto justify-start p-0 text-xs"
              onClick={() => setPeppolId(initial.suggestedPeppolId!)}
            >
              Použiť {initial.suggestedPeppolId} z DIČ
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">
              Doplňte si DIČ vo firemných údajoch, aby sme vygenerovali Peppol
              ID.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Digitálny poštár (Access Point)</Label>
          <Select
            value={provider}
            onValueChange={(v) => setProvider(v ?? "mock")}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => PROVIDER_LABELS[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {POSTMAN_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={test}
          disabled={testing}
        >
          <PlugZap className="size-4" />
          Otestovať pripojenie
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          <Save className="size-4" />
          Uložiť
        </Button>
      </CardFooter>
    </Card>
  )
}
