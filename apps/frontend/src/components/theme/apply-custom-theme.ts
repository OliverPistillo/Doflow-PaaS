'use client';

export function applyCustomTheme(options: {
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
}) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  root.style.setProperty('--doflow-primary', options.primary);
  root.style.setProperty('--doflow-secondary', options.secondary);
  root.style.setProperty('--doflow-accent', options.accent);
  root.style.setProperty('--doflow-muted', options.muted);

  root.dataset.theme = 'custom';
}
