'use client';

import { applyCustomTheme } from '@/components/theme/apply-custom-theme';

export function ThemeSettings() {
  // esempio brutale
  const handleClick = () => {
    applyCustomTheme({
      primary: '#ff0000',
      secondary: '#00ff00',
      accent: '#0000ff',
      muted: '#888888',
    });
  };

  return (
    <button onClick={handleClick}>
      Applica tema personalizzato di test
    </button>
  );
}
