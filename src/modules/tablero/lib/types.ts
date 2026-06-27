/** Tablero (kanban) domain types. Cards carry their detail (labels/checklist/comments) inline. */

export interface Board {
  id: string
  name: string
  position: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface BoardList {
  id: string
  boardId: string
  name: string
  position: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface CardComment {
  id: string
  author: string
  body: string
  createdAt: string
}

/** Preset label colors (Trello-style). */
export const CARD_LABEL_COLORS = ['emerald', 'blue', 'amber', 'red', 'purple', 'gray'] as const
export type CardLabelColor = (typeof CARD_LABEL_COLORS)[number]

export interface BoardCard {
  id: string
  boardId: string
  listId: string
  title: string
  description: string
  /** Assignee display name (a manager/employee). '' = unassigned. */
  assignee: string
  /** Due date as YYYY-MM-DD. '' = none. */
  dueDate: string
  labels: string[]
  checklist: ChecklistItem[]
  comments: CardComment[]
  position: number
}
