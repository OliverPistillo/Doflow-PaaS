"use client";

import React, { useEffect, useState } from "react";
import { 
  Eye, KeyRound, Plus, Building2, MoreHorizontal, 
  Search, Filter, RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, 
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { tenantFetch } from "@/lib/tenant-fetch";
import { useToast } from "@/hooks/use-toast";

export default function TenantsPage() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtri
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Modali
  const [resetModal, setResetModal] = useState<{open: boolean, tenantId: string, email: string, result?: string} | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  // Filtro lato client (veloce e reattivo)
  useEffect(() => {
    let res = tenants;
    
    // 1. Cerca per nome o slug
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }

    // 2. Filtra per stato
    if (statusFilter === "active") res = res.filter(t => t.is_active);
    if (statusFilter === "suspended") res = res.filter(t => !t.is_active);

    setFilteredTenants(res);
  }, [search, statusFilter, tenants]);

  const loadTenants = () => {
    setLoading(true);
    tenantFetch("/api/superadmin/tenants")
      .then(r => r.ok ? r.json() : { tenants: [] })
      .then(d => {
        setTenants(d.tenants);
        setFilteredTenants(d.tenants);
      })
      .finally(() => setLoading(false));
  };

  const handleImpersonate = async (tenantId: string) => {
    const adminEmail = prompt("Email admin da impersonare:", "admin@example.com");
    if (!adminEmail) return;

    try {
        const res = await tenantFetch(`/api/superadmin/tenants/${tenantId}/impersonate`, {
           method: 'POST', body: JSON.stringify({ email: adminEmail })
        });
        if (res.ok) {
           const data = await res.json();
           window.open(`${data.redirectUrl}?token=${data.token}`, '_blank');
           toast({ title: "Sessione Avviata", description: `Accesso fantasma su ${data.redirectUrl}` });
        } else {
           throw new Error("Errore API");
        }
    } catch {
        toast({ title: "Errore", description: "Impossibile impersonare l'utente.", variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if(!resetModal) return;
    try {
        const res = await tenantFetch(`/api/superadmin/tenants/${resetModal.tenantId}/reset-admin-password`, {
           method: 'POST', body: JSON.stringify({ email: resetModal.email })
        });
        if (res.ok) {
           const data = await res.json();
           setResetModal({ ...resetModal, result: data.tempPassword });
           toast({ title: "Successo", description: "Password rigenerata con successo." });
        }
    } catch {
        toast({ title: "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Clienti & Tenant</h1>
          <p className="text-slate-500 font-medium">Gestione contratti, database e accessi.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={loadTenants} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 
                Aggiorna
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 font-bold">
                <Plus className="mr-2 h-4 w-4" /> Nuovo Tenant
            </Button>
        </div>
      </div>

      {/* Toolbar di Ricerca */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
                placeholder="Cerca azienda, slug o database..." 
                className="pl-9 border-slate-200" 
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
         </div>
         <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select 
                className="h-10 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
            >
                <option value="all">Tutti gli stati</option>
                <option value="active">Solo Attivi</option>
                <option value="suspended">Sospesi</option>
            </select>
         </div>
      </div>

      {/* Tabella Dati */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-100">
               <tr>
                  <th className="px-6 py-4">Azienda</th>
                  <th className="px-6 py-4">Piano</th>
                  <th className="px-6 py-4">Database Schema</th>
                  <th className="px-6 py-4">Stato</th>
                  <th className="px-6 py-4 text-right">Azioni</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {loading ? (
                   <tr><td colSpan={5} className="p-10 text-center text-slate-400">Caricamento in corso...</td></tr>
               ) : filteredTenants.length === 0 ? (
                   <tr><td colSpan={5} className="p-10 text-center text-slate-400">Nessun tenant trovato.</td></tr>
               ) : filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 text-base">{t.name}</div>
                                <div className="text-slate-400 text-xs font-mono">/{t.slug}</div>
                            </div>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 font-bold px-3 py-1">
                           {t.plan_tier || 'STARTER'}
                        </Badge>
                     </td>
                     <td className="px-6 py-4">
                        <div className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                           {t.schema_name}
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        {t.is_active 
                           ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">Active</span>
                           : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Suspended</span>
                        }
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                            <Button 
                                variant="ghost" size="sm" 
                                onClick={() => handleImpersonate(t.id)}
                                className="hidden group-hover:flex h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            >
                                <Eye className="h-4 w-4 mr-2" /> Entra
                            </Button>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Azioni Tenant</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleImpersonate(t.id)}>
                                        <Eye className="mr-2 h-4 w-4" /> Impersona Admin
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setResetModal({ open: true, tenantId: t.id, email: "admin@example.com" })}>
                                        <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600">
                                        Sospendi Tenant
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

      {/* Modale Reset Password (Invariata perché era già corretta) */}
      {resetModal && (
        <Dialog open={resetModal.open} onOpenChange={(v) => !v && setResetModal(null)}>
           <DialogContent className="sm:max-w-md">
              <DialogHeader>
                 <DialogTitle>Reset Password Amministratore</DialogTitle>
                 <DialogDescription>
                    Generazione nuove credenziali per <b>{resetModal.email}</b>.
                 </DialogDescription>
              </DialogHeader>

              {!resetModal.result ? (
                 <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setResetModal(null)}>Annulla</Button>
                    <Button variant="destructive" onClick={handleResetPassword}>Genera Nuova Password</Button>
                 </div>
              ) : (
                 <div className="mt-4 bg-slate-900 text-white p-6 rounded-xl text-center shadow-lg">
                    <div className="text-xs text-slate-400 mb-2 uppercase tracking-widest font-bold">Credenziali</div>
                    <div className="text-3xl font-mono font-black tracking-wider select-all cursor-text text-green-400">
                       {resetModal.result}
                    </div>
                    <div className="text-xs text-slate-500 mt-4">Copia la password ora.</div>
                 </div>
              )}
           </DialogContent>
        </Dialog>
      )}
    </div>
  );
}