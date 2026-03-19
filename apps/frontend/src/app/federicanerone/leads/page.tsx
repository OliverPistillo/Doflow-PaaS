'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Facebook, Phone, Mail, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Lead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  source: string;
};

export default function FacebookLeadsPage() {
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const loadLeads = React.useCallback(async () => {
    setLoading(true);
    try {
      // Usiamo l'endpoint clienti filtrando per source (dovrai aggiornare clienti.service per supportare il filtro source se non lo fa)
      // O per ora carichiamo tutto e filtriamo lato client per semplicità
      const res = await apiFetch<{ clienti: any[] }>('/clienti');
      const fbLeads = (res.clienti || []).filter((c: any) => c.source === 'facebook_ads');
      setLeads(fbLeads);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const filtered = leads.filter(l => l.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-transparent space-y-8 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <Facebook className="h-8 w-8 text-blue-600" /> Lead Facebook
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Contatti importati automaticamente dalle campagne pubblicitarie.
          </p>
        </div>
        <Button onClick={loadLeads} variant="outline" size="sm">
          Aggiorna
        </Button>
      </div>

      {/* STATS RAPIDE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Totale Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{leads.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* LISTA LEAD */}
      <div className="space-y-4">
        <div className="relative max-w-sm">
           <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
           <Input 
             placeholder="Cerca lead..." 
             className="pl-9" 
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
        </div>

        <div className="grid grid-cols-1 gap-3">
          {filtered.map(lead => (
            <div key={lead.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  {lead.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-lg">{lead.full_name}</div>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email || 'No Email'}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone || 'No Tel'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 sm:mt-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground">Data Acquisizione</div>
                  <div className="text-sm font-medium">{new Date(lead.created_at).toLocaleDateString()}</div>
                </div>
                
                <Button size="sm" className="bg-pink-200 text-blue-900 hover:bg-pink-300 border-0">
                  <UserPlus className="mr-2 h-4 w-4" /> Gestisci
                </Button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              Nessun lead trovato dalle campagne.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}