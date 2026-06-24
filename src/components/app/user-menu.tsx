"use client"

import { useTransition } from "react"
import { LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { signOut } from "@/app/actions/auth"

export function UserMenu({
  email,
  name,
  avatarUrl,
}: {
  email: string
  name: string | null
  avatarUrl: string | null
}) {
  const [pending, startTransition] = useTransition()
  const initials = (name ?? email).slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2">
        <Avatar className="size-8">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={name ?? email} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid">
            <span className="truncate font-medium">{name ?? "Účet"}</span>
            <span className="text-muted-foreground truncate text-xs font-normal">
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          <LogOut className="size-4" />
          Odhlásiť sa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
