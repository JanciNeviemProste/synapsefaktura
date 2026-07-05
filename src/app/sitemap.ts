import type { MetadataRoute } from "next"

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://synapsefaktura.sk"

/** Public, indexable routes. */
const ROUTES = [
  "",
  "/e-faktura-2027",
  "/login",
  "/register",
  "/podmienky",
  "/ochrana-osobnych-udajov",
  "/cookies",
  "/kontakt",
]

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `${appUrl}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/e-faktura-2027" ? 0.8 : 0.5,
  }))
}
