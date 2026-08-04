import { Badge } from "@/components/ui/badge";
import type { PersonalizationStatus } from "@/lib/tenant-site-proposals-api";
const labels:Record<PersonalizationStatus,string>={idle:"Preparazione incompleta",running:"Preparazione in corso",completed:"Pronta con AI",fallback:"Pronta localmente",failed:"Preparazione fallita"};
export function SiteProposalPersonalizationStatus({status}:{status?:PersonalizationStatus|null}){const value=status||"idle";return <Badge className={value==="failed"?"bg-rose-100 text-rose-700":value==="fallback"?"bg-indigo-100 text-indigo-700":value==="completed"?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-600"}>{labels[value]}</Badge>}
