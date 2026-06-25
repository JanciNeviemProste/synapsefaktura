"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, Monitor, SunMoon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  // Static trigger glyph — avoids reading the resolved theme during render (no
  // SSR/client hydration mismatch, no mount-guard setState).
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Prepnúť motív">
            <SunMoon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Motív</DropdownMenuLabel>
          <DropdownMenuItem
            data-active={theme === "light"}
            onClick={() => setTheme("light")}
          >
            <Sun className="size-4" />
            Svetlý
          </DropdownMenuItem>
          <DropdownMenuItem
            data-active={theme === "dark"}
            onClick={() => setTheme("dark")}
          >
            <Moon className="size-4" />
            Tmavý
          </DropdownMenuItem>
          <DropdownMenuItem
            data-active={theme === "system"}
            onClick={() => setTheme("system")}
          >
            <Monitor className="size-4" />
            Podľa systému
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
