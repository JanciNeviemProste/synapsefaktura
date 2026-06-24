import { hasAiKey } from "@/lib/ai/provider"
import {
  getLatestThreadId,
  getThreadMessages,
} from "@/app/actions/ai-assistant"
import { AssistantChat } from "@/components/assistant/assistant-chat"

export const metadata = { title: "Asistent — Synapse Faktúra" }

export default async function AssistantPage() {
  const degraded = !hasAiKey()
  const threadId = await getLatestThreadId()
  const initialMessages = threadId ? await getThreadMessages(threadId) : []

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Asistent</h1>
        <p className="text-muted-foreground text-sm">
          Spýtajte sa na svoje financie — odpovede sú podložené reálnymi
          záznamami vo vašej firme.
        </p>
      </div>

      <AssistantChat
        initialThreadId={threadId ?? undefined}
        initialMessages={initialMessages}
        degraded={degraded}
      />
    </div>
  )
}
