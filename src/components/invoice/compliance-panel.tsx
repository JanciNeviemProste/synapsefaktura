"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ShieldCheck,
  AlertTriangle,
  Info,
  XCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { checkDocumentCompliance } from "@/app/actions/ai-compliance"
import type {
  ComplianceIssue,
  ComplianceResult,
  ComplianceSeverity,
} from "@/lib/ai/compliance"

const SEVERITY_META: Record<
  ComplianceSeverity,
  {
    label: string
    variant: "destructive" | "secondary" | "outline"
    Icon: typeof Info
  }
> = {
  error: { label: "Chyba", variant: "destructive", Icon: XCircle },
  warning: { label: "Upozornenie", variant: "secondary", Icon: AlertTriangle },
  info: { label: "Info", variant: "outline", Icon: Info },
}

function scoreTone(score: number): string {
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-destructive"
}

function IssueRow({ issue }: { issue: ComplianceIssue }) {
  const meta = SEVERITY_META[issue.severity]
  const { Icon } = meta
  return (
    <li className="border-border flex items-start gap-3 rounded-md border p-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <p className="text-foreground text-sm">{issue.message}</p>
        {issue.fix ? (
          <p className="text-muted-foreground text-xs">Riešenie: {issue.fix}</p>
        ) : null}
      </div>
    </li>
  )
}

export function CompliancePanel({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<ComplianceResult | null>(null)
  const [pending, startTransition] = useTransition()

  function runCheck() {
    startTransition(async () => {
      try {
        const res = await checkDocumentCompliance(documentId)
        setResult(res)
        if (res.issues.length === 0) {
          toast.success("Doklad spĺňa kontrolované pravidlá DPH.")
        }
      } catch {
        toast.error("Kontrolu DPH sa nepodarilo spustiť.")
      }
    })
  }

  const errorCount =
    result?.issues.filter((i) => i.severity === "error").length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground size-5" />
          Kontrola DPH a náležitostí
        </CardTitle>
        <CardDescription>
          Poradná kontrola povinných údajov (§74) a sadzieb DPH. Nezabraňuje
          vystaveniu dokladu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runCheck} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Kontrolujem…
            </>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Skontrolovať DPH
            </>
          )}
        </Button>

        {result ? (
          <div className="space-y-4">
            <div className="border-border flex items-baseline justify-between rounded-lg border p-4">
              <div>
                <p className="text-muted-foreground text-sm">Skóre súladu</p>
                <p
                  className={`text-3xl font-semibold ${scoreTone(result.score)}`}
                >
                  {result.score}
                  <span className="text-muted-foreground text-base">
                    {" "}
                    / 100
                  </span>
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                {result.issues.length === 0
                  ? "Žiadne zistenia"
                  : `${result.issues.length} zistení${errorCount > 0 ? ` · ${errorCount} chýb` : ""}`}
              </p>
            </div>

            {result.issues.length > 0 ? (
              <ul className="space-y-2">
                {result.issues.map((issue, i) => (
                  <IssueRow key={i} issue={issue} />
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-4" />
                Doklad spĺňa všetky kontrolované pravidlá.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
