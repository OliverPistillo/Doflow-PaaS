"use client";

import { useState } from "react";
import {
  Plus, Search, Mail, Phone, Building2, MapPin,
  MoreHorizontal, Download, Upload, Edit2, Trash2,
  Tag, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

type ContactType = "cliente" | "lead";

interface Contact {
  id: number; name: string; email: string; phone: string;
  company: string; role: string; avatar: string; type: ContactType;
  tags: string[]; lastContact: string; city: string;
}

const INIT: Contact[] = [
  { id: 1, name: "Francesca Romano", email: "francesca@startup.io", phone: "+39 338 6789012", company: "StartupIO", role: "CEO", avatar: "FR", type: "lead", tags: ["Decision Maker", "Tech"], lastContact: "2026-02-18", city: "Milano" },
  { id: 2, name: "Alessandro Galli", email: "ale@bigcorp.com", phone: "+39 339 7890123", company: "BigCorp SpA", role: "CTO", avatar: "AG", type: "lead", tags: ["Tecnico"], lastContact: "2026-02-15", city: "Roma" },
  { id: 3, name: "Elena Ferri", email: "elena@design.studio", phone: "+39 340 8901234", company: "DesignStudio Srl", role: "Creative Director", avatar: "EF", type: "cliente", tags: ["Design"], lastContact: "2026-02-19", city: "Torino" },
  { id: 4, name: "Roberto Mazza", email: "rob@innovate.it", phone: "+39 341 9012345", company: "InnovateIT", role: "Head of Product", avatar: "RM", type: "lead", tags: ["Product"], lastContact: "2026-02-10", city: "Bologna" },
  { id: 5, name: "Chiara Lombardi", email: "chiara@mediagroup.it", phone: "+39 342 0123456", company: "MediaGroup Italia", role: "Marketing Manager", avatar: "CL", type: "lead", tags: ["Marketing"], lastContact: "2026-02-17", city: "Napoli" },
  { id: 6, name: "Marco Ferretti", email: "marco.f@digitalwave.it", phone: "+39 343 1234567", company: "DigitalWave Srl", role: "Founder", avatar: "MF", type: "cliente", tags: ["Startup"], lastContact: "2026-02-20", city: "Firenze" },
  { id: 7, name: "Valentina Ricci", email: "v.ricci@nexuslab.com", phone: "+39 344 2345678", company: "NexusLab", role: "Operations Manager", avatar: "VR", type: "lead", tags: ["Operazioni"], lastContact: "2026-02-12", city: "Milano" },
  { id: 8, name: "Davide Colombo", email: "d.colombo@smartfactory.it", phone: "+39 345 3456789", company: "SmartFactory", role: "CEO", avatar: "DC", type: "cliente", tags: ["Manufacturing"], lastContact: "2026-02-14", city: "Brescia" },
];

const TYPE_CONFIG: Record<ContactType, { label: string; color: string }> = {
  cliente: { label: "Cliente", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  lead:    { label: "Lead",    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(INIT);
  const [search, setSearch]     = useState("");
  const [typeFilter, setType]   = useState<"all" | ContactType>("all");
  const [showCreate, setCreate] = useState(false);
  const [form, setForm]         = useState({ name: "", email: "", phone: "", company: "", role: "", city: "" });
  const { toast } = useToast();

  const filtered = contacts.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const c: Contact = { id: Date.now(), ...form, avatar: form.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), type: "lead", tags: [], lastContact: new Date().toISOString().slice(0, 10) };
    setContacts((cs) => [c, ...cs]);
    setForm({ name: "", email: "", phone: "", company: "", role: "", city: "" });
    setCreate(false);
    toast({ title: "Contatto aggiunto" });
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rubrica Contatti</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{contacts.length} contatti totali</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1.5" /> Importa</Button>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" /> Esporta</Button>
          <Button onClick={() => setCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Nuovo Contatto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Totali", value: contacts.length, color: "text-foreground" },
          { label: "Clienti", value: contacts.filter((c) => c.type === "cliente").length, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Lead", value: contacts.filter((c) => c.type === "lead").length, color: "text-sky-600 dark:text-sky-400" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div className="pt-4 pb-3 px-4">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca contatti..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setType(v as typeof typeFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="cliente">Clienti</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contatto</TableHead>
              <TableHead>Azienda</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Città</TableHead>
              <TableHead>Ultimo Contatto</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Nessun contatto trovato</TableCell></TableRow>
            )}
            {filtered.map((c) => {
              const tc = TYPE_CONFIG[c.type];
              return (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{c.avatar}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" /> {c.company}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-0.5">{c.role}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${tc.color}`}>{tc.label}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {c.city}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.lastContact).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Mail className="mr-2 h-4 w-4" /> Invia email</DropdownMenuItem>
                        <DropdownMenuItem><Phone className="mr-2 h-4 w-4" /> Chiama</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setContacts((cs) => cs.filter((x) => x.id !== c.id)); toast({ title: "Contatto rimosso" }); }} className="text-red-600 focus:text-red-600">
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nuovo Contatto</DialogTitle>
            <DialogDescription>Aggiungi un contatto alla rubrica.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Nome *</Label><Input placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Email</Label><Input placeholder="email@esempio.it" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Telefono</Label><Input placeholder="+39..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Azienda</Label><Input placeholder="Es. AcmeCorp" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Ruolo</Label><Input placeholder="Es. CEO" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Città</Label><Input placeholder="Es. Milano" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
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
