"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, FileText, FolderOpen, LayoutTemplate, Search, Star } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { knowledgeApi, type AssetItem, type KnowledgeArticle, type KnowledgeFavorite, type OperationalTemplate } from "@/lib/tenant-knowledge-api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import { dateLabel, isDueForReview, knowledgeRows, type KnowledgeRow } from "./resources-model";
import { InitialsAvatar, ResourcesEmpty, ResourcesError, ResourcesKpi, ResourcesLoading, ResourcesPageHeader, ResourcesPanel, SoftBadge } from "./resources-ui";

const kindMeta = {
  article: { label: "Articolo", icon: FileText, tone: "violet" as const },
  asset: { label: "Asset", icon: FolderOpen, tone: "blue" as const },
  template: { label: "Template", icon: LayoutTemplate, tone: "green" as const },
};

export function KnowledgeWorkspace() {
  const { canView, canCreate, canUpdate } = useTenantAccess();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]); const [assets, setAssets] = useState<AssetItem[]>([]); const [templates, setTemplates] = useState<OperationalTemplate[]>([]); const [favorites, setFavorites] = useState<KnowledgeFavorite[]>([]); const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState(""); const [category, setCategory] = useState("all"); const [kind, setKind] = useState<"all" | KnowledgeRow["kind"] | "due">("all");
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!canView("knowledge")) { setLoading(false); return; } setLoading(true); setError(null);
    try {
      const [articleData, assetData, templateData, favoriteData, memberData] = await Promise.all([
        knowledgeApi.listKnowledgeArticles({ limit: 100, sortBy: "updated_at", sortOrder: "desc" }),
        knowledgeApi.listKnowledgeAssets({ limit: 100, sortBy: "updated_at", sortOrder: "desc" }),
        knowledgeApi.listOperationalTemplates({ limit: 100, sortBy: "updated_at", sortOrder: "desc" }),
        knowledgeApi.listKnowledgeFavorites({ limit: 100 }),
        canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] as TeamMember[] }),
      ]);
      setArticles(articleData.items || []); setAssets(assetData.items || []); setTemplates(templateData.items || []); setFavorites(favoriteData.items || []); setMembers(memberData.items || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Caricamento della Knowledge non riuscito."); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [canView]);

  const rows = useMemo(() => knowledgeRows(articles, assets, templates), [articles, assets, templates]);
  const favoriteByTarget = useMemo(() => new Map(favorites.map((item) => [`${item.target_type}:${item.target_id}`, item])), [favorites]);
  const memberByUser = useMemo(() => new Map(members.filter((member) => member.user_id).map((member) => [member.user_id!, member])), [members]);
  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).sort(), [rows]);
  const visible = useMemo(() => rows.filter((row) => (kind === "all" || (kind === "due" ? isDueForReview(row) : row.kind === kind)) && (category === "all" || row.category === category) && (!search || `${row.title} ${row.category} ${row.status}`.toLowerCase().includes(search.toLowerCase()))), [rows, kind, category, search]);
  const due = rows.filter(isDueForReview); const used = rows.filter((row) => typeof row.usage === "number" && row.usage > 0).sort((a, b) => Number(b.usage) - Number(a.usage)).slice(0, 5);
  const readyTemplates = templates.filter((item) => item.status === "active" || item.status === "published").length;
  const sharedAssets = assets.filter((item) => item.visibility === "team").length;
  const canFavorite = canCreate("knowledge") || canUpdate("knowledge");

  const toggleFavorite = async (row: KnowledgeRow) => {
    if (!canFavorite) return; const current = favoriteByTarget.get(`${row.kind}:${row.id}`);
    try {
      if (current) await knowledgeApi.deleteKnowledgeFavorite(current.id);
      else await knowledgeApi.createKnowledgeFavorite({ target_type: row.kind, target_id: row.id, title: row.title });
      const result = await knowledgeApi.listKnowledgeFavorites({ limit: 100 }); setFavorites(result.items || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossibile aggiornare i preferiti."); }
  };

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <ResourcesPageHeader title="Knowledge" description="Guide, template e asset operativi in un unico archivio." ctaLabel="Nuova risorsa" ctaHref="/knowledge/articles/new" canCreate={canCreate("knowledge")} />
    <ResourcesError message={error} />
    {loading ? <ResourcesLoading /> : <>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4"><div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca guide, template o asset..." className="pl-9" /></div><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le categorie</SelectItem>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <ResourcesKpi icon={Boxes} label="Risorse totali" value={rows.length} hint={`${articles.length} articoli · ${assets.length} asset · ${templates.length} template`} />
        <ResourcesKpi icon={LayoutTemplate} label="Template pronti" value={readyTemplates} hint="Template con stato attivo o pubblicato" tone="blue" />
        <ResourcesKpi icon={FolderOpen} label="Asset condivisi" value={sharedAssets} hint="Asset con visibilità Team" tone="green" />
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-2">{(["all", "article", "template", "asset", "due"] as const).map((item) => <button key={item} onClick={() => setKind(item)} className={`rounded-xl px-4 py-2 text-sm font-medium ${kind === item ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{item === "all" ? `Tutto (${rows.length})` : item === "due" ? `Da aggiornare (${due.length})` : `${item === "article" ? "Guide" : kindMeta[item].label} (${rows.filter((row) => row.kind === item).length})`}</button>)}</div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Risorsa</th><th className="px-4 py-4">Tipo</th><th className="px-4 py-4">Categoria</th><th className="px-4 py-4">Autore</th><th className="px-4 py-4">Aggiornata</th><th className="px-4 py-4">Utilizzi</th><th className="px-4 py-4">Preferito</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((row) => {
          const meta = kindMeta[row.kind]; const Icon = meta.icon; const owner = row.ownerUserId ? memberByUser.get(row.ownerUserId) : undefined; const favorite = favoriteByTarget.has(`${row.kind}:${row.id}`);
          return <tr key={`${row.kind}:${row.id}`} className="hover:bg-slate-50/70"><td className="px-5 py-4"><Link href={row.href} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></span><div><p className="font-semibold text-slate-900 hover:text-indigo-700">{row.title}</p><SoftBadge value={row.status || "Non definito"} tone={row.status === "published" || row.status === "active" ? "green" : row.status === "draft" ? "slate" : "orange"} /></div></Link></td><td className="px-4 py-4"><SoftBadge value={meta.label} tone={meta.tone} /></td><td className="px-4 py-4 text-slate-600">{row.category}</td><td className="px-4 py-4">{owner ? <div className="flex items-center gap-2"><InitialsAvatar name={owner.display_name} className="h-7 w-7" /><span className="text-slate-700">{owner.display_name}</span></div> : <span className="text-slate-400">—</span>}</td><td className="px-4 py-4 text-slate-600">{dateLabel(row.updatedAt)}</td><td className="px-4 py-4 text-slate-700">{typeof row.usage === "number" ? row.usage : "—"}</td><td className="px-4 py-4"><button disabled={!canFavorite} onClick={() => void toggleFavorite(row)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40" aria-label={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}><Star className={`h-4 w-4 ${favorite ? "fill-amber-400 text-amber-400" : ""}`} /></button></td></tr>;
        })}</tbody></table>{!visible.length ? <ResourcesEmpty className="m-5">Nessuna risorsa corrisponde ai filtri.</ResourcesEmpty> : null}</div></section>
        <div className="space-y-5"><ResourcesPanel title="Più utilizzate" actionHref="/knowledge" actionLabel="Vedi tutte">{used.length ? <div className="space-y-3">{used.map((row, index) => <Link key={`${row.kind}:${row.id}`} href={row.href} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.usage} utilizzi</p></div></Link>)}</div> : <ResourcesEmpty>Nessun conteggio di utilizzo disponibile.</ResourcesEmpty>}</ResourcesPanel>
          <ResourcesPanel title="Da aggiornare" actionHref="/knowledge/articles" actionLabel="Vedi tutte">{due.length ? <div className="space-y-3">{due.slice(0, 5).map((row) => <Link key={row.id} href={row.href} className="block rounded-xl border border-amber-100 bg-amber-50/60 p-3"><p className="truncate text-sm font-semibold text-slate-900">{row.title}</p><p className="mt-1 text-xs text-amber-700">Aggiornato {dateLabel(row.updatedAt)}</p></Link>)}</div> : <ResourcesEmpty>Nessuna revisione scaduta.</ResourcesEmpty>}</ResourcesPanel>
        </div>
      </div>
    </>}
  </main>;
}
