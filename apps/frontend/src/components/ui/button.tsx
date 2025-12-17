import * as React from 'react';

type Variant = 'default' | 'ghost' | 'outline';
type Size = 'default' | 'sm' | 'icon';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  ghost: 'bg-transparent text-foreground hover:bg-accent',
  outline: 'border border-border bg-transparent text-foreground hover:bg-accent',
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
