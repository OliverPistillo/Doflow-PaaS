"use client"

import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { DoflowCapability } from "@/features/identity/permissions"
import { cn } from "@/lib/utils"

export type NavigationItem = {
  title: string
  url: string
  icon?: LucideIcon
  capability?: DoflowCapability
  featureKey?: string
  items?: NavigationItem[]
}

export type NavigationGroup = {
  label: string
  items: NavigationItem[]
  placement?: "normal" | "bottom"
  separated?: boolean
}

function routeIsActive(pathname: string, item: NavigationItem, parentUrl?: string) {
  if (pathname === item.url) return true
  if (item.url === "/dashboard") return false
  return item.url !== parentUrl && pathname.startsWith(`${item.url}/`)
}

export function NavMain({ groups }: { groups: NavigationGroup[] }) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const isCollapsed = !isMobile && state === "collapsed"
  const closeMobileNavigation = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {groups.map((group) => (
        <SidebarGroup
          key={group.label || "help"}
          className={cn(
            "px-2 py-1",
            group.placement === "bottom" && "mt-auto pt-5",
            group.separated && "mt-1 border-t border-sidebar-border/70 pt-2",
          )}
        >
          {group.label ? <SidebarGroupLabel className="h-7 px-1 text-[11px] font-medium normal-case tracking-normal">{group.label}</SidebarGroupLabel> : null}
          <SidebarMenu className="gap-0.5">
            {group.items.map((item) => {
              const isGroupOpen = Boolean(item.items?.some((subItem) => routeIsActive(pathname, subItem, item.url)))
              if (item.items?.length) {
                if (isCollapsed) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            isActive={pathname === item.url || isGroupOpen}
                            aria-label={`Apri il menu ${item.title}`}
                            title={item.title}
                          >
                            {item.icon ? <item.icon /> : null}
                            <span className="sr-only">{item.title}</span>
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" sideOffset={8} className="min-w-56">
                          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {item.items.map((subItem) => (
                            <DropdownMenuItem key={subItem.title} asChild>
                              <Link href={subItem.url} onClick={closeMobileNavigation} className="gap-2">
                                {subItem.icon ? <subItem.icon /> : null}
                                <span>{subItem.title}</span>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <Collapsible key={`${item.title}-${isGroupOpen}`} asChild defaultOpen={isGroupOpen} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title} isActive={pathname === item.url || isGroupOpen}>
                          {item.icon ? <item.icon /> : null}
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton isActive={routeIsActive(pathname, subItem, item.url)} asChild>
                                <Link href={subItem.url} onClick={closeMobileNavigation}>
                                  {subItem.icon ? <subItem.icon /> : null}
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              }

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={routeIsActive(pathname, item)} tooltip={item.title}>
                    <Link href={item.url} onClick={closeMobileNavigation}>
                      {item.icon ? <item.icon /> : null}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </div>
  )
}
