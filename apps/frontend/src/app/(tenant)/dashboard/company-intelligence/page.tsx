import { CompanyIntelligencePage } from "@/features/company-intelligence/company-intelligence-page"
import { CompanyIntelligenceReportToolsFromRoute } from "@/features/company-intelligence/company-intelligence-report-tools"

export default function Page() {
  return <div className="w-full [&>div]:mx-0 [&>div]:max-w-none [&>main]:mx-0 [&>main]:max-w-none"><CompanyIntelligencePage/><CompanyIntelligenceReportToolsFromRoute/></div>
}
