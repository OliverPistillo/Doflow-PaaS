import { AutomationRuleDetailPage } from "@/components/tenant-automations/automation-rule-detail";

export default async function AutomationRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AutomationRuleDetailPage ruleId={id} />;
}
