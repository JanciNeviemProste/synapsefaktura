import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a parent pnpm-lock.yaml exists in the
  // home directory, which would otherwise be inferred as the tracing root).
  outputFileTracingRoot: __dirname,

  experimental: {
    serverActions: {
      // Predvolený strop Server Actions je 1 MB. Cez server action chodia
      // VŠETKY nahrávané súbory: logo a podpis firmy, príloha nákladu, fotka
      // bločku pre AI a bankový výpis.
      //
      // S 1 MB to znamenalo, že bežná fotka z mobilu (2–5 MB) skončila na
      // HTTP 413 ešte predtým, než sa dostala k akejkoľvek našej kontrole.
      // Server action vtedy VYHODÍ výnimku namiesto výsledku, takže sa
      // nezobrazila ani hláška — používateľ videl chybovú obrazovku alebo nič.
      //
      // 8 MB pokrýva fotku z mobilu aj ročný bankový výpis. Vlastné limity
      // ostávajú prísnejšie a kontrolujú sa aj na klientovi, aby používateľ
      // dostal zrozumiteľnú hlášku a nie 413: obrázky 2 MB
      // (`lib/images/validate.ts`), prílohy 8 MB.
      bodySizeLimit: "8mb",
    },
  },
}

// next-intl without locale-prefixed routing — locale resolved from a cookie in
// src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

export default withNextIntl(nextConfig)
