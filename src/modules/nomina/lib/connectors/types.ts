// Flat representation used internally after normalisation from raw API response
export interface HubstaffMember {
  id: number
  name: string
  email: string
  status: string
}

// Actual shape returned by GET /v2/organizations/{id}/members
// Each element nests the user under a `user` key, not at the top level
export interface HubstaffMemberRaw {
  user_id: number
  user: {
    id: number
    name: string
    email: string
    status?: string
  }
}

// User record embedded in the daily_activities response
export interface HubstaffActivityUser {
  id: number
  name: string
  email: string
}

export interface HubstaffDailyActivity {
  user_id: number
  date: string
  tracked: number
}

export interface HubstaffActivitiesResponse {
  daily_activities: HubstaffDailyActivity[]
  users?: HubstaffActivityUser[]
  pagination?: { page: number; page_size: number; total: number }
}

export interface HubstaffMembersResponse {
  members: HubstaffMemberRaw[]
}

export interface BambooEmployee {
  id: string
  firstName: string
  lastName: string
  workEmail: string
  payRate: string
  payType: string
  jobTitle: string
  department: string
  hireDate: string
  status: string
}

export interface BambooDirectoryResponse {
  fields: Array<{ id: string; type: string; name: string }>
  employees: BambooEmployee[]
}

export interface WeeklyHours {
  weekStart: string
  regular: number
  ot: number
}
