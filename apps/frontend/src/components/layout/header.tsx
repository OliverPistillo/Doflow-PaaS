"use client";

import { UserNav } from "./user-nav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Search, Bell } from "lucide-react";
import { Sidebar } from "./tenant-sidebar";
import { Input } from "@/components/ui/input";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center border-b bg-white px-6 shadow-sm dark:bg-slate-950 dark:border-slate-800">
      {/* MOBILE MENU */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden mr-4">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-slate-950 border-r-slate-800 text-white">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* SEARCH (Opzionale) */}
      <div className="hidden md:flex items-center relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
        <Input 
          type="search" 
          placeholder="Cerca (Ctrl+K)..." 
          className="pl-9 h-9 bg-slate-100 border-slate-200 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800"
        />
      </div>

      {/* RIGHT ACTIONS */}
      <div className="ml-auto flex items-center space-x-4">
        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-indigo-600">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full border border-white dark:border-slate-950"></span>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}