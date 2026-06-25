import { AcceptInvite } from "@/components/members/accept-invite"

export const metadata = { title: "Pozvánka — Synapse Faktúra" }

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <AcceptInvite token={token} />
    </div>
  )
}
