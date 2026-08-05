import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a parent pnpm-lock.yaml exists in the
  // home directory, which would otherwise be inferred as the tracing root).
  outputFileTracingRoot: __dirname,

  experimental: {
    serverActions: {
      // Predvolený strop Server Actions je 1 MB — pod ním padal aj bankový
      // výpis a tabuľka klientov, a to bez hlášky (server action pri
      // prekročení VYHODÍ výnimku namiesto výsledku).
      //
      // Vyššie než 4,5 MB ísť nemá zmysel: toľko je TVRDÝ strop serverovej
      // funkcie na Verceli (`FUNCTION_PAYLOAD_TOO_LARGE`) a nastavením sa
      // prekonať nedá. 4 MB je pod ním s rezervou na réžiu multipartu, takže
      // sa používateľ dozvie našu zrozumiteľnú hlášku a nie 413.
      //
      // Veľké súbory (fotka bločka, logo) sem preto vôbec nechodia — idú
      // z prehliadača PRIAMO do úložiska (`lib/upload/direct.ts`) a strop
      // serverovej funkcie sa ich netýka.
      bodySizeLimit: "4mb",
    },
  },
}

// next-intl without locale-prefixed routing — locale resolved from a cookie in
// src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

export default withNextIntl(nextConfig)
