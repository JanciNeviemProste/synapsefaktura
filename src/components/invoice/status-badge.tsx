import { Badge } from "@/components/ui/badge"
import {
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from "@/lib/documents/labels"

const VARIANT: Record<
  DocumentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  partially_paid: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
}

export function StatusBadge({ status }: { status: string }) {
  const s = status as DocumentStatus
  return (
    <Badge variant={VARIANT[s] ?? "outline"}>
      {DOCUMENT_STATUS_LABELS[s] ?? status}
    </Badge>
  )
}
