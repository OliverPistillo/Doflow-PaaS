// Percorso: apps/frontend/src/app/layout.tsx
// Fix: aggiunto storageKey per persistere dark/light mode in localStorage
import type { Metadata } from "next";
import "./globals.css";

import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { LegacyDesktopUpdateCoordinator } from "@/components/desktop/legacy-desktop-update-coordinator";
import { FaviconThemeManager } from "@/components/theme/favicon-theme-manager";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DOFLOW_FAVICON_BLACK,
  DOFLOW_FAVICON_LINK_ID,
  DOFLOW_FAVICON_WHITE,
} from "@/lib/doflow-favicon";

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

const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Doflow",
  description: "La piattaforma all-in-one per gestire il tuo business.",
  manifest: "/site.webmanifest",
};

const faviconBootstrap = `(function(){try{var k='doflow_theme',v=localStorage.getItem(k),d=v==='dark'||((v!=='light'&&v!=='dark')&&matchMedia('(prefers-color-scheme: dark)').matches),i=document.getElementById('${DOFLOW_FAVICON_LINK_ID}'),u=d?'${DOFLOW_FAVICON_WHITE}':'${DOFLOW_FAVICON_BLACK}';if(i)i.setAttribute('href',u)}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link
          id={DOFLOW_FAVICON_LINK_ID}
          rel="icon"
          type="image/svg+xml"
          href={DOFLOW_FAVICON_BLACK}
        />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=official-20260902" />
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var h=location.hostname.toLowerCase();if(h==='localhost'||h==='127.0.0.1'||h==='app.doflow.it'||h==='doflow.it'||h==='doflow.doflow.it'){document.documentElement.dataset.doflowAuthHost='true'}}catch(e){}",
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: faviconBootstrap }} />
      </head>
      <body className={`${inter.variable} ${mono.variable} ${serif.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="doflow_theme" // ← persiste in localStorage con chiave specifica
        >
          <FaviconThemeManager />
          <TooltipProvider delayDuration={400}>
            <LegacyDesktopUpdateCoordinator />
            {children}
            <Toaster />
            <SonnerToaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
