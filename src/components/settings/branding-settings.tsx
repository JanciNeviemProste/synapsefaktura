import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MAX_IMAGE_BYTES } from "@/lib/upload/limits"
import { BrandingImageField } from "./branding-image"

export type OrgBranding = {
  logoUrl: string | null
  signatureUrl: string | null
  stampUrl: string | null
}

/**
 * Vzhľad dokladov — logo, podpis a pečiatka.
 *
 * Dashboard posielal používateľa „doplniť firemné údaje a logo" do nastavení,
 * kde také pole nebolo. PDF pritom obrázky vykresliť vedelo od začiatku, len
 * ich nemal kto nahrať.
 *
 * Podpis a pečiatka sa tlačia LEN tam, kde ich doklad unesie (`showsSupplierMark`
 * v `lib/pdf/invoice-document.tsx`) — na dodacom liste nie, ten má vlastné
 * miesto na podpis prevzatia a bili by sa.
 */
export function BrandingSettings({
  branding,
  canManage,
}: {
  branding: OrgBranding
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vzhľad dokladov</CardTitle>
        <CardDescription>
          Logo sa tlačí v hlavičke každého dokladu. Podpis a pečiatka na
          faktúrach, ponukách a dobropisoch — na dodacom liste nie, ten má
          vlastné miesto na podpis prevzatia. Podporujeme PNG a JPEG do{" "}
          {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <BrandingImageField
          kind="logo"
          label="Logo"
          description="Vykreslí sa v pravom hornom rohu, na výšku ~34 bodov. Najlepšie vyzerá PNG s priehľadným pozadím."
          path={branding.logoUrl}
          canManage={canManage}
        />
        <BrandingImageField
          kind="signature"
          label="Podpis"
          description="Podpis oprávnenej osoby. Ukladá sa do súkromného úložiska — verejná adresa obrázku podpisu by bola návod na falšovanie."
          path={branding.signatureUrl}
          canManage={canManage}
        />
        <BrandingImageField
          kind="stamp"
          label="Pečiatka"
          description="Firemná pečiatka. Tlačí sa vedľa podpisu, vľavo od neho."
          path={branding.stampUrl}
          canManage={canManage}
        />
        {canManage ? null : (
          <p className="text-muted-foreground text-sm">
            Vzhľad dokladov môže meniť len vlastník alebo administrátor.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
