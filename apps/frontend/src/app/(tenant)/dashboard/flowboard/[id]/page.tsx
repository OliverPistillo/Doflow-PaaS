import { FlowboardEditor } from "@/components/tenant-flowboard/flowboard-editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FlowboardEditor boardId={id} />;
}
