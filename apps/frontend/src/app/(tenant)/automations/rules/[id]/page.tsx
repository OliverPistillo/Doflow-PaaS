import { AutomationRuleDetailPage } from "@/components/tenant-automations/automation-rule-detail";

export default function AutomationRulePage({ params }: { params: { id: string } }) {
  return <AutomationRuleDetailPage ruleId={params.id} />;
}
