"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  knowledgeApi,
  type KnowledgeArticle,
  type KnowledgeArticleLink,
  type KnowledgeArticleVersion,
  type KnowledgeFavorite,
  type KnowledgeTag,
} from "@/lib/tenant-knowledge-api";
import {
  ARTICLE_STATUS_LABELS,
  ARTICLE_TYPE_LABELS,
  PRIORITY_LABELS,
  VISIBILITY_LABELS,
  cleanPayload,
  downloadJson,
  formatDateTime,
  jsonText,
  parseJsonField,
} from "./knowledge-utils";
import { ErrorBox, Header, JsonBlock, Loading, SelectFilter, StatusBadge, itemsOf, normalizeError, useKnowledgeOptions } from "./knowledge-shared";
import { KnowledgeArticleActions } from "./knowledge-article-actions";
import { KnowledgeArticleVersions } from "./knowledge-article-versions";
import { KnowledgeArticleTags } from "./knowledge-article-tags";
import { KnowledgeArticleLinks } from "./knowledge-article-links";

export function KnowledgeArticleDetailPage({ articleId }: { articleId: string }) {
  const options = useKnowledgeOptions();
  const { toast } = useToast();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [versions, setVersions] = useState<KnowledgeArticleVersion[]>([]);
  const [links, setLinks] = useState<KnowledgeArticleLink[]>([]);
  const [tags, setTags] = useState<KnowledgeTag[]>([]);
  const [favorites, setFavorites] = useState<KnowledgeFavorite[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [articleValue, versionsValue, linksValue, tagsValue, favoritesValue] = await Promise.all([
        knowledgeApi.getKnowledgeArticle(articleId),
        knowledgeApi.listArticleVersions(articleId).catch(() => ({ items: [] as KnowledgeArticleVersion[] })),
        knowledgeApi.listArticleLinks(articleId).catch(() => ({ items: [] as KnowledgeArticleLink[] })),
        knowledgeApi.listKnowledgeTags().catch(() => ({ items: [] as KnowledgeTag[] })),
        knowledgeApi.listKnowledgeFavorites().catch(() => ({ items: [] as KnowledgeFavorite[] })),
      ]);
      setArticle(articleValue);
      setForm({
        title: articleValue.title || "",
        excerpt: articleValue.excerpt || "",
        content: articleValue.content || "",
        content_format: articleValue.content_format || "markdown",
        category_id: articleValue.category_id || "",
        article_type: articleValue.article_type || "article",
        status: articleValue.status || "draft",
        visibility: articleValue.visibility || "team",
        priority: articleValue.priority || "medium",
        review_due_at: articleValue.review_due_at || "",
        metadata: jsonText(articleValue.metadata),
        change_summary: "",
      });
      setVersions(itemsOf(versionsValue));
      setLinks(itemsOf(linksValue));
      setTags(itemsOf(tagsValue));
      setFavorites(itemsOf(favoritesValue));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [articleId]);

  const update = async () => {
    try {
      await knowledgeApi.updateKnowledgeArticle(articleId, cleanPayload({
        title: form.title,
        excerpt: form.excerpt,
        content: form.content,
        content_format: form.content_format,
        category_id: form.category_id,
        article_type: form.article_type,
        status: form.status,
        visibility: form.visibility,
        priority: form.priority,
        review_due_at: form.review_due_at,
        metadata: parseJsonField(form.metadata, {}),
        change_summary: form.change_summary,
      }));
      toast({ title: "Articolo aggiornato" });
      await load();
    } catch (err) {
      toast({ title: "Update fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  const quick = async (type: "publish" | "archive" | "review" | "export" | "favorite") => {
    try {
      if (type === "publish") await knowledgeApi.publishKnowledgeArticle(articleId);
      if (type === "archive") await knowledgeApi.archiveKnowledgeArticle(articleId);
      if (type === "review") await knowledgeApi.reviewKnowledgeArticle(articleId);
      if (type === "export") downloadJson(`knowledge-article-${articleId}.json`, await knowledgeApi.exportKnowledgeArticle(articleId));
      if (type === "favorite") await knowledgeApi.createKnowledgeFavorite({ target_type: "article", target_id: articleId });
      if (type !== "export") await load();
    } catch (err) {
      toast({ title: "Azione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!article) return <ErrorBox message="Articolo non trovato." />;
  const favorite = favorites.find((item) => item.target_type === "article" && item.target_id === articleId);

  return (
    <div className="space-y-6">
      <Header title={article.title} description="Dettaglio articolo, versioni, tag, link e preferiti.">
        <KnowledgeArticleActions
          onPublish={() => void quick("publish")}
          onArchive={() => void quick("archive")}
          onReview={() => void quick("review")}
          onExport={() => void quick("export")}
          onFavorite={() => void quick("favorite")}
          favoriteDisabled={Boolean(favorite)}
        />
      </Header>
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={article.status} map={ARTICLE_STATUS_LABELS} />
        <StatusBadge value={article.article_type} map={ARTICLE_TYPE_LABELS} />
        <StatusBadge value={article.priority} map={PRIORITY_LABELS} />
        <StatusBadge value={article.visibility} map={VISIBILITY_LABELS} />
      </div>
      <Card>
        <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{article.excerpt}</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">{article.content}</pre>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div>Categoria: {article.category_name || article.category_id || "-"}</div>
            <div>Owner: {article.owner_user_id || "-"}</div>
            <div>Pubblicato: {formatDateTime(article.published_at)}</div>
            <div>Review due: {formatDateTime(article.review_due_at)}</div>
            <div>Ultima review: {formatDateTime(article.last_reviewed_at)}</div>
          </div>
          <JsonBlock value={article.metadata} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Modifica articolo</CardTitle>
          <CardDescription>Il backend crea una nuova versione se cambiano title, excerpt, content o content_format.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea value={form.excerpt || ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          <Textarea className="min-h-56 font-mono" value={form.content || ""} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div className="grid gap-3 md:grid-cols-4">
            <SelectFilter placeholder="Formato" values={options.content_formats} value={form.content_format} onChange={(v) => setForm({ ...form, content_format: v })} />
            <SelectFilter placeholder="Tipo" values={options.article_types} value={form.article_type} onChange={(v) => setForm({ ...form, article_type: v })} />
            <SelectFilter placeholder="Status" values={["draft", "published", "archived"]} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
            <SelectFilter placeholder="Visibility" values={options.visibilities} value={form.visibility} onChange={(v) => setForm({ ...form, visibility: v })} />
          </div>
          <Input placeholder="Change summary opzionale" value={form.change_summary || ""} onChange={(e) => setForm({ ...form, change_summary: e.target.value })} />
          <Textarea className="font-mono" value={form.metadata || "{}"} onChange={(e) => setForm({ ...form, metadata: e.target.value })} />
          <Button onClick={update}>Salva modifiche</Button>
        </CardContent>
      </Card>
      <KnowledgeArticleVersions versions={versions} />
      <KnowledgeArticleTags articleId={articleId} tags={tags} />
      <KnowledgeArticleLinks articleId={articleId} links={links} options={options} onChanged={() => void load()} />
    </div>
  );
}
