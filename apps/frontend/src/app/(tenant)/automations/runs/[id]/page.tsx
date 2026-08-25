import { AutomationRunDetailPage } from "@/components/tenant-automations/automation-run-detail";

export default async function AutomationRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AutomationRunDetailPage runId={id} />;
}
