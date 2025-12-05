import * as React from 'react';

type Variant = 'default' | 'ghost';
type Size = 'default' | 'sm' | 'icon';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background';

const variants: Record<Variant, string> = {
  default: 'bg-white text-black hover:bg-zinc-100',
  ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-900',
};

const sizes: Record<Size, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 px-3 text-xs',
  icon: 'h-9 w-9',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const v = variants[variant] ?? variants.default;
    const s = sizes[size] ?? sizes.default;

    return (
      <button
        ref={ref}
        className={`${base} ${v} ${s} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
