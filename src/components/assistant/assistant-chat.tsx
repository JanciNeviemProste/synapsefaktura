"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Bot, Loader2, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { sendAssistantMessage } from "@/app/actions/ai-assistant"
import type { AssistantMessage } from "@/app/actions/ai-assistant"
import { Button } from "@/components/ui/button"
import { useUpgrade } from "@/components/billing/upgrade-dialog"

const STARTERS = [
  "Koľko som vyfakturoval tento mesiac?",
  "Ktorí klienti meškajú?",
  "Zhrň klienta Tibor",
]

type ChatMessage = Pick<AssistantMessage, "role" | "content"> & { id: string }

let localSeq = 0
function localId(prefix: string): string {
  localSeq += 1
  return `${prefix}-${localSeq}`
}

export function AssistantChat({
  initialThreadId,
  initialMessages,
  degraded,
}: {
  initialThreadId?: string
  initialMessages: AssistantMessage[]
  degraded: boolean
}) {
  const { prompt } = useUpgrade()
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
  )
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, pending])

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || pending || degraded) return

    setMessages((prev) => [
      ...prev,
      { id: localId("u"), role: "user", content: trimmed },
    ])
    setDraft("")

    startTransition(async () => {
      const res = await sendAssistantMessage({ threadId, text: trimmed })
      if (res.ok) {
        setThreadId(res.threadId)
        setMessages((prev) => [
          ...prev,
          { id: localId("a"), role: "assistant", content: res.reply },
        ])
      } else if (res.upgrade) {
        // Paywall má ponúknuť upgrade, nie tvrdiť, že chýba kľúč.
        prompt(res.upgrade, res.error)
      } else {
        toast.error(
          res.reason === "no_key"
            ? "AI asistent nie je nakonfigurovaný (chýba kľúč)."
            : res.error || "Odpoveď sa nepodarilo získať.",
        )
      }
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {degraded && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          AI asistent nie je nakonfigurovaný (chýba kľúč).
        </div>
      )}

      <div
        ref={scrollRef}
        className="bg-muted/30 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border p-4"
      >
        {messages.length === 0 && !pending && (
          <div className="text-muted-foreground m-auto flex max-w-sm flex-col items-center gap-2 text-center text-sm">
            <Sparkles className="text-primary size-6" />
            <p>
              Položte otázku o svojich financiách. Odpovede vychádzajú z vašich
              faktúr a kontaktov.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex w-full",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "flex max-w-[85%] items-start gap-2 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border",
              )}
            >
              {m.role === "assistant" && (
                <Bot className="text-primary mt-0.5 size-4 shrink-0" />
              )}
              <span>{m.content}</span>
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="bg-background flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <Loader2 className="text-primary size-4 animate-spin" />
              <span className="text-muted-foreground">Premýšľam…</span>
            </div>
          </div>
        )}
      </div>

      {messages.length === 0 && !degraded && (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              disabled={pending}
              className="border-input hover:bg-muted rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit(draft)
            }
          }}
          disabled={degraded || pending}
          rows={1}
          placeholder={degraded ? "Asistent je nedostupný" : "Napíšte správu…"}
          className="border-input bg-background focus-visible:ring-ring max-h-40 min-h-10 flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={degraded || pending || !draft.trim()}
          aria-label="Odoslať"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
