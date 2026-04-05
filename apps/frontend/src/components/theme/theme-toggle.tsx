// Percorso: C:\Doflow\apps\frontend\src\components\theme\theme-toggle.tsx
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <button
      className="doflow-theme-toggle"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={resolvedTheme === "dark" ? "Passa a Light Mode" : "Passa a Dark Mode"}
      title="Toggle dark/light theme"
    >
      <Sun className={`h-[1.1rem] w-[1.1rem] transition-all duration-300 ${
        resolvedTheme === "dark"
          ? "rotate-90 scale-0 opacity-0 absolute"
          : "rotate-0 scale-100 opacity-100"
      }`} />
      <Moon className={`h-[1.1rem] w-[1.1rem] transition-all duration-300 ${
        resolvedTheme === "dark"
          ? "rotate-0 scale-100 opacity-100"
          : "-rotate-90 scale-0 opacity-0 absolute"
      }`} />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}