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

export type ProspectingChannelId =
  | "email"
  | "whatsapp"
  | "instagram"
  | "linkedin";

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
  researchSummary?: string;
  opportunityNote?: string;
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
  whatsapp: boolean;
  instagram: boolean;
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
  outcome:
    | "created"
    | "linked_existing"
    | "already_linked"
    | "not_found"
    | "error";
  crmLeadId?: string;
  label?: string;
  reason?: string;
}

export interface ConversationProgressMetrics {
  prospectsImported: number;
  prospectsResearched: number;
  contactDetailsFound: number;
  emailsPrepared: number;
  emailsAwaitingApproval: number;
}

export interface CampaignDraftMessage {
  prospectId: string;
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  instagram: string;
  website: string;
  category: string;
  location: string;
  channel: ProspectingChannelId;
  subject: string;
  body: string;
  researchNote: string;
  suppressed: boolean;
  suppressionReason?: string;
}

export interface CampaignApprovalPayload {
  id: string;
  title: string;
  goalSummary: string;
  targetFilterSummary: string;
  selectedChannels: ProspectingChannelId[];
  followUpSchedule: string;
  totalSelected: number;
  availableEmails: number;
  availablePhones: number;
  availableInstagrams: number;
  suppressedCount: number;
  status: "pending_approval" | "approved_executed" | "cancelled";
  drafts: CampaignDraftMessage[];
  executionSummary?: {
    executedAt: string;
    sentViaApiCount: number;
    savedOutreachCount: number;
    syncedToCrmCount: number;
    n8nTriggered: boolean;
    providerNote: string;
  };
}

export interface ProspectingStatusStep {
  label: string;
  state: "done" | "active" | "pending" | "warning";
  detail?: string;
}

export interface AttachedSheetSummary {
  fileName: string;
  fileType: "csv" | "xlsx" | "xls";
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface ProspectingChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachedFiles?: AttachedSheetSummary[];
  selectedChannels?: ProspectingChannelId[];
  statusSteps?: ProspectingStatusStep[];
  progressMetrics?: ConversationProgressMetrics;
  campaignApproval?: CampaignApprovalPayload;
  referencedProspectIds?: string[];
}

export interface ProspectingConversation {
  id: string;
  workspaceId: string;
  title: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  updatedAtMs: number;
  messages: ProspectingChatMessage[];
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
