export type ProspectStatus =
  | "Imported"
  | "Pending Research"
  | "Researching"
  | "Ready for Outreach"
  | "Outreach Pending Approval"
  | "Contacted"
  | "Follow-up Required"
  | "Replied"
  | "Interested"
  | "Call Booked"
  | "Not Interested"
  | "Converted"
  | "Do Not Contact";

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "Imported",
  "Pending Research",
  "Researching",
  "Ready for Outreach",
  "Outreach Pending Approval",
  "Contacted",
  "Follow-up Required",
  "Replied",
  "Interested",
  "Call Booked",
  "Not Interested",
  "Converted",
  "Do Not Contact",
];

export type EnrichmentStatus =
  | "not_configured"
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

export type ResearchStatus =
  | "not_started"
  | "not_configured"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed";

export type OutreachState =
  | "not_started"
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "replied"
  | "suppressed";

export type QualificationStatus =
  | "unqualified"
  | "interested"
  | "not_interested"
  | "converted";

export interface ProspectInput {
  businessName: string;
  contactPerson: string;
  website: string;
  email: string;
  phone: string;
  instagram: string;
  linkedinUrl: string;
  category: string;
  location: string;
  country: string;
  notes: string;
  source: string;
}

export interface Prospect extends ProspectInput {
  id: string;
  workspaceId: string;
  websiteDomain: string;
  importId?: string;
  status: ProspectStatus;
  enrichmentStatus: EnrichmentStatus;
  researchStatus: ResearchStatus;
  outreachStatus: OutreachState;
  qualificationStatus: QualificationStatus;
  campaignId: string | null;
  crmLeadId: string | null;
  validationWarnings: string[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
  updatedAtMs: number;
}

export type ImportRowOutcome =
  | "imported"
  | "updated"
  | "skipped_duplicate"
  | "skipped_excluded"
  | "failed";

export interface ProspectImportRowResult {
  rowNumber: number;
  outcome: ImportRowOutcome;
  reason?: string;
  prospectId?: string;
}

export interface ProspectImport {
  id: string;
  workspaceId: string;
  idempotencyKey: string;
  fileName: string;
  fileType: "csv" | "xlsx" | "xls";
  fileSize: number;
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  status: "processing" | "completed" | "completed_with_errors" | "failed";
  duplicateStrategy: "skip" | "update";
  columnMapping: Record<string, string>;
  rowResults: ProspectImportRowResult[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
  updatedAtMs: number;
}

export interface ProspectingCapabilities {
  storage: "local_file" | "ephemeral_serverless";
  supabaseConfigured: boolean;
  gemini: boolean;
  n8n: boolean;
  gmail: boolean;
  googleCalendar: boolean;
  enrichmentProviders: string[];
  maxImportRows: number;
  maxFileBytes: number;
}

export interface DuplicateMatchInfo {
  type: "file" | "prospect" | "crm_lead";
  id?: string;
  label: string;
}

export interface DuplicateCheckResultItem {
  rowIndex: number;
  duplicateOf: DuplicateMatchInfo | null;
}

export interface SendToCrmItemResult {
  prospectId: string;
  outcome: "created" | "linked_existing" | "already_linked" | "not_found" | "error";
  crmLeadId?: string;
  label?: string;
  reason?: string;
}

export type ProspectingSectionTab =
  | "overview"
  | "upload"
  | "database"
  | "campaigns"
  | "research"
  | "outreach"
  | "followups"
  | "interested"
  | "calls"
  | "history"
  | "integrations"
  | "settings";
