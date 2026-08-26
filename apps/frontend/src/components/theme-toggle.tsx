"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  const isDark = resolvedTheme === "dark"

  return <Tooltip><TooltipTrigger asChild><Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Attiva tema chiaro" : "Attiva tema scuro"}
      className="mr-4 shrink-0"
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button></TooltipTrigger><TooltipContent>{isDark ? "Attiva modalità chiara" : "Attiva modalità scura"}</TooltipContent></Tooltip>
}
