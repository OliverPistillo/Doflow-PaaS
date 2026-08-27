import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const read = (file) => fs.readFileSync(file, "utf8")
const page = read("apps/frontend/src/app/(tenant)/dashboard/calendario/page.tsx")
const authorizedPages = read("apps/frontend/src/features/identity/authorized-pages.tsx")
const calendar = read("apps/frontend/src/features/commercial/components/commercial-calendar-page.tsx")
const provider = read("apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx")

test("Doflow Calendar uses the source-ported calendar over the authorized workspace", () => {
  assert.match(page, /AuthorizedCalendarPage/)
  assert.match(authorizedPages, /CommercialCalendarPage/)
  assert.doesNotMatch(calendar, /localStorage|sessionStorage|commercial-fixtures/)
  for (const view of ["month", "week", "day", "agenda"]) {
    assert.match(calendar, new RegExp(`value="${view}"`))
  }
  for (const source of ["store.appointments", "store.leadActivities", "store.contracts", "store.quotes", "store.orders", "store.renewals"]) {
    assert.match(calendar, new RegExp(source.replace(".", "\\.")))
  }
})

test("Calendar deadlines come from canonical server projections", () => {
  assert.match(calendar, /orderFinancialsFromServer\(order\)/)
  assert.match(calendar, /project\.dueDate/)
  assert.match(calendar, /contract\.signatureDueAt/)
  assert.match(calendar, /quote\.validUntil/)
  assert.match(calendar, /renewal\.nextDueAt/)
  assert.doesNotMatch(calendar, /calculateOrderFinancials|calculateCommerceEconomics/)
})

test("Calendar mutations stay on the existing Nest authority boundary", () => {
  const mutationBoundary = provider.slice(
    provider.indexOf("addAppointment(appointment)"),
    provider.indexOf("startGuidedCall()"),
  )
  assert.match(mutationBoundary, /commercialApi[\s\S]*\.createActivity/)
  assert.match(mutationBoundary, /commercialApi[\s\S]*\.updateActivity/)
  assert.match(mutationBoundary, /commercialApi[\s\S]*\.archive/)
  assert.match(mutationBoundary, /canEditLead\(identity\.currentUser, lead\)/)
  assert.match(mutationBoundary, /version: appointment\.version/)
  assert.match(mutationBoundary, /\.catch\(\(error\) => \{[\s\S]*setAppointments/)
  assert.doesNotMatch(mutationBoundary, /localStorage|sessionStorage|tenantId\s*:|actorUserId\s*:/)
})
