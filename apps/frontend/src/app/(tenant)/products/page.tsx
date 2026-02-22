"use client";

import { useState } from "react";
import {
  Plus, Search, Package, MoreHorizontal, Edit2, Trash2,
  Download, Upload, Filter, Grid3X3, List,
  Tag, DollarSign, Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ProductType = "servizio" | "prodotto";

interface Product {
  id: number; name: string; sku: string; category: string;
  type: ProductType; price: number; unit: string;
  status: "attivo" | "inattivo"; description: string;
  image: string; stock: number | null; taxRate: number;
}

const INIT: Product[] = [
  { id: 1, name: "Sviluppo Sito Web", sku: "SRV-WEB-001", category: "Servizi Web", type: "servizio", price: 5000, unit: "progetto", status: "attivo", description: "Progettazione e sviluppo sito web responsive completo", image: "🌐", stock: null, taxRate: 22 },
  { id: 2, name: "App Mobile iOS/Android", sku: "SRV-APP-001", category: "Servizi Mobile", type: "servizio", price: 15000, unit: "progetto", status: "attivo", description: "Sviluppo app nativa cross-platform con React Native", image: "📱", stock: null, taxRate: 22 },
  { id: 3, name: "Consulenza UX/UI", sku: "SRV-UX-001", category: "Design", type: "servizio", price: 120, unit: "ora", status: "attivo", description: "Analisi e progettazione esperienza utente e interfacce", image: "🎨", stock: null, taxRate: 22 },
  { id: 4, name: "SEO & Content Strategy", sku: "SRV-SEO-001", category: "Marketing", type: "servizio", price: 800, unit: "mese", status: "attivo", description: "Ottimizzazione motori di ricerca e strategia contenuti", image: "📈", stock: null, taxRate: 22 },
  { id: 5, name: "Hosting Cloud Premium", sku: "PRD-HST-001", category: "Infrastruttura", type: "prodotto", price: 49, unit: "mese", status: "attivo", description: "Hosting cloud ad alte prestazioni con CDN inclusa", image: "☁️", stock: 200, taxRate: 22 },
  { id: 6, name: "Licenza CRM DoFlow", sku: "PRD-CRM-001", category: "Software", type: "prodotto", price: 29, unit: "utente/mese", status: "attivo", description: "Licenza mensile piattaforma CRM DoFlow Pro", image: "💼", stock: null, taxRate: 22 },
  { id: 7, name: "Migrazione Cloud", sku: "SRV-CLD-001", category: "Infrastruttura", type: "servizio", price: 8000, unit: "progetto", status: "attivo", description: "Migrazione completa infrastruttura verso il cloud", image: "🔄", stock: null, taxRate: 22 },
  { id: 8, name: "Formazione Team", sku: "SRV-TRN-001", category: "Formazione", type: "servizio", price: 450, unit: "giornata", status: "attivo", description: "Sessione formativa personalizzata per il team", image: "🎓", stock: null, taxRate: 22 },
  { id: 9, name: "Brand Identity Package", sku: "SRV-BRD-001", category: "Design", type: "servizio", price: 3500, unit: "progetto", status: "attivo", description: "Logo, palette colori, tipografia, brand guidelines", image: "✨", stock: null, taxRate: 22 },
];

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);
const CATEGORIES = [...new Set(INIT.map((p) => p.category))];

export default function ProductsPage() {
  const [products, setProducts]   = useState<Product[]>(INIT);
  const [search, setSearch]       = useState("");
  const [catFilter, setCat]       = useState("all");
  const [typeFilter, setType]     = useState<"all" | ProductType>("all");
  const [view, setView]           = useState<"list" | "grid">("list");
  const [showCreate, setCreate]   = useState(false);
  const [form, setForm]           = useState({ name: "", sku: "", category: "", price: "", unit: "progetto", type: "servizio" as ProductType, description: "" });
  const { toast } = useToast();

  const filtered = products.filter((p) => {
    if (catFilter !== "all" && p.category !== catFilter) return false;
    if (typeFilter !== "all" && p.type !== typeFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const p: Product = { id: Date.now(), ...form, price: Number(form.price) || 0, status: "attivo", image: "📦", stock: null, taxRate: 22, sku: form.sku || `PRD-${Date.now()}` };
    setProducts((ps) => [p, ...ps]);
    setForm({ name: "", sku: "", category: "", price: "", unit: "progetto", type: "servizio", description: "" });
    setCreate(false);
    toast({ title: "Prodotto aggiunto" });
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Catalogo Prodotti</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} prodotti e servizi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1.5" /> Importa</Button>
          <Button onClick={() => setCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Nuovo Prodotto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Totali", value: products.length, color: "", icon: Package },
          { label: "Servizi", value: products.filter((p) => p.type === "servizio").length, color: "text-indigo-600 dark:text-indigo-400", icon: Tag },
          { label: "Prodotti", value: products.filter((p) => p.type === "prodotto").length, color: "text-emerald-600 dark:text-emerald-400", icon: Box },
          { label: "Categorie", value: CATEGORIES.length, color: "text-amber-600 dark:text-amber-400", icon: Filter },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label}><CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <Icon className={cn("h-8 w-8", color || "text-muted-foreground")} />
            <div><div className={`text-2xl font-bold ${color}`}>{value}</div><p className="text-xs text-muted-foreground">{label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca prodotti..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCat}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setType(v as typeof typeFilter)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="servizio">Servizi</SelectItem>
            <SelectItem value="prodotto">Prodotti</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setView(view === "list" ? "grid" : "list")}>
          {view === "list" ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
        </Button>
      </div>

      {view === "list" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prodotto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Unità</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Nessun prodotto trovato</TableCell></TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.image}</span>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.description.slice(0, 50)}…</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{p.category}</Badge></TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.type === "servizio" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                      {p.type === "servizio" ? "Servizio" : "Prodotto"}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold">{fmt(p.price)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.unit}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.taxRate}%</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Edit2 className="mr-2 h-4 w-4" /> Modifica</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setProducts((ps) => ps.filter((x) => x.id !== p.id)); toast({ title: "Prodotto rimosso" }); }} className="text-red-600 focus:text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="text-4xl mb-3">{p.image}</div>
                <div className="font-semibold mb-1">{p.name}</div>
                <div className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold">{fmt(p.price)}<span className="text-xs text-muted-foreground font-normal ml-1">/ {p.unit}</span></div>
                  <Badge variant="secondary" className="text-xs">{p.category}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setCreate}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Nuovo Prodotto / Servizio</DialogTitle><DialogDescription>Aggiungi al catalogo.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Nome *</Label><Input placeholder="Nome prodotto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>SKU</Label><Input placeholder="Es. PRD-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ProductType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="servizio">Servizio</SelectItem><SelectItem value="prodotto">Prodotto</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Categoria</Label><Input placeholder="Es. Design" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Prezzo €</Label><Input type="number" placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Unità</Label><Input placeholder="Es. ora, progetto" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Descrizione</Label><Textarea placeholder="Descrizione breve..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
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
