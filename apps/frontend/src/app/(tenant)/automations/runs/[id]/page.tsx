import { AutomationRunDetailPage } from "@/components/tenant-automations/automation-run-detail";

export default function AutomationRunPage({ params }: { params: { id: string } }) {
  return <AutomationRunDetailPage runId={params.id} />;
}
