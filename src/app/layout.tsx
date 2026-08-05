import type { Metadata } from "next"
import { Inter_Tight, Geist_Mono } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { PwaRegister } from "@/components/pwa-register"
import { CookieNotice } from "@/components/cookie-notice"
import { DesignSwitcher } from "@/components/design-switcher"
import { Analytics } from "@/components/analytics"

/**
 * Inter Tight — úzky neutrálny grotesk, ktorý nesie celý dizajn: úvodnú
 * stránku aj vnútro appky.
 *
 * `latin-ext` je povinné, nie kozmetika — bez neho by slovenská diakritika
 * (ľ, š, č, ť, ž, ô, ä, ď, ň, ĺ, ŕ) vypadla na náhradný font a text by bol
 * roztrhaný na dve písma uprostred slova.
 *
 * Font sa pri builde stiahne a servíruje z našej domény, takže na cudzej CDN
 * nezávisíme a nič sa neposiela tretej strane.
 */
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin", "latin-ext"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://synapsefaktura.sk"

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Synapse Faktúra — fakturácia novej generácie",
    template: "%s — Synapse Faktúra",
  },
  description:
    "Moderná slovenská fakturácia s AI a pripravená na povinnú e-faktúru 2027 (Peppol).",
  keywords: [
    "fakturácia",
    "e-faktúra 2027",
    "Peppol",
    "faktúra online",
    "AI fakturácia",
    "elektronická faktúra",
  ],
  openGraph: {
    type: "website",
    locale: "sk_SK",
    siteName: "Synapse Faktúra",
    title: "Synapse Faktúra — fakturácia novej generácie",
    description:
      "Moderná slovenská fakturácia s AI a pripravená na povinnú e-faktúru 2027.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Synapse Faktúra — fakturácia novej generácie",
    description:
      "Moderná slovenská fakturácia s AI a pripravená na povinnú e-faktúru 2027.",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      className={`${interTight.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Analytics />
        <NextIntlClientProvider>
          <ThemeProvider>
            {children}
            <PwaRegister />
            <CookieNotice />
            <DesignSwitcher />
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
