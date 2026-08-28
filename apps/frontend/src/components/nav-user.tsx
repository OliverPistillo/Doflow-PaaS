"use client"

import {
  ChevronsUpDown,
  Settings,
  LogOut,
  Radio,
  Coins,
  Laptop,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider"
import { PresenceIndicator } from "@/features/identity/presence-indicator"
import { presenceLabels, type ManualPresenceStatus } from "@/features/identity/presence"
import { requestDesktopProfileSwitch, useDoflowDesktop } from "@/lib/desktop-bridge"

export function NavUser() {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const { currentUser: user, signOut } = useDoflowIdentity()
  const presence = useDoflowPresence()
  const isDesktop = useDoflowDesktop()
  const [duration, setDuration] = useState<"30m" | "1h" | "today" | "forever">("forever")
  const chooseStatus = (status: ManualPresenceStatus | "automatic") => void presence.setManualStatus(status, duration).then((ok) => ok ? toast.success(status === "automatic" ? "Stato automatico ripristinato" : `Stato impostato su ${presenceLabels[status]}`) : toast.error("Stato non aggiornato"))
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
                <span className="truncate text-xs" aria-label={`Stato: ${presenceLabels[presence.current.status]}`}>{presenceLabels[presence.current.status]}</span>
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
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Radio />Stato: {presenceLabels[presence.current.status]}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-52">
                {([['online','Online'],['busy','Occupato'],['away','Assente'],['do_not_disturb','Non disturbare'],['offline','Offline']] as const).map(([status,label]) => <DropdownMenuItem key={status} onSelect={() => chooseStatus(status)}><PresenceIndicator status={status} />{label}</DropdownMenuItem>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => chooseStatus("automatic")}>Ripristina automatico</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Durata stato</DropdownMenuSubTrigger>
              <DropdownMenuSubContent><DropdownMenuRadioGroup value={duration} onValueChange={(value) => setDuration(value as typeof duration)}>{([['30m','30 minuti'],['1h','1 ora'],['today','Fino a oggi'],['forever','Finché non lo cambio']] as const).map(([value,label]) => <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <RankingWinnerBadges userId={user.id} className="px-2 pb-2" />
            <DropdownMenuItem asChild><Link href="/dashboard/bonus"><Coins />Il tuo Bonus</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/dashboard/impostazioni"><Settings />Impostazioni</Link></DropdownMenuItem>
            {isDesktop ? <DropdownMenuItem onSelect={() => void requestDesktopProfileSwitch().catch(() => toast.error("Impossibile cambiare profilo"))}><Laptop />Cambia profilo</DropdownMenuItem> : null}
            <DropdownMenuItem onSelect={() => void signOut().then(() => { router.replace("/login"); router.refresh() })}><LogOut />Esci</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
