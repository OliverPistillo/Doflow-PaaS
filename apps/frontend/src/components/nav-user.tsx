"use client"

import { ChevronsUpDown, Settings, LogOut } from "lucide-react"
import Link from "next/link"

import { UserAvatar } from "@/components/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { roleLabels } from "@/features/identity/permissions"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { currentUser: user, signOut } = useDoflowIdentity()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar userId={user.id} name={user.name} className="h-8 w-8 rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />Online</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar userId={user.id} name={user.name} className="h-8 w-8 rounded-lg" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex flex-wrap gap-1 px-2 py-1">{user.roles.map((role) => <Badge key={role} variant="secondary" className="text-[10px]">{roleLabels[role]}</Badge>)}</div>
            <RankingWinnerBadges userId={user.id} className="px-2 pb-2" />
            <DropdownMenuItem asChild><Link href="/dashboard/impostazioni"><Settings />Impostazioni account</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut}><LogOut />Esci</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
