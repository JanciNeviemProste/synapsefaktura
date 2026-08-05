/**
 * Názvy Supabase Storage bucketov na jednom mieste.
 *
 * Bucket je JEDEN a je SÚKROMNÝ. Prílohy nákladov aj firemné obrázky sa
 * rozlišujú prefixom cesty, nie samostatnými bucketmi:
 *
 *   {orgId}/expenses/…   príloha nákladu
 *   {orgId}/branding/…   logo, podpis, pečiatka
 *
 * Prefix organizácie je to, čo drží firmy oddelené — kontroluje ho
 * `getAttachmentSignedUrl` aj `orgBrandingPath`. Verejný bucket by pri
 * podpise a pečiatke bol chyba: verejná adresa obrázku podpisu je návod na
 * falšovanie.
 */
export const ATTACHMENTS_BUCKET = "attachments"

/** Zložka firemných obrázkov v rámci organizácie. */
export const BRANDING_PREFIX = "branding"
