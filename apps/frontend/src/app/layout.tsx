import type { Metadata } from 'next';
import React, { Suspense } from 'react'; // Aggiunto import di Suspense
import './globals.css';

import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { AuthSync } from '@/components/auth-sync'; // Aggiunto import del componente

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Doflow',
  description: 'Doflow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} antialiased`}>
        <ThemeProvider>
          {/* AuthSync intercetta il token nell'URL (es: ?accessToken=...) 
             e lo salva nel LocalStorage del nuovo dominio.
             È avvolto in Suspense perché usa useSearchParams.
          */}
          <Suspense fallback={null}>
            <AuthSync />
          </Suspense>
          
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}