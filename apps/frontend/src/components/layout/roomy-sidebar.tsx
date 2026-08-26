"use client"

import * as React from "react"

import {
  SidebarMenuButton,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const RoomySidebarMenuButton = React.forwardRef<
  React.ElementRef<typeof SidebarMenuButton>,
  React.ComponentPropsWithoutRef<typeof SidebarMenuButton>
>(({ className, ...props }, ref) => (
  <SidebarMenuButton
    ref={ref}
    className={cn(
      "h-11 gap-3 rounded-[10px] px-3 py-2.5 text-base font-semibold leading-normal",
      "transition-[width,height,padding,background,color] duration-150",
      "group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2",
      "[&>svg]:size-6",
      props.size === "sm" && "h-8 text-sm",
      props.size === "lg" && "h-14 text-base group-data-[collapsible=icon]:!p-0",
      className,
    )}
    {...props}
  />
))
RoomySidebarMenuButton.displayName = "RoomySidebarMenuButton"

const RoomySidebarMenuSubButton = React.forwardRef<
  React.ElementRef<typeof SidebarMenuSubButton>,
  React.ComponentPropsWithoutRef<typeof SidebarMenuSubButton>
>(({ className, ...props }, ref) => (
  <SidebarMenuSubButton
    ref={ref}
    className={cn(
      "h-7 gap-2 rounded-md px-2 [&>svg]:size-4",
      props.size === "sm" ? "text-xs" : "text-sm",
      className,
    )}
    {...props}
  />
))
RoomySidebarMenuSubButton.displayName = "RoomySidebarMenuSubButton"

export { RoomySidebarMenuButton, RoomySidebarMenuSubButton }
