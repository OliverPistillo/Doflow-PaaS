import { KnowledgeArticleDetailPage } from "@/components/tenant-knowledge/knowledge-article-detail";

export default function KnowledgeArticleDetailRoute({ params }: { params: { id: string } }) {
  return <KnowledgeArticleDetailPage articleId={params.id} />;
}
