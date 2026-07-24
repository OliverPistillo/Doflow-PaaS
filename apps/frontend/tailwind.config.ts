// Percorso: apps/frontend/tailwind.config.ts
// Refactored 1:1 dal file Figma: CRM-Workroom-Community
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Doflow UI Review: Inter come font principale
        sans: [
          "var(--font-sans)",
          "'Inter'",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },

      // ── Border Radius (estratto dal Figma) ──────────────────────────
      // card:  24px  → rounded-3xl or rounded-card
      // button:14px  → rounded-[14px] or rounded-button (default --radius)
      // nav:   10px  → rounded-nav
      // badge: 4px   → rounded-badge
      borderRadius: {
        // shadcn/ui standard names (usano var(--radius))
        lg:     "var(--radius)",            // 14px  — button/dialog/sheet
        md:     "calc(var(--radius) - 2px)",// 12px
        sm:     "calc(var(--radius) - 4px)",// 10px
        // Figma-specific names
        card:   "var(--radius-card)",       // 24px  — elm/card/main
        nav:    "var(--radius-nav)",        // 10px  — sidebar active section
        badge:  "var(--radius-badge)",      // 4px   — level badge
      },

      // ── Box Shadow (estratto dal Figma) ────────────────────────────
      boxShadow: {
        card:   "var(--shadow-card)",        // 0px 6px 58px rgba(196,203,214,0.10)
        button: "var(--shadow-button)",      // 0px 6px 12px rgba(63,140,255,0.26)
        sm:     "var(--shadow-sm)",
        md:     "var(--shadow-md)",
      },

      // ── Colors (tutte semantiche → CSS vars) ───────────────────────
      colors: {
        // Figma raw primitives (usati solo dove si vuole il valore esatto)
        "figma-blue":    "#5B5BD6",
        "figma-bg":      "#FAFAF7",
        "figma-dark":    "#0E0E0C",
        "figma-muted":   "#6B6A63",
        "figma-gray":    "#F4F3EE",

        // shadcn/ui semantic colors
        background:    "hsl(var(--background))",
        foreground:    "hsl(var(--foreground))",

        card: {
          DEFAULT:     "hsl(var(--card))",
          foreground:  "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:     "hsl(var(--popover))",
          foreground:  "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT:     "hsl(var(--primary))",
          foreground:  "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:     "hsl(var(--secondary))",
          foreground:  "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:     "hsl(var(--muted))",
          foreground:  "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:     "hsl(var(--accent))",
          foreground:  "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:     "hsl(var(--destructive))",
          foreground:  "hsl(var(--destructive-foreground))",
        },
        border:  "hsl(var(--border))",
        input:   "hsl(var(--input))",
        ring:    "hsl(var(--ring))",

        // Sidebar tokens
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },

        // Chart tokens
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },

      // ── Keyframes ─────────────────────────────────────────────────
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "fade-in-up":      "fade-in-up 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in":         "fade-in 0.3s ease both",
        "slide-in-right":  "slide-in-right 0.28s cubic-bezier(0.4,0,0.2,1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;