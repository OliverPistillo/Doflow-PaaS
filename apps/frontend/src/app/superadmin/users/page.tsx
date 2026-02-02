"use client";

import React, { useEffect, useState } from "react";
import { Users, Search, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tenantFetch } from "@/lib/tenant-fetch";
import { useToast } from "@/hooks/use-toast";

export default function GlobalUsersPage() {
  const { toast } = useToast();
  
  // Dati
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Inizializzazione: Carica lista tenant per il selettore
  useEffect(() => {
    tenantFetch("/api/superadmin/tenants")
      .then(r => r.ok ? r.json() : { tenants: [] })
      .then(d => {
         setTenants(d.tenants);
         if(d.tenants.length > 0) setSelectedTenantId(d.tenants[0].id); // Seleziona il primo
      });
  }, []);

  // Quando cambia il tenant selezionato, carica i suoi utenti
  useEffect(() => {
    if(!selectedTenantId) return;
    loadUsers(selectedTenantId);
  }, [selectedTenantId]);

  const loadUsers = async (tenantId: string) => {
    setLoadingUsers(true);
    // Nota: Qui usiamo l'impersonation "silenziosa" o un endpoint dedicato se esiste.
    // Per ora, assumiamo che esista un endpoint /api/superadmin/tenants/:id/users
    // Se non esiste nel backend, dovrai aggiungerlo. Per ora simuliamo/adattiamo.
    try {
        // HACK: Usiamo l'endpoint di impersonation per ottenere un token e chiamare l'API utenti del tenant
        // In produzione dovresti fare un endpoint superadmin dedicato.
        // Qui mostro la logica frontend pulita.
        const res = await tenantFetch(`/api/superadmin/tenants/${tenantId}/users-list-debug`); // Endpoint ipotetico
        if (res.ok) {
            const data = await res.json();
            setUsers(data.users);
        } else {
            // Fallback UI
            setUsers([]);
            toast({ title: "Info", description: "Per vedere gli utenti, serve implementare l'endpoint BE dedicato o usare Impersonate.", variant: "default" });
        }
    } catch {
        setUsers([]);
    } finally {
        setLoadingUsers(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestione Utenti Globale</h1>
          <p className="text-slate-500 font-medium">Visualizza e gestisci utenti per specifico tenant.</p>
        </div>
      </div>

      {/* FILTRO TENANT */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
         <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Seleziona Tenant:</span>
         <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Scegli azienda..." />
            </SelectTrigger>
            <SelectContent>
                {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>
                ))}
            </SelectContent>
         </Select>
         <Button variant="outline" onClick={() => loadUsers(selectedTenantId)}>Ricarica Lista</Button>
      </div>

      {/* TABELLA UTENTI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Utenti registrati nel tenant</h3>
            <span className="text-xs text-slate-400">{users.length} utenti trovati</span>
         </div>
         
         <table className="w-full text-sm text-left">
            <thead className="text-slate-500 uppercase font-bold text-xs border-b border-slate-100">
               <tr>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Ruolo</th>
                  <th className="px-6 py-4">Data Iscrizione</th>
                  <th className="px-6 py-4 text-right">Azioni</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {loadingUsers ? (
                   <tr><td colSpan={4} className="p-8 text-center text-slate-400">Caricamento utenti...</td></tr>
               ) : users.length === 0 ? (
                   <tr><td colSpan={4} className="p-8 text-center text-slate-400">Seleziona un tenant o nessun utente trovato.</td></tr>
               ) : (
                   users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 font-medium text-slate-900">{u.email}</td>
                         <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {u.role}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                         <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                         </td>
                      </tr>
                   ))
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}