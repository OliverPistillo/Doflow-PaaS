import { KnowledgeTemplateDetailPage } from "@/components/tenant-knowledge/knowledge-template-detail";

export default function KnowledgeTemplateDetailRoute({ params }: { params: { id: string } }) {
  return <KnowledgeTemplateDetailPage templateId={params.id} />;
}
