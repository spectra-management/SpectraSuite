/**
 * Documentos module types.
 *
 * A DocumentTemplate is reusable text (title + body) with `{{variables}}` that get
 * filled per employee from HR data. A GeneratedDocumentRecord logs each PDF produced.
 */

export interface DocumentTemplate {
  id: string
  /** Human name shown in the template list, e.g. "Contrato de Trabajo". */
  name: string
  /** Short description / purpose. */
  description: string
  /** Document title rendered at the top of the PDF (may contain variables). */
  title: string
  /** Body content; paragraphs separated by blank lines; contains `{{variables}}`. */
  body: string
  /** True for the built-in seed templates (cannot be deleted, only duplicated/edited). */
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface GeneratedDocumentRecord {
  id: string
  templateId: string
  templateName: string
  employeeId: string
  employeeName: string
  /** ISO timestamp. */
  generatedAt: string
  /** Email/name of the user who generated it (best-effort). */
  generatedBy: string
}

/** Map of `{{variable}}` key -> resolved string value for one employee. */
export type FilledVariables = Record<string, string>
