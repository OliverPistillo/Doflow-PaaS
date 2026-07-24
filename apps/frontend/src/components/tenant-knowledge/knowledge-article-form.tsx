"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi } from "@/lib/tenant-knowledge-api";
import { cleanPayload, parseJsonField } from "./knowledge-utils";
import { Header, SelectFilter, normalizeError, useKnowledgeOptions } from "./knowledge-shared";

export function KnowledgeArticleFormPage() {
  const options = useKnowledgeOptions();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({
    content_format: "markdown",
    article_type: "article",
    status: "draft",
    visibility: "team",
    priority: "medium",
    metadata: "{}",
  });

  const submit = async () => {
    try {
      const article = await knowledgeApi.createKnowledgeArticle(cleanPayload({
        category_id: form.category_id,
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content || "",
        content_format: form.content_format,
        article_type: form.article_type,
        status: form.status,
        visibility: form.visibility,
        priority: form.priority,
        review_due_at: form.review_due_at,
        metadata: parseJsonField(form.metadata, {}),
      }));
      router.push(`/knowledge/articles/${article.id}`);
    } catch (err) {
      toast({ title: "Creazione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Header title="Nuovo articolo" description="Crea una procedura o un contenuto interno senza dati finti.">
        <Button asChild variant="outline"><Link href="/knowledge/articles">Torna lista</Link></Button>
      </Header>
      <Card><CardContent className="grid gap-4 pt-6">
        <Input placeholder="Titolo" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input placeholder="Slug" value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <Input placeholder="Category ID opzionale" value={form.category_id || ""} onChange={(e) => setForm({ ...form, category_id: e.target.value })} />
        <Textarea placeholder="Excerpt" value={form.excerpt || ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
        <Textarea className="min-h-56 font-mono" placeholder="Contenuto markdown/testo" value={form.content || ""} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <div className="grid gap-3 md:grid-cols-4">
          <SelectFilter placeholder="Formato" values={options.content_formats} value={form.content_format} onChange={(v) => setForm({ ...form, content_format: v })} />
          <SelectFilter placeholder="Tipo" values={options.article_types} value={form.article_type} onChange={(v) => setForm({ ...form, article_type: v })} />
          <SelectFilter placeholder="Status" values={["draft", "published", "archived"]} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
          <SelectFilter placeholder="Visibility" values={options.visibilities} value={form.visibility} onChange={(v) => setForm({ ...form, visibility: v })} />
          <SelectFilter placeholder="Priorità" values={options.priorities} value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} />
          <Input type="datetime-local" value={form.review_due_at || ""} onChange={(e) => setForm({ ...form, review_due_at: e.target.value })} />
        </div>
        <Label>Metadata JSON</Label>
        <Textarea className="font-mono" value={form.metadata || "{}"} onChange={(e) => setForm({ ...form, metadata: e.target.value })} />
        <Button onClick={submit}>Crea articolo</Button>
      </CardContent></Card>
    </div>
  );
}
