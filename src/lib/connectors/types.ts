export interface HubstaffMember {
  id: number
  name: string
  email: string
  status: string
}

export interface HubstaffDailyActivity {
  user_id: number
  date: string
  tracked: number
}

export interface HubstaffActivitiesResponse {
  daily_activities: HubstaffDailyActivity[]
  pagination?: { page: number; page_size: number; total: number }
}

export interface HubstaffMembersResponse {
  members: HubstaffMember[]
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
