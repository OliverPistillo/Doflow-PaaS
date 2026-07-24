import { apiFetch } from "@/lib/api";

export type CommercialList<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CommercialCompany = {
  id: string;
  name: string;
  legal_name?: string | null;
  vat_number?: string | null;
  fiscal_code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  status?: string | null;
  source?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CommercialContact = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  first_name: string;
  last_name?: string | null;
  role_title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CommercialLead = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  title: string;
  status?: string | null;
  budget_estimate?: number | string | null;
  urgency?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CommercialOpportunity = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  title: string;
  service_type?: string | null;
  value_estimate?: number | string | null;
  probability?: number | null;
  stage: string;
  expected_close_date?: string | null;
  assigned_to?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  urgency?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CommercialActivity = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  opportunity_title?: string | null;
  type: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  assigned_to?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CommercialPipelineStage = {
  stage: string;
  label: string;
  count: number;
  totalValue: number;
  items: CommercialOpportunity[];
};

export type CommercialPipeline = {
  stages: CommercialPipelineStage[];
};

export type CommercialQuote = {
  id: string;
  quote_number?: string | null;
  title: string;
  status: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  opportunity_title?: string | null;
  subtotal?: number | string | null;
  discount_total?: number | string | null;
  tax_total?: number | string | null;
  total?: number | string | null;
  valid_until?: string | null;
  accepted_at?: string | null;
  sent_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type QueryValue = string | number | boolean | null | undefined;

function queryString(query: Record<string, QueryValue> = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const commercialApi = {
  companies(query: Record<string, QueryValue> = {}) {
    return apiFetch<CommercialList<CommercialCompany>>(`/tenant/crm/companies${queryString(query)}`);
  },
  contacts(query: Record<string, QueryValue> = {}) {
    return apiFetch<CommercialList<CommercialContact>>(`/tenant/crm/contacts${queryString(query)}`);
  },
  leads(query: Record<string, QueryValue> = {}) {
    return apiFetch<CommercialList<CommercialLead>>(`/tenant/crm/leads${queryString(query)}`);
  },
  opportunities(query: Record<string, QueryValue> = {}) {
    return apiFetch<CommercialList<CommercialOpportunity>>(`/tenant/crm/opportunities${queryString(query)}`);
  },
  activities(query: Record<string, QueryValue> = {}) {
    return apiFetch<CommercialList<CommercialActivity>>(`/tenant/crm/activities${queryString(query)}`);
  },
  pipeline() {
    return apiFetch<CommercialPipeline>("/tenant/crm/pipeline");
  },
  quotes(query: Record<string, QueryValue> = {}) {
    return apiFetch<CommercialList<CommercialQuote>>(`/tenant/quotes${queryString(query)}`);
  },
  createCompany(payload: Partial<CommercialCompany>) {
    return apiFetch<CommercialCompany>("/tenant/crm/companies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateCompany(id: string, payload: Partial<CommercialCompany>) {
    return apiFetch<CommercialCompany>(`/tenant/crm/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteCompany(id: string) {
    return apiFetch<{ success: boolean }>(`/tenant/crm/companies/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  moveOpportunity(id: string, stage: string) {
    return apiFetch<CommercialOpportunity>(`/tenant/crm/opportunities/${encodeURIComponent(id)}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
  },
};
