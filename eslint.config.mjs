import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

/**
 * Súbory, ktoré smú siahnuť po service-role klientovi.
 *
 * `createAdminClient()` obchádza RLS — je to jediné miesto v celom projekte,
 * kde databáza prestane strážiť príslušnosť k firme a musí to ustrážiť človek.
 * Zoznam je zámerne krátky a explicitný: keď doň chce niekto pribudnúť, je to
 * vedomé rozhodnutie zapísané v diffe, nie import, ktorý sa v recenzii stratí
 * medzi tridsiatimi ďalšími.
 *
 * Pri pridávaní si over, že v tom istom súbore je aj kontrola organizácie —
 * `getCurrentOrgId`, `belongsToOrg`, `.eq("organization_id", …)` alebo prefix
 * cesty `${orgId}/`. Bez nej to do zoznamu nepatrí.
 */
const ADMIN_CLIENT_ALLOWLIST = [
  // Server actions — všetky majú getCurrentOrgId + kontrolu cesty alebo príslušnosti.
  "src/app/actions/ai-capture.ts",
  "src/app/actions/cash-registers.ts",
  "src/app/actions/documents.ts",
  "src/app/actions/expenses.ts",
  "src/app/actions/members.ts",
  "src/app/actions/org.ts",
  "src/app/actions/travel-rates.ts",
  "src/app/actions/uploads.ts",
  // Stripe webhook — session neexistuje, drží to overenie podpisu.
  "src/app/api/stripe/webhook/route.ts",
  // Cron joby — bežia naprieč firmami zámerne, chráni ich isCronAuthorized.
  "src/lib/jobs/overdue.ts",
  "src/lib/jobs/peppol-inbound.ts",
  "src/lib/jobs/recurring.ts",
  "src/lib/jobs/reminders.ts",
  "src/lib/jobs/travel-rates.ts",
  // Systémové cesty s vlastnou kontrolou.
  "src/lib/ai/generate.ts", // krížová kontrola systemOrgId voči session
  "src/lib/pdf/image-data-url.ts", // kontrola prefixu `${orgId}/` v ceste
  "src/lib/peppol/provider/mock.ts", // scoping cez receiver_peppol_id (unikátne DIČ)
]

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ADMIN_CLIENT_ALLOWLIST,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "createAdminClient() obchádza RLS. Použi createClient() zo servera. " +
                "Ak service role naozaj potrebuješ, doplň organizačnú kontrolu " +
                "(getCurrentOrgId / belongsToOrg / prefix cesty) a zapíš súbor do " +
                "ADMIN_CLIENT_ALLOWLIST v eslint.config.mjs — nech je to vidieť v diffe.",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      // Slovak typographic quotes in JSX text are intentional and valid.
      "react/no-unescaped-entities": "off",
      // react-hook-form's `watch()` trips the React-Compiler lint; rhf is used deliberately.
      "react-hooks/incompatible-library": "off",
      // Allow intentionally-unused args (e.g. interface-required params) when _-prefixed.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      "src/lib/supabase/database.types.ts",
    ],
  },
]

export default eslintConfig
