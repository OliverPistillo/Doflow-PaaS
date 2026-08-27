import Image from "next/image"
import Link from "next/link"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarBrand() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size="lg"
          tooltip="Vai alla Panoramica"
          className="transition-none"
        >
          <Link href="/dashboard" aria-label="doflow · Vai alla Panoramica">
            <span className="hidden size-9 shrink-0 items-center justify-center group-data-[collapsible=icon]:flex">
              <Image
                src="/brand/marchio_logo_nero.svg"
                alt="doflow"
                width={28}
                height={28}
                className="size-7 object-contain dark:hidden"
              />
              <Image
                src="/brand/marchio_logo_bianco.svg"
                alt="doflow"
                width={28}
                height={28}
                className="hidden size-7 object-contain dark:block"
              />
            </span>
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <Image src="/brand/logo_doflow_nero.svg" alt="doflow" width={120} height={24} priority className="h-auto w-[120px] dark:hidden" />
              <Image src="/brand/logo_doflow_bianco.svg" alt="doflow" width={120} height={24} priority className="hidden h-auto w-[120px] dark:block" />
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
