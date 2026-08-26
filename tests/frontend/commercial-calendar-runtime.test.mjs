import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const read = (file) => fs.readFileSync(file, "utf8")
const page = read("apps/frontend/src/app/(tenant)/dashboard/calendario/page.tsx")
const calendar = read("apps/frontend/src/features/commercial/components/commercial-calendar-page.tsx")
const api = read("apps/frontend/src/lib/tenant-calendar-api.ts")

test("Doflow Calendar uses the dedicated server-backed operational calendar", () => {
  assert.match(page, /CommercialCalendarPage/)
  assert.match(calendar, /data-calendar-source="server"/)
  assert.doesNotMatch(calendar, /localStorage|sessionStorage|commercial-fixtures/)
  for (const view of ["month", "week", "day", "agenda"]) {
    assert.match(calendar, new RegExp(`value="${view}"`))
  }
})

test("Calendar filters categories and reads deadlines from Nest", () => {
  for (const category of ["operations", "projects", "commercial", "administration", "documents"]) {
    assert.match(calendar, new RegExp(`id: "${category}"`))
  }
  assert.match(calendar, /calendarApi\.listCalendarEvents/)
  assert.match(calendar, /calendarApi\.getCalendarDeadlines/)
  assert.match(calendar, /include_cancelled: true/)
  assert.match(api, /\/tenant\/calendar\/events/)
  assert.match(api, /\/tenant\/calendar\/deadlines/)
})

test("Calendar mutations stay on the existing Nest authority boundary", () => {
  for (const call of [
    "createCalendarEvent",
    "updateCalendarEvent",
    "completeCalendarEvent",
    "deleteCalendarEvent",
  ]) assert.match(calendar, new RegExp(`calendarApi\\.${call}`))
  assert.match(calendar, /source_type === "manual"/)
  assert.match(calendar, /!event\.is_system_generated/)
  assert.match(calendar, /!event\.is_locked/)
  assert.match(calendar, /identità e tenant non provengono dal form/i)
  const mutationBoundary = calendar.slice(
    calendar.indexOf("const saveEditor"),
    calendar.indexOf("const renderDayColumn"),
  )
  assert.doesNotMatch(mutationBoundary, /tenantId\s*:|tenant_id\s*:|actorUserId\s*:|actor_user_id\s*:/)
})
