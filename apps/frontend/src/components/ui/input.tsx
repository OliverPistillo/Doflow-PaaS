import * as React from "react"

import { cn } from "../../lib/utils"

export type InputProps = React.ComponentProps<"input">

const INPUT_CONTROL_CLASSES = "h-[var(--input-control-height)] w-full min-w-0 rounded-[var(--input-control-radius)] border border-input bg-[var(--input-control-background)] px-[var(--input-control-padding-x)] py-[var(--input-control-padding-y)] text-[length:var(--input-control-font-size)] leading-[var(--input-control-line-height)] font-[var(--input-control-font-weight)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

export function inputClassNames(className?: string) {
  const hasExplicitShadow = /(?:^|\s)shadow(?:-|\[)/.test(className || "")
  return cn(
    INPUT_CONTROL_CLASSES,
    !hasExplicitShadow && "shadow-[var(--input-control-shadow)]",
    className,
  )
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={inputClassNames(className)}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
