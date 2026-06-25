"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Copy, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import {
  inviteMember,
  revokeInvite,
  updateMemberRole,
  removeMember,
  type Member,
  type PendingInvite,
} from "@/app/actions/members"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const ROLE_LABELS: Record<string, string> = {
  owner: "Vlastník",
  admin: "Admin",
  accountant: "Účtovník",
  member: "Člen",
}

type InviteRole = "admin" | "accountant" | "member"
const INVITE_ROLES: InviteRole[] = ["admin", "accountant", "member"]

function inviteLink(appUrl: string, token: string) {
  return `${appUrl}/app/invite/${token}`
}

export function MembersSettings({
  initialMembers,
  initialInvites,
  canManage,
  multiUserEnabled,
  appUrl,
}: {
  initialMembers: Member[]
  initialInvites: PendingInvite[]
  canManage: boolean
  multiUserEnabled: boolean
  appUrl: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [email, setEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<InviteRole>("member")
  const [removing, setRemoving] = useState<Member | null>(null)

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(appUrl, token))
      toast.success("Odkaz skopírovaný.")
    } catch {
      toast.error("Odkaz sa nepodarilo skopírovať.")
    }
  }

  function submitInvite() {
    startTransition(async () => {
      const res = await inviteMember(email, inviteRole)
      if (!res.ok || !res.token) {
        toast.error(res.error ?? "Pozvánku sa nepodarilo vytvoriť.")
        return
      }
      await copyLink(res.token)
      toast.success("Pozvánka vytvorená. Odkaz je skopírovaný v schránke.")
      setEmail("")
      router.refresh()
    })
  }

  function changeRole(m: Member, role: InviteRole) {
    startTransition(async () => {
      const res = await updateMemberRole(m.userId, role)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Rola zmenená.")
      router.refresh()
    })
  }

  function confirmRemove() {
    if (!removing) return
    startTransition(async () => {
      const res = await removeMember(removing.userId)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Člen odstránený.")
        router.refresh()
      }
      setRemoving(null)
    })
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeInvite(id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Pozvánka zrušená.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tím</CardTitle>
        <CardDescription>
          Spravujte členov firmy a ich roly.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Rola</TableHead>
                {canManage ? (
                  <TableHead className="w-32 text-right">Akcie</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialMembers.map((m) => {
                const isOwner = m.role === "owner"
                const showActions = canManage && !isOwner
                return (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">
                      {m.email}
                      {m.isSelf ? (
                        <span className="text-muted-foreground"> (vy)</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {showActions ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            v && changeRole(m, v as InviteRole)
                          }
                        >
                          <SelectTrigger className="w-36" disabled={pending}>
                            <SelectValue>
                              {(v: string) => ROLE_LABELS[v] ?? v}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {INVITE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">
                          {ROLE_LABELS[m.role] ?? m.role}
                        </Badge>
                      )}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {showActions ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Odstrániť"
                            disabled={pending}
                            onClick={() => setRemoving(m)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {canManage ? (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="invite-email">Pozvať člena</Label>
              {!multiUserEnabled ? (
                <p className="text-muted-foreground text-sm">
                  Pozývanie členov je v pláne Business.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="invite-email"
                type="email"
                placeholder="kolega@firma.sk"
                value={email}
                disabled={!multiUserEnabled || pending}
                onChange={(e) => setEmail(e.target.value)}
                className="sm:flex-1"
              />
              <Select
                value={inviteRole}
                onValueChange={(v) => v && setInviteRole(v as InviteRole)}
              >
                <SelectTrigger
                  className="sm:w-40"
                  disabled={!multiUserEnabled || pending}
                >
                  <SelectValue>
                    {(v: string) => ROLE_LABELS[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={submitInvite}
                disabled={!multiUserEnabled || pending}
              >
                <UserPlus className="size-4" />
                Pozvať
              </Button>
            </div>
          </div>
        ) : null}

        {canManage && initialInvites.length > 0 ? (
          <div className="grid gap-2">
            <Label>Čakajúce pozvánky</Label>
            <div className="grid gap-2">
              {initialInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="grid">
                    <span className="truncate text-sm font-medium">
                      {inv.email ?? "Bez e-mailu"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {ROLE_LABELS[inv.role] ?? inv.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(inv.token)}
                    >
                      <Copy className="size-4" />
                      Kopírovať odkaz
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Zrušiť pozvánku"
                      disabled={pending}
                      onClick={() => revoke(inv.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstrániť člena?</AlertDialogTitle>
            <AlertDialogDescription>
              Člen „{removing?.email}" stratí prístup k tejto firme.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={pending}>
              Odstrániť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
