"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type AssetItem, type KnowledgeTag } from "@/lib/tenant-knowledge-api";
import { ASSET_STATUS_LABELS, VISIBILITY_LABELS, downloadJson, formatBytes, jsonText } from "./knowledge-utils";
import { Header, JsonBlock, Loading, StatusBadge, itemsOf, normalizeError, useKnowledgeOptions } from "./knowledge-shared";
import { AssetFormFields, assetPayload } from "./knowledge-asset-form";
import { KnowledgeAssetTags } from "./knowledge-asset-tags";

export function KnowledgeAssetDetailPage({ assetId }: { assetId: string }) {
  const options = useKnowledgeOptions();
  const { toast } = useToast();
  const [asset, setAsset] = useState<AssetItem | null>(null);
  const [tags, setTags] = useState<KnowledgeTag[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = async () => {
    const [assetValue, tagsValue] = await Promise.all([
      knowledgeApi.getKnowledgeAsset(assetId),
      knowledgeApi.listKnowledgeTags().catch(() => ({ items: [] as KnowledgeTag[] })),
    ]);
    setAsset(assetValue);
    setTags(itemsOf(tagsValue));
    setForm({
      name: assetValue.name || "",
      description: assetValue.description || "",
      collection_id: assetValue.collection_id || "",
      document_id: assetValue.document_id || "",
      external_url: assetValue.external_url || "",
      asset_type: assetValue.asset_type || "document",
      status: assetValue.status || "active",
      visibility: assetValue.visibility || "team",
      mime_type: assetValue.mime_type || "",
      file_size_bytes: String(assetValue.file_size_bytes || ""),
      version: assetValue.version || "",
      metadata: jsonText(assetValue.metadata),
    });
  };

  useEffect(() => { void load(); }, [assetId]);

  const update = async () => {
    try {
      await knowledgeApi.updateKnowledgeAsset(assetId, assetPayload(form));
      await load();
    } catch (err) {
      toast({ title: "Update fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (!asset) return <Loading />;

  return (
    <div className="space-y-6">
      <Header title={asset.name} description="Dettaglio asset, metadati e tag.">
        <Button asChild variant="outline"><Link href="/knowledge/assets">Torna lista</Link></Button>
        <Button variant="outline" onClick={() => knowledgeApi.archiveKnowledgeAsset(assetId).then(load)}>Archive</Button>
        <Button variant="outline" onClick={() => knowledgeApi.exportKnowledgeAsset(assetId).then((data) => downloadJson(`knowledge-asset-${assetId}.json`, data))}>Export</Button>
      </Header>
      <div className="flex gap-2"><StatusBadge value={asset.status} map={ASSET_STATUS_LABELS} /><StatusBadge value={asset.visibility} map={VISIBILITY_LABELS} /></div>
      <Card>
        <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>{asset.description}</div>
          <div>Collection: {asset.collection_name || asset.collection_id || "-"}</div>
          <div>Document ID: {asset.document_id || "-"}</div>
          <div>URL: {asset.external_url ? <a className="text-primary underline" href={asset.external_url} target="_blank" rel="noreferrer">{asset.external_url}</a> : "-"}</div>
          <div>MIME: {asset.mime_type || "-"} · Size: {formatBytes(asset.file_size_bytes)} · Versione: {asset.version || "-"}</div>
          <JsonBlock value={asset.metadata} />
        </CardContent>
      </Card>
      <AssetFormFields form={form} setForm={setForm} options={options} onSubmit={update} submitLabel="Salva asset" />
      <KnowledgeAssetTags assetId={assetId} tags={tags} />
    </div>
  );
}
