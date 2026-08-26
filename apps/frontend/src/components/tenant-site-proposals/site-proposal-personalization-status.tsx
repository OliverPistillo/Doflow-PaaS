import { Badge } from "@/components/ui/badge";
import type { PersonalizationStatus } from "@/lib/tenant-site-proposals-api";
const labels:Record<PersonalizationStatus,string>={idle:"Preparazione incompleta",running:"Preparazione in corso",completed:"Pronta con AI",fallback:"Pronta localmente",failed:"Preparazione fallita"};
export function SiteProposalPersonalizationStatus({status}:{status?:PersonalizationStatus|null}){const value=status||"idle";return <Badge className={value==="failed"?"bg-rose-100 text-rose-700":value==="fallback"?"bg-primary/10 text-primary":value==="completed"?"bg-emerald-100 text-emerald-700":"bg-muted text-muted-foreground"}>{labels[value]}</Badge>}
