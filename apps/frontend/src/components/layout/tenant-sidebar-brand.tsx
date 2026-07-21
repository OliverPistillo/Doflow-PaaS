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
        "flex h-full w-full items-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
      aria-label="Vai alla dashboard doflow"
    >
      <span className="relative block h-10 w-full max-w-[150px] group-data-[collapsible=icon]:hidden">
        <Image
          src={FULL_LOGO_SRC}
          alt="doflow"
          fill
          sizes="150px"
          className="object-contain object-left dark:invert"
          priority
        />
      </span>
      <span className="relative hidden h-10 w-10 overflow-hidden rounded-xl border border-border/60 bg-background group-data-[collapsible=icon]:block">
        <Image
          src={COMPACT_LOGO_SRC}
          alt="doflow"
          fill
          sizes="40px"
          className="object-contain p-1.5 dark:invert"
          priority
        />
      </span>
    </Link>
  );
}
