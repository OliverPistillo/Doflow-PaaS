"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plug, Settings, ShieldCheck, UsersRound } from "lucide-react";

const items = [
  { href: "/settings", label: "Generali", icon: Settings, exact: true },
  { href: "/settings/integrations", label: "Integrazioni", icon: Plug },
  { href: "/settings/security", label: "Sicurezza e accessi", icon: ShieldCheck },
  { href: "/settings/users", label: "Utenti e permessi", icon: UsersRound },
];

export function SettingsNavigation() {
  const pathname = usePathname();
  return (
    <nav className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5">
      <div className="flex min-w-max gap-1">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium ${active ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
