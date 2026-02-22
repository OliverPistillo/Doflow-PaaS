"use client";

import { useState } from "react";
import {
  Plus, Search, Globe, Building2, Users, TrendingUp,
  MoreHorizontal, Edit2, Trash2, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type CompanyStatus = "attivo" | "prospect" | "inattivo";

interface Company {
  id: number; name: string; sector: string; employees: string;
  revenue: string; city: string; website: string;
  contacts: number; deals: number; avatar: string;
  status: CompanyStatus; vat: string;
}

const INIT: Company[] = [
  { id: 1, name: "StartupIO", sector: "Tech", employees: "10-50", revenue: "€500K", city: "Milano", website: "startup.io", contacts: 2, deals: 1, avatar: "SI", status: "attivo", vat: "IT12345678901" },
  { id: 2, name: "BigCorp SpA", sector: "Enterprise", employees: "500+", revenue: "€50M", city: "Roma", website: "bigcorp.com", contacts: 3, deals: 2, avatar: "BC", status: "attivo", vat: "IT23456789012" },
  { id: 3, name: "DesignStudio Srl", sector: "Design", employees: "10-50", revenue: "€1.2M", city: "Torino", website: "design.studio", contacts: 2, deals: 1, avatar: "DS", status: "attivo", vat: "IT34567890123" },
  { id: 4, name: "InnovateIT", sector: "Tech", employees: "50-200", revenue: "€5M", city: "Bologna", website: "innovate.it", contacts: 1, deals: 1, avatar: "IN", status: "prospect", vat: "IT45678901234" },
  { id: 5, name: "MediaGroup Italia", sector: "Media", employees: "200-500", revenue: "€20M", city: "Napoli", website: "mediagroup.it", contacts: 4, deals: 2, avatar: "MG", status: "attivo", vat: "IT56789012345" },
  { id: 6, name: "DigitalWave Srl", sector: "Digital", employees: "10-50", revenue: "€800K", city: "Firenze", website: "digitalwave.it", contacts: 1, deals: 1, avatar: "DW", status: "attivo", vat: "IT67890123456" },
  { id: 7, name: "NexusLab", sector: "Consulting", employees: "50-200", revenue: "€3M", city: "Milano", website: "nexuslab.com", contacts: 2, deals: 0, avatar: "NL", status: "prospect", vat: "IT78901234567" },
  { id: 8, name: "SmartFactory", sector: "Manufacturing", employees: "200-500", revenue: "€15M", city: "Brescia", website: "smartfactory.it", contacts: 3, deals: 2, avatar: "SF", status: "attivo", vat: "IT89012345678" },
];

const STATUS_CONFIG: Record<CompanyStatus, { label: string; color: string }> = {
  attivo:   { label: "Cliente",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  prospect: { label: "Prospect",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  inattivo: { label: "Inattivo",  color: "bg-muted text-muted-foreground" },
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>(INIT);
  const [search, setSearch]       = useState("");
  const [showCreate, setCreate]   = useState(false);
  const [form, setForm]           = useState({ name: "", sector: "", city: "", website: "", vat: "" });
  const { toast } = useToast();

  const filtered = companies.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.sector.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const c: Company = { id: Date.now(), ...form, employees: "1-10", revenue: "—", contacts: 0, deals: 0, avatar: form.name.slice(0, 2).toUpperCase(), status: "prospect" };
    setCompanies((cs) => [c, ...cs]);
    setForm({ name: "", sector: "", city: "", website: "", vat: "" });
    setCreate(false);
    toast({ title: "Azienda aggiunta" });
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Aziende</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{companies.length} aziende nel CRM</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" /> Esporta</Button>
          <Button onClick={() => setCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Nuova Azienda
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Totali", value: companies.length, color: "" },
          { label: "Clienti Attivi", value: companies.filter((c) => c.status === "attivo").length, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Prospect", value: companies.filter((c) => c.status === "prospect").length, color: "text-amber-600 dark:text-amber-400" },
          { label: "Deal Totali", value: companies.reduce((s, c) => s + c.deals, 0), color: "text-indigo-600 dark:text-indigo-400" },
        ].map(({ label, value, color }) => (
          <Card key={label}><CardContent className="pt-4 pb-3 px-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca aziende..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Azienda</TableHead>
              <TableHead>Settore</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Dipendenti</TableHead>
              <TableHead>Contatti</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Fatturato Est.</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Nessuna azienda trovata</TableCell></TableRow>
            )}
            {filtered.map((c) => {
              const sc = STATUS_CONFIG[c.status];
              return (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{c.avatar}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" /> {c.website}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.sector}</TableCell>
                  <TableCell><span className={`text-xs font-semibold px-2 py-1 rounded-full ${sc.color}`}>{sc.label}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.employees}</TableCell>
                  <TableCell><div className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-3.5 w-3.5" />{c.contacts}</div></TableCell>
                  <TableCell><div className="flex items-center gap-1 text-sm text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />{c.deals}</div></TableCell>
                  <TableCell className="text-sm font-medium">{c.revenue}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Edit2 className="mr-2 h-4 w-4" /> Modifica</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setCompanies((cs) => cs.filter((x) => x.id !== c.id)); toast({ title: "Azienda rimossa" }); }} className="text-red-600 focus:text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setCreate}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Nuova Azienda</DialogTitle><DialogDescription>Aggiungi un'azienda al CRM.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Ragione Sociale *</Label><Input placeholder="Es. AcmeCorp Srl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Settore</Label><Input placeholder="Es. Tech" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Città</Label><Input placeholder="Es. Milano" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Sito Web</Label><Input placeholder="acme.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Partita IVA</Label><Input placeholder="IT..." value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreate(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
