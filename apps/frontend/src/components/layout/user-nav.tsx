"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { User, Settings, Moon, Sun, LogOut } from "lucide-react";
import { getDoFlowUser, getInitials } from "@/lib/jwt";

export function UserNav() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [user, setUser] = React.useState<{ email: string; role: string; initials: string } | null>(null);

  React.useEffect(() => {
    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email ?? "utente",
        role:     payload.role  ?? "user",
        initials: getInitials(payload.email),
      });
    }
  }, []);

  const logout = () => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full ring-1 ring-border hover:ring-primary/30 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-[13px]">
                  {user?.initials ?? "DF"}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Menu utente</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          Account utente
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent className="w-56 rounded-xl shadow-lg border-border" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1 py-0.5">
            <p className="text-sm font-semibold leading-none truncate">{user?.email ?? "..."}</p>
            <p className="text-xs leading-none text-muted-foreground capitalize">{user?.role ?? ""}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              Il mio Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              Impostazioni
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer">
            {theme === "dark"
              ? <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
              : <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
            }
            Cambia Tema
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-medium"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnetti
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
