import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Slovak typographic quotes in JSX text are intentional and valid.
      "react/no-unescaped-entities": "off",
      // react-hook-form's `watch()` trips the React-Compiler lint; rhf is used deliberately.
      "react-hooks/incompatible-library": "off",
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
