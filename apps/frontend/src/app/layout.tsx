// Percorso: apps/frontend/src/app/layout.tsx
// Fix: aggiunto storageKey per persistere dark/light mode in localStorage
import type { Metadata } from "next";
import "./globals.css";

import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Doflow",
  description: "La piattaforma all-in-one per gestire il tuo business.",
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var h=location.hostname.toLowerCase();if(h==='localhost'||h==='127.0.0.1'||h==='app.doflow.it'||h==='doflow.it'||h==='doflow.doflow.it'){document.documentElement.dataset.doflowAuthHost='true'}}catch(e){}",
          }}
        />
      </head>
      <body className={`${inter.variable} ${mono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="doflow_theme" // ← persiste in localStorage con chiave specifica
        >
          <TooltipProvider delayDuration={400}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
