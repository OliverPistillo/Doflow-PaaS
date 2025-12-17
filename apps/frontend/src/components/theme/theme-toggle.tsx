'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const current = theme === 'system' ? resolvedTheme : theme;

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="w-full justify-start" disabled>
        Tema
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
    >
      {current === 'dark' ? '🌙 Dark' : '☀️ Light'}
    </Button>
  );
}
