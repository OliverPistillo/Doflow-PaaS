"use client"

import { useMemo } from "react"

import { getCanonicalCustomerActivities, useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { canViewActivity, canViewCustomer, canViewLead, canViewProject } from "@/features/identity/permissions"

export function useAuthorizedCommercial() {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const scope = useMemo(() => ({ leads: store.leads, customers: store.customers, projects: store.projects }), [store.customers, store.leads, store.projects])
  const leads = useMemo(() => store.leads.filter((lead) => canViewLead(identity.currentUser, lead)), [identity.currentUser, store.leads])
  const customers = useMemo(() => store.customers.filter((customer) => canViewCustomer(identity.currentUser, customer, scope)), [identity.currentUser, scope, store.customers])
  const projects = useMemo(() => store.projects.filter((project) => canViewProject(identity.currentUser, project, scope)), [identity.currentUser, scope, store.projects])
  const activities = useMemo(() => customers.flatMap((customer) => getCanonicalCustomerActivities(customer).filter((activity) => canViewActivity(identity.currentUser, activity, customer, scope)).map((activity) => ({ activity, customer }))), [customers, identity.currentUser, scope])
  return { store, identity, scope, leads, customers, projects, activities }
}
