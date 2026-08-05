import {
  CONTACT_TEMPLATE_HEADER,
  CONTACT_TEMPLATE_ROWS,
} from "@/lib/import/contacts"

export const runtime = "nodejs"

/**
 * Vzorová tabuľka na import klientov.
 *
 * Generuje sa z tých istých konštánt, ktoré import očakáva — vzor sa tak
 * nemôže rozísť s tým, čo appka vie prečítať. Statický súbor v `public/` by
 * sa pri zmene stĺpcov ticho stal nesprávnym.
 *
 * Formát je CSV s bodkočiarkou a BOM: presne to, čo slovenský Excel otvorí
 * dvojklikom správne aj s diakritikou.
 */
function csvCell(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export async function GET() {
  const lines = [
    CONTACT_TEMPLATE_HEADER.map(csvCell).join(";"),
    ...CONTACT_TEMPLATE_ROWS.map((r) => r.map(csvCell).join(";")),
  ]
  // BOM, aby Excel prečítal UTF-8 a nerozsypal diakritiku.
  const body = "﻿" + lines.join("\r\n")

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="vzor-import-klientov.csv"',
    },
  })
}
