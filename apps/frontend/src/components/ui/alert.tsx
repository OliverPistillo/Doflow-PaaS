import * as React from "react"

import { cn } from "@/lib/utils"

function Alert({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "destructive" }) {
  return <div role="alert" data-slot="alert" data-variant={variant} className={cn("relative grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4", variant === "destructive" ? "border-destructive/35 bg-destructive/8 text-destructive" : "bg-card text-card-foreground", className)} {...props}/>
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 font-medium leading-none", className)} {...props}/>
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("col-start-2 text-sm text-muted-foreground", className)} {...props}/>
}

export { Alert, AlertDescription, AlertTitle }
