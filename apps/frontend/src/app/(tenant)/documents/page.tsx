"use client";

import { useState, useMemo, useEffect } from "react";
import { FolderOpen, Upload, Search, Grid3X3, List, Download, Trash2,
  Share2, Star, MoreHorizontal, File, FileText, Sheet, Package,
  Image, Clock, Users, Eye, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { tenantFetch } from "@/lib/tenant-fetch";
import { RequireTenantModule } from "@/components/auth/require-tenant-module";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "pdf" | "docx" | "xlsx" | "fig" | "zip" | "pptx" | "png" | "jpg" | "unknown";

interface Doc {
  id: number;
  name: string;
  type: DocType;
  size: string;
  folder: string;
  modified: string;
  owner: string;
  shared: string[];
  starred: boolean;
  originalName?: string;
  key?: string;
}

const FOLDERS = ["Tutti", "Contratti", "Proposte", "Preventivi", "Deliverables", "Analisi", "Design", "Report", "Progetti", "Media", "Docs", "Generale"];

// ─── File type config ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<DocType, { icon: React.ComponentType<{className?: string}>; color: string; bg: string; label: string }> = {
  pdf:  { icon: FileText, color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/40",    label: "PDF" },
  docx: { icon: FileText, color: "text-sky-600",     bg: "bg-sky-100 dark:bg-sky-950/40",      label: "Word" },
  xlsx: { icon: Sheet,    color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40", label: "Excel" },
  fig:  { icon: Image,    color: "text-chart-4",  bg: "bg-chart-4/10 dark:bg-chart-4/5/40", label: "Figma" },
  zip:  { icon: Package,  color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40",   label: "ZIP" },
  pptx: { icon: File,     color: "text-orange-600",  bg: "bg-orange-100 dark:bg-orange-950/40", label: "PowerPoint" },
  png:  { icon: Image,    color: "text-teal-600",    bg: "bg-teal-100 dark:bg-teal-950/40",     label: "PNG" },
  jpg:  { icon: Image,    color: "text-teal-600",    bg: "bg-teal-100 dark:bg-teal-950/40",     label: "JPG" },
  unknown: { icon: File,  color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-950/40",  label: "File" },
};

const AVATAR_COLORS: Record<string, string> = {
  "Marco R.": "bg-primary", "Giulia B.": "bg-emerald-500",
  "Luca P.": "bg-chart-4",  "Sara M.": "bg-rose-500",
};

// ─── File card (grid view) ────────────────────────────────────────────────────

function FileCard({ doc }: { doc: Doc }) {
  const cfg = TYPE_CONFIG[doc.type];
  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer border-border/60">
      <CardContent className="p-4">
        {/* Icon + star */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", cfg.bg)}>
            <cfg.icon className={cn("h-6 w-6", cfg.color)} />
          </div>
          <div className="flex items-center gap-1">
            {doc.starred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" /> Apri</DropdownMenuItem>
                <DropdownMenuItem><Download className="h-3.5 w-3.5 mr-2" /> Scarica</DropdownMenuItem>
                <DropdownMenuItem><Share2 className="h-3.5 w-3.5 mr-2" /> Condividi</DropdownMenuItem>
                <DropdownMenuItem><Star className="h-3.5 w-3.5 mr-2" /> {doc.starred ? "Rimuovi stella" : "Aggiungi stella"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-rose-600"><Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="text-sm font-medium leading-tight truncate mb-1">{doc.name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{doc.size}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", cfg.color)}>{cfg.label}</Badge>
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex -space-x-1">
            {[doc.owner, ...doc.shared].slice(0, 3).map((u, i) => (
              <Avatar key={i} className="h-5 w-5 border border-background">
                <AvatarFallback className={cn("text-[8px] font-bold text-white", AVATAR_COLORS[u] ?? "bg-muted/60")}>
                  {u.split(" ").map(p => p[0]).join("")}
                </AvatarFallback>
              </Avatar>
            ))}
            {doc.shared.length > 2 && (
              <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                +{doc.shared.length - 2}
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {new Date(doc.modified).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── File row (list view) ─────────────────────────────────────────────────────

function FileRow({ doc }: { doc: Doc }) {
  const cfg = TYPE_CONFIG[doc.type];
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 hover:bg-muted/30 transition-colors group cursor-pointer">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
        <cfg.icon className={cn("h-4 w-4", cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">{doc.folder}</p>
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {[doc.owner, ...doc.shared].slice(0, 2).map((u, i) => (
          <Avatar key={i} className="h-5 w-5">
            <AvatarFallback className={cn("text-[8px] font-bold text-white", AVATAR_COLORS[u] ?? "bg-muted/60")}>
              {u.split(" ").map(p => p[0]).join("")}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="hidden sm:block text-xs text-muted-foreground w-20 text-right">{doc.size}</span>
      <span className="hidden md:block text-xs text-muted-foreground w-24 text-right">{new Date(doc.modified).toLocaleDateString("it-IT")}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {doc.starred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" /> Apri</DropdownMenuItem>
            <DropdownMenuItem><Share2 className="h-3.5 w-3.5 mr-2" /> Condividi</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-600"><Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [folder, setFolder]   = useState("Tutti");
  const [search, setSearch]   = useState("");
  const [view, setView]       = useState<"grid" | "list">("grid");
  const [starred, setStarred] = useState(false);
  const [documents, setDocuments] = useState<Doc[]>([]);

  useEffect(() => {
    let mounted = true;
    tenantFetch("/api/files")
      .then(res => res.json())
      .then(data => {
        if (!mounted || !data.files) return;
        const formatted: Doc[] = data.files.map((f: any) => {
          let t = "unknown";
          const lowerName = (f.original_name || "").toLowerCase();
          if (lowerName.endsWith(".pdf")) t = "pdf";
          else if (lowerName.endsWith(".docx")) t = "docx";
          else if (lowerName.endsWith(".xlsx")) t = "xlsx";
          else if (lowerName.endsWith(".fig")) t = "fig";
          else if (lowerName.endsWith(".zip")) t = "zip";
          else if (lowerName.endsWith(".pptx")) t = "pptx";
          else if (lowerName.endsWith(".png")) t = "png";
          else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) t = "jpg";

          return {
            id: f.id,
            name: f.original_name,
            originalName: f.original_name,
            type: t as DocType,
            size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
            folder: "Generale", // Fallback, could map to a real folder if available in DB
            modified: f.created_at,
            owner: f.created_by || "Utente",
            shared: [],
            starred: false,
            key: f.key,
          };
        });
        setDocuments(formatted);
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => documents.filter(d => {
    if (starred && !d.starred)                                return false;
    if (folder !== "Tutti" && d.folder !== folder)            return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [documents, folder, search, starred]);

  const folderCounts = useMemo(() => {
    const m: Record<string, number> = { Tutti: documents.length };
    for (const f of FOLDERS.slice(1)) m[f] = documents.filter(d => d.folder === f).length;
    return m;
  }, [documents]);

  const totalSizeMB = useMemo(() => documents.reduce((s, d) => {
    const n = parseFloat(d.size);
    return s + (d.size.includes("KB") ? n / 1024 : d.size.includes("GB") ? n * 1024 : n);
  }, 0), [documents]);

  return (
    <RequireTenantModule moduleKey="docs.files">
    <div className="flex-1 flex overflow-hidden animate-in fade-in duration-500" style={{ height: "calc(100vh - 64px)" }}>

      {/* Sidebar folders */}
      <div className="hidden md:flex flex-col w-52 border-r border-border/50 bg-muted/20 p-3 space-y-0.5 shrink-0 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-2">Cartelle</p>
        {FOLDERS.map(f => (
          <button
            key={f}
            onClick={() => { setFolder(f); setStarred(false); }}
            className={cn(
              "w-full flex items-center justify-between text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
              folder === f && !starred ? "bg-primary/10 text-primary font-medium dark:bg-primary/5 dark:text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5" />{f}</span>
            {folderCounts[f] > 0 && <span className="text-[10px] opacity-60">{folderCounts[f]}</span>}
          </button>
        ))}
        <div className="border-t border-border/40 my-2" />
        <button
          onClick={() => setStarred(!starred)}
          className={cn(
            "w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
            starred ? "bg-amber-100 text-amber-700 font-medium dark:bg-amber-950/40 dark:text-amber-300" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Star className="h-3.5 w-3.5" /> Preferiti
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border/50">
          <div>
            <h2 className="text-xl font-bold">
              {starred ? "Preferiti" : folder === "Tutti" ? "Tutti i documenti" : folder}
            </h2>
            <p className="text-xs text-muted-foreground">{filtered.length} file · {totalSizeMB.toFixed(1)} MB totali</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca file..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button onClick={() => setView("grid")} className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setView("list")} className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
              <Upload className="mr-1.5 h-4 w-4" /> Carica
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nessun documento trovato.</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map(d => <FileCard key={d.id} doc={d} />)}
              {/* Upload drop zone */}
              <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/50 rounded-xl p-4 text-center cursor-pointer hover:border-primary/70 hover:bg-primary/5/30 dark:hover:bg-primary/10/10 transition-colors min-h-[140px]">
                <Plus className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Carica file</p>
              </div>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 border-b border-border/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                <div className="w-8" />
                <div>Nome</div>
                <div className="w-20 text-right">Dimensione</div>
                <div className="w-24 text-right">Modificato</div>
                <div className="w-16" />
              </div>
              <div className="divide-y divide-border/40">
                {filtered.map(d => <FileRow key={d.id} doc={d} />)}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
    </RequireTenantModule>
  );
}