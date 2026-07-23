import type {
  CommercialActivity,
  CommercialCompany,
  CommercialContact,
  CommercialOpportunity,
} from "@/lib/tenant-commercial-api";

export type CommercialClientRow = {
  company: CommercialCompany;
  contact?: CommercialContact;
  opportunities: CommercialOpportunity[];
  activeOpportunity?: CommercialOpportunity;
  lastActivity?: CommercialActivity;
  value: number;
  service?: string;
  needsFollowUp: boolean;
};
