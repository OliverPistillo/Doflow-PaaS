// Percorso: apps/frontend/src/app/(tenant)/changelog/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Rocket, ArrowUpCircle, ArrowRightCircle, Wrench, Zap, Tag, Calendar, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, LoadingState, EmptyState } from "@/components/ui/page-shell";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
  const [refreshing, setRefreshing] = useState(false);

  const loadEntries = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await apiFetch<Entry[]>("/tenant/self-service/changelog");
      setEntries(Array.isArray(res) ? res : []);
    } catch {
      // Silently fail — changelog is informational
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEntries(true);
  };

  const headerActions = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-label="Rinfresca novità"
            className="h-9 w-9 focus-visible:ring-2"
          >
            <RefreshCw className={`h-4 w-4 ${(loading || refreshing) ? "animate-spin" : ""}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Aggiorna elenco novità</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          title="Novità della Piattaforma"
          description="Tutte le ultime release e miglioramenti"
          actions={headerActions}
        />
        <LoadingState centered label="Caricamento novità..." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Novità della Piattaforma"
        description="Tutte le ultime release e miglioramenti"
        actions={headerActions}
      />

      <div className="space-y-4 max-w-3xl animate-in fade-in duration-500">
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
          <EmptyState
            title="Nessuna novità al momento"
            message="Non ci sono novità da visualizzare per questa sezione."
            icon={Rocket}
          />
        )}
      </div>
    </PageShell>
  );
}
