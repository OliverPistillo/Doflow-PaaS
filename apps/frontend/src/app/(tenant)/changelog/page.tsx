// Percorso: apps/frontend/src/app/(tenant)/changelog/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import {
  Loader2, Rocket, ArrowUpCircle, ArrowRightCircle, Wrench, Zap, Tag, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type Entry = {
  id: string; version: string; title: string; content: string;
  type: string; tags: string[]; publishedAt: string; author: string | null;
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  MAJOR:  { label: "Major",  icon: ArrowUpCircle,    color: "hsl(0 70% 55%)" },
  MINOR:  { label: "Minor",  icon: ArrowRightCircle, color: "hsl(210 70% 55%)" },
  PATCH:  { label: "Patch",  icon: Wrench,           color: "hsl(150 60% 45%)" },
  HOTFIX: { label: "Hotfix", icon: Zap,              color: "hsl(40 80% 55%)" },
};

export default function TenantChangelogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<Entry[]>("/tenant/self-service/changelog");
        setEntries(Array.isArray(res) ? res : []);
      } catch {
        // Silently fail — changelog is informational
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm animate-pulse">Caricamento novità...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Rocket className="h-6 w-6 text-primary" />Novità della Piattaforma</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Tutte le ultime release e miglioramenti</p>
      </div>

      <div className="space-y-4 max-w-3xl">
        {entries.map(entry => {
          const tc = TYPE_CONFIG[entry.type] || TYPE_CONFIG.MINOR;
          const IconComp = tc.icon;
          return (
            <Card key={entry.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color }}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-xs font-mono font-bold" style={{ backgroundColor: `color-mix(in srgb, ${tc.color} 15%, transparent)`, color: tc.color, border: `1px solid color-mix(in srgb, ${tc.color} 25%, transparent)` }}>v{entry.version}</Badge>
                      <h3 className="font-bold text-foreground">{entry.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{tc.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{entry.content}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {(entry.tags || []).map(tag => <Badge key={tag} variant="outline" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-1" />{tag}</Badge>)}
                      <span className="text-[11px] text-muted-foreground/60 ml-auto flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(entry.publishedAt).toLocaleDateString("it-IT")}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {entries.length === 0 && (
          <div className="text-center py-16 text-muted-foreground"><Rocket className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">Nessuna novità al momento</p></div>
        )}
      </div>
    </div>
  );
}
