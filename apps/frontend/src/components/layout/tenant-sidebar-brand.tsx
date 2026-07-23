"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const FULL_LOGO_SRC = "/doflow_logo.svg";
const COMPACT_LOGO_SRC = "/doflow_logo.svg";

export function TenantSidebarBrand({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex h-full w-full items-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
      aria-label="Vai alla dashboard doflow"
    >
      <span className="flex h-[70px] w-full items-center overflow-hidden group-data-[collapsible=icon]:hidden">
        <Image
          src={FULL_LOGO_SRC}
          alt="doflow"
          width={828}
          height={414}
          sizes="210px"
          className="h-[64px] w-[210px] shrink-0 object-contain object-left dark:invert"
          priority
        />
      </span>
      <span className="relative hidden h-11 w-11 overflow-hidden group-data-[collapsible=icon]:block">
        <Image
          src={COMPACT_LOGO_SRC}
          alt="doflow"
          fill
          sizes="44px"
          className="object-contain object-center dark:invert"
          priority
        />
      </span>
    </Link>
  );
}
