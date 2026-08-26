import type { ListResponse, TeamMember } from "../../lib/tenant-team-api"

const TEAM_MEMBER_PAGE_SIZE = 100
const MAX_TEAM_MEMBER_PAGES = 100

export async function loadAllTeamMembers(
  fetchPage: (params: { limit: number; offset: number }) => Promise<ListResponse<TeamMember>>,
) {
  const byId = new Map<string, TeamMember>()
  let reportedTotal: number | undefined

  for (let pageIndex = 0; pageIndex < MAX_TEAM_MEMBER_PAGES; pageIndex += 1) {
    const page = await fetchPage({
      limit: TEAM_MEMBER_PAGE_SIZE,
      offset: pageIndex * TEAM_MEMBER_PAGE_SIZE,
    })
    const items = page.items || []
    for (const member of items) byId.set(member.id, member)
    if (Number.isFinite(Number(page.total))) reportedTotal = Math.max(0, Number(page.total))

    if (items.length < TEAM_MEMBER_PAGE_SIZE) return Array.from(byId.values())
    if (reportedTotal !== undefined && byId.size >= reportedTotal) return Array.from(byId.values())
  }

  throw new Error("Elenco Team oltre il limite operativo di 10.000 membri.")
}
