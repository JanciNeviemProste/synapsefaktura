"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Tag as TagIcon } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { contrastText, type TaggableType } from "@/lib/validation/tag"
import { addTagging, removeTagging } from "@/app/actions/tags"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Tag = Database["public"]["Tables"]["tags"]["Row"]

/**
 * Vyber stitkov pre lubovolnu entitu (doklad, naklad, klient).
 *
 * Dva rezimy:
 *  - s `taggable` sa kazda zmena hned uklada cez server action (detail zaznamu),
 *  - bez neho je komponent riadeny cez `onChange` a stitky ulozi az formular
 *    (napr. `setEntityTags` po vytvoreni zaznamu).
 */
export function TagPicker({
  tags,
  value,
  taggable,
  onChange,
  disabled,
}: {
  tags: Tag[]
  value: string[]
  taggable?: { type: TaggableType; id: string }
  onChange?: (tagIds: string[]) => void
  disabled?: boolean
}) {
  const [selected, setSelected] = useState<string[]>(value)
  const [syncedValue, setSyncedValue] = useState(value)
  const [pending, startTransition] = useTransition()

  // Po refreshi stranky je pravdou opat prop — prepiseme optimisticky stav.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setSelected(value)
  }

  const selectedTags = tags.filter((t) => selected.includes(t.id))

  function toggle(tag: Tag, checked: boolean) {
    const previous = selected
    const next = checked
      ? [...previous, tag.id]
      : previous.filter((id) => id !== tag.id)

    setSelected(next)
    onChange?.(next)
    if (!taggable) return

    startTransition(async () => {
      const input = {
        tagId: tag.id,
        taggableType: taggable.type,
        taggableId: taggable.id,
      }
      const res = checked ? await addTagging(input) : await removeTagging(input)
      if (!res.ok) {
        toast.error(res.error)
        setSelected(previous)
        onChange?.(previous)
      }
    })
  }

  if (tags.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Zatiaľ nemáš žiadne štítky.{" "}
        <Link href="/app/settings" className="underline underline-offset-4">
          Vytvor ich v nastaveniach
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedTags.map((t) => (
        <Badge
          key={t.id}
          variant={t.color ? "default" : "secondary"}
          style={
            t.color
              ? { backgroundColor: t.color, color: contrastText(t.color) }
              : undefined
          }
        >
          {t.name}
        </Badge>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || pending}
              type="button"
            >
              <TagIcon />
              {selectedTags.length === 0 ? "Pridať štítok" : "Upraviť"}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Štítky</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tags.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.id}
                checked={selected.includes(t.id)}
                onCheckedChange={(checked) => toggle(t, checked)}
                disabled={disabled || pending}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: t.color ?? "var(--muted-foreground)",
                  }}
                  aria-hidden
                />
                <span className="flex-1 truncate">{t.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
