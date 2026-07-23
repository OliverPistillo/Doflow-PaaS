"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const FULL_LOGO_SRC = "/logo-doflow.svg";
const COMPACT_LOGO_SRC = "/logo-doflow.svg";

export function TenantSidebarBrand({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex h-full w-full items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
      aria-label="Vai alla dashboard doflow"
    >
      <span className="flex h-12 w-full items-center overflow-hidden px-1 group-data-[collapsible=icon]:hidden">
        <Image
          src={FULL_LOGO_SRC}
          alt="doflow"
          width={156}
          height={39}
          sizes="104px"
          className="h-auto w-[104px] shrink-0 dark:invert"
          priority
        />
      </span>
      <span className="relative hidden h-9 w-9 overflow-hidden rounded-lg bg-background group-data-[collapsible=icon]:block">
        <Image
          src={COMPACT_LOGO_SRC}
          alt="doflow"
          fill
          sizes="40px"
          className="object-contain p-1 dark:invert"
          priority
        />
      </span>
    </Link>
  );
}
