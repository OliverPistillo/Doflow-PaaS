import { KnowledgeAssetDetailPage } from "@/components/tenant-knowledge/knowledge-asset-detail";

export default function KnowledgeAssetDetailRoute({ params }: { params: { id: string } }) {
  return <KnowledgeAssetDetailPage assetId={params.id} />;
}
