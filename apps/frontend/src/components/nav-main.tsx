"use client"

import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function NavMain({
  items,
  label = "Workspace",
  className,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    badge?: number | string
    items?: {
      title: string
      url: string
    }[]
  }[]
  label?: string
  className?: string
}) {
  const pathname = usePathname()
  const { state, setOpenMobile } = useSidebar()
  const routeGroup = items.find((item) => getActiveSubItem(item.items, pathname))?.title
  const [openGroup, setOpenGroup] = React.useState<string | null>(routeGroup ?? null)
  const closeMobile = () => setOpenMobile(false)
  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const activeSubItem = getActiveSubItem(item.items, pathname)
          const isGroupActive = Boolean(activeSubItem)
          const isGroupOpen = openGroup === item.title
          return item.items ? (
            state === "collapsed" ? (
              <SidebarMenuItem key={item.title}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton tooltip={activeSubItem ? `${item.title} · ${activeSubItem.title}` : item.title} isActive={isGroupActive} aria-label={`Apri menu ${item.title}${activeSubItem ? `, pagina attiva ${activeSubItem.title}` : ""}`}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
                    <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                    {item.items.map((subItem) => {
                      const isSubItemActive = activeSubItem?.url === subItem.url
                      return (
                      <DropdownMenuItem key={subItem.title} asChild className={cn(isSubItemActive && "bg-accent text-accent-foreground")}>
                        <Link href={subItem.url} onClick={closeMobile} aria-current={isSubItemActive ? "page" : undefined}>{subItem.title}</Link>
                      </DropdownMenuItem>
                    )})}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : (
              <Collapsible key={item.title} asChild open={isGroupOpen} onOpenChange={(open) => setOpenGroup(open ? item.title : null)} className="group/collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={item.title} className={cn("hover:bg-sidebar-accent", isGroupActive || isGroupOpen ? "font-semibold text-sidebar-foreground [&>svg]:text-sidebar-foreground" : "[&>svg]:text-sidebar-foreground/70")}>
                    <Link href={item.url} onClick={closeMobile} data-flow-tour={`flow-nav-${flowSlug(item.title)}`}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      {Boolean(item.badge) && <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-semibold text-primary-foreground" aria-label={typeof item.badge === "number" ? `${item.badge} non letti` : item.badge}>{item.badge}</span>}
                    </Link>
                  </SidebarMenuButton>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction aria-label={`${isGroupOpen ? "Chiudi" : "Apri"} sottomenu ${item.title}`} aria-expanded={isGroupOpen}>
                      <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => {
                        const isSubItemActive = activeSubItem?.url === subItem.url
                        return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton isActive={isSubItemActive} asChild className={cn(isSubItemActive && "relative bg-sidebar-accent/70 pl-3 font-medium text-sidebar-primary before:absolute before:bottom-1 before:left-0 before:top-1 before:w-0.5 before:rounded-full before:bg-sidebar-primary")}>
                            <Link href={subItem.url} onClick={closeMobile} aria-current={isSubItemActive ? "page" : undefined} data-flow-tour={`flow-nav-${flowSlug(subItem.title)}`}><span>{subItem.title}</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )})}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                <Link href={item.url} onClick={closeMobile} data-flow-tour={`flow-nav-${flowSlug(item.title)}`}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {Boolean(item.badge) && <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-semibold text-primary-foreground" aria-label={typeof item.badge === "number" ? `${item.badge} non letti` : item.badge}>{item.badge}</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function getActiveSubItem(items: Array<{ title: string; url: string }> | undefined, pathname: string) {
  return items
    ?.filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((left, right) => right.url.length - left.url.length)[0]
}

function flowSlug(value:string){return value.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
