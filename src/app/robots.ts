import type { MetadataRoute } from "next"

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://synapsefaktura.sk"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The authenticated app and API are not for indexing.
      disallow: ["/app/", "/api/", "/auth/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
