import { defineConfig } from "vitest/config"
import { fileURLToPath } from "url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` je značka pre Next, ktorá zámerne zhodí build, keď sa
      // modul dostane do klientskeho kódu. Mimo Nextu sa nedá rozlíšiť, takže
      // by testy modulov s týmto strážcom ani nenaštartovali. Odtienime ho —
      // strážca tým nič nestráca, ten pracuje pri builde, nie za behu.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
