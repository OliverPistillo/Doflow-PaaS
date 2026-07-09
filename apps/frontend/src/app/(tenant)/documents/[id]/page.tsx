import { DocumentDetailPage } from "@/components/tenant-documents/document-detail";

export default function DocumentDetailRoute({ params }: { params: { id: string } }) {
  return <DocumentDetailPage documentId={params.id} />;
}
