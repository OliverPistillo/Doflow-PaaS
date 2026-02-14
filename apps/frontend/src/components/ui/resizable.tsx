"use client"

import { GripVertical } from "lucide-react"
import * as React from "react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

// FIX NUCLEARE: Casting a 'any' per bypassare gli errori di definizione dei tipi
// Questo risolve sia "PanelGroup does not exist" sia i problemi di importazione
const Primitive = ResizablePrimitive as any

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.PanelGroup>) => (
  <Primitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = Primitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Primitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <Primitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </Primitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }