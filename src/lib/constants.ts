import {
  CallOutcome,
  ColdCallRecord,
  CurrencyCode,
  DocumentCategory,
  IntegrationConnection,
  Lead,
  LeadSource,
  LeadStatus,
  OutreachActivity,
  OutreachChannel,
  OutreachStatus,
  PaymentStatus,
  PriorityLevel,
  ProjectChecklistItem,
  ProjectStage,
  TaskStatus,
  TeamMember,
  TemplateCategory,
  UnifiedTimelineEvent,
} from "@/types/agency";

export const LEAD_SOURCES: LeadSource[] = [
  "Google Maps",
  "Yelp",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Referrals",
  "Website",
  "Other",
];

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Qualified",
  "Contacted",
  "Replied",
  "Interested",
  "Meeting Scheduled",
  "Proposal Sent",
  "Converted",
  "Not Interested",
  "Lost",
];

export const PRIORITY_LEVELS: PriorityLevel[] = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export const OUTREACH_CHANNELS: OutreachChannel[] = [
  "Cold Emails",
  "Instagram DMs",
  "WhatsApp Messages",
  "LinkedIn Messages",
  "Follow-up Messages",
];

export const OUTREACH_STATUSES: OutreachStatus[] = [
  "Not Contacted",
  "Message Sent",
  "Replied",
  "Interested",
  "Follow-up Required",
  "Demo Shared",
  "Meeting Booked",
  "Converted",
  "Not Interested",
];

export const CALL_OUTCOMES: CallOutcome[] = [
  "No Answer",
  "Busy",
  "Call Back Later",
  "Interested",
  "Not Interested",
  "Meeting Booked",
  "Wrong Number",
  "Converted",
];

export const CONNECTED_CALL_OUTCOMES = new Set<CallOutcome>([
  "Call Back Later",
  "Interested",
  "Not Interested",
  "Meeting Booked",
  "Converted",
]);

export const POSITIVE_OUTREACH_STATUSES = new Set<OutreachStatus>([
  "Interested",
  "Demo Shared",
  "Meeting Booked",
  "Converted",
]);

export const REPLIED_OUTREACH_STATUSES = new Set<OutreachStatus>([
  "Replied",
  "Interested",
  "Demo Shared",
  "Meeting Booked",
  "Converted",
]);

export const PROJECT_STAGES: ProjectStage[] = [
  "Proposal Sent",
  "Agreement Signed",
  "Client Onboarding",
  "Content & Assets Collection",
  "Website Design",
  "Website Development",
  "Internal Review",
  "Client Review",
  "Revisions",
  "Final Approval",
  "Website Launch",
  "Completed",
];

export const DEFAULT_PROJECT_CHECKLIST_LABELS: string[] = [
  "Proposal prepared",
  "Agreement signed",
  "Onboarding completed",
  "Content received",
  "Images received",
  "Design completed",
  "Development completed",
  "Mobile responsiveness checked",
  "SEO foundation checked",
  "Client review completed",
  "Revisions completed",
  "Final approval received",
  "Website launched",
  "Handover completed",
];

export function createDefaultProjectChecklist(): ProjectChecklistItem[] {
  return DEFAULT_PROJECT_CHECKLIST_LABELS.map((label, idx) => ({
    id: `chk-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    completed: false,
  }));
}

export const TASK_STATUSES: TaskStatus[] = [
  "To Do",
  "In Progress",
  "Under Review",
  "Completed",
];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "Unpaid",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Refunded",
];

export const CURRENCIES: {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rateToUSD: number;
}[] = [
  { code: "USD", symbol: "$", name: "US Dollar", rateToUSD: 1.0 },
  { code: "EUR", symbol: "€", name: "Euro", rateToUSD: 1.08 },
  { code: "GBP", symbol: "£", name: "British Pound", rateToUSD: 1.27 },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", rateToUSD: 0.73 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", rateToUSD: 0.66 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", rateToUSD: 0.012 },
];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "Proposals",
  "Agreements",
  "Invoices",
  "Onboarding Forms",
  "Client Content",
  "Images & Assets",
  "Brand Guidelines",
  "Project Deliverables",
  "Internal Documents",
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Cold Email Templates",
  "Instagram DM Templates",
  "WhatsApp Templates",
  "Follow-up Templates",
  "Website Proposals",
  "Service Agreements",
  "Client Onboarding Questions",
  "Project Checklists",
  "Website Launch Checklists",
];

export const INDUSTRIES: string[] = [
  "SaaS & Technology",
  "FinTech",
  "E-Commerce & Retail",
  "Real Estate & Architecture",
  "Healthcare & Wellness",
  "Hospitality & Dining",
  "Legal & Advisory",
  "Venture Capital",
  "AI & Robotics",
  "Creative & Media",
];

export const AGENCY_SERVICES: string[] = [
  "Brand Identity & Strategy",
  "Custom Website Design (UI/UX)",
  "Next.js Full-Stack Development",
  "Webflow Enterprise Build",
  "E-Commerce & Shopify Plus",
  "Design System Architecture",
  "SEO & Conversion Optimization",
  "Monthly Retainer & Maintenance",
];

export const DEFAULT_INTEGRATIONS: IntegrationConnection[] = [
  {
    id: "int-gmail",
    provider: "gmail",
    name: "Gmail (Google Workspace OAuth 2.0)",
    status: "disconnected",
    accountInfo: {},
    permissionsGranted: [],
    syncSettings: {
      autoMatchLeads: true,
      autoCreateOutreach: true,
      webhookEnabled: true,
      syncIntervalMinutes: 5,
    },
    lastSyncAt: null,
    lastSyncError: null,
    connectedAt: null,
    connectedByName: null,
  },
  {
    id: "int-sheets",
    provider: "google_sheets",
    name: "Google Sheets Lead Importer",
    status: "disconnected",
    accountInfo: {},
    permissionsGranted: [],
    syncSettings: {
      autoMatchLeads: true,
      autoCreateOutreach: false,
      webhookEnabled: false,
      syncIntervalMinutes: 30,
    },
    lastSyncAt: null,
    lastSyncError: null,
    connectedAt: null,
    connectedByName: null,
  },
  {
    id: "int-whatsapp",
    provider: "whatsapp",
    name: "WhatsApp Business Cloud API",
    status: "disconnected",
    accountInfo: {},
    permissionsGranted: [],
    syncSettings: {
      autoMatchLeads: true,
      autoCreateOutreach: true,
      webhookEnabled: true,
      syncIntervalMinutes: 5,
    },
    lastSyncAt: null,
    lastSyncError: null,
    connectedAt: null,
    connectedByName: null,
  },
  {
    id: "int-instagram",
    provider: "instagram",
    name: "Instagram Business (Meta Graph API)",
    status: "disconnected",
    accountInfo: {},
    permissionsGranted: [],
    syncSettings: {
      autoMatchLeads: true,
      autoCreateOutreach: true,
      webhookEnabled: true,
      syncIntervalMinutes: 10,
    },
    lastSyncAt: null,
    lastSyncError: null,
    connectedAt: null,
    connectedByName: null,
  },
  {
    id: "int-calling",
    provider: "calling",
    name: "Phone / Calling Provider (Twilio / Aircall)",
    status: "disconnected",
    accountInfo: {},
    permissionsGranted: [],
    syncSettings: {
      autoMatchLeads: true,
      autoCreateOutreach: true,
      webhookEnabled: true,
      syncIntervalMinutes: 5,
    },
    lastSyncAt: null,
    lastSyncError: null,
    connectedAt: null,
    connectedByName: null,
  },
  {
    id: "int-gcal",
    provider: "google_calendar",
    name: "Google Calendar Sync",
    status: "disconnected",
    accountInfo: {},
    permissionsGranted: [],
    syncSettings: {
      autoMatchLeads: true,
      autoCreateOutreach: false,
      webhookEnabled: true,
      syncIntervalMinutes: 15,
    },
    lastSyncAt: null,
    lastSyncError: null,
    connectedAt: null,
    connectedByName: null,
  },
];

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode = "USD"
): number {
  const fromRate = CURRENCIES.find((c) => c.code === from)?.rateToUSD ?? 1;
  const toRate = CURRENCIES.find((c) => c.code === to)?.rateToUSD ?? 1;
  const inUSD = amount * fromRate;
  return inUSD / toRate;
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "USD",
  compact = false
): string {
  const info = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  if (compact && Math.abs(amount) >= 1000) {
    return `${info.symbol}${(amount / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: info.code,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Builds the Unified Communication Timeline for a lead (Part 10),
 * combining outreach activities, email replies, cold calls, and notes,
 * while deduplicating by providerMessageId so repeated syncs never duplicate events.
 */
export function buildLeadUnifiedTimeline(
  lead: Lead,
  outreach: OutreachActivity[],
  coldCalls: ColdCallRecord[],
  teamMembers: TeamMember[]
): UnifiedTimelineEvent[] {
  const events: UnifiedTimelineEvent[] = [];
  const seenProviderIds = new Set<string>();

  const memberName = (id?: string) =>
    teamMembers.find((m) => m.id === id)?.name || "Team Member";

  // 1. Outreach messages (outbound & inbound)
  for (const o of outreach) {
    if (o.leadId !== lead.id && o.leadName !== lead.businessName) continue;
    if (o.providerMessageId) {
      const dedupeKey = `${o.provider || "msg"}:${o.providerMessageId}`;
      if (seenProviderIds.has(dedupeKey)) continue;
      seenProviderIds.add(dedupeKey);
    }

    const channelMap: Record<
      OutreachChannel,
      UnifiedTimelineEvent["channel"]
    > = {
      "Cold Emails": "Cold Email",
      "Instagram DMs": "Instagram DM",
      "WhatsApp Messages": "WhatsApp",
      "LinkedIn Messages": "LinkedIn",
      "Follow-up Messages": "Follow-up",
    };

    events.push({
      id: `tl-out-${o.id}`,
      leadId: lead.id,
      channel:
        o.direction === "Inbound"
          ? "Email Reply"
          : channelMap[o.communicationChannel] || "Cold Email",
      timestamp: o.occurredAt || `${o.dateSent} 10:00`,
      teamMemberId: o.memberId || lead.assignedTeamMemberId,
      teamMemberName: memberName(o.memberId || lead.assignedTeamMemberId),
      summary: o.subject
        ? `${o.subject} — ${o.messageContent}`
        : o.messageContent,
      direction: o.direction || "Outbound",
      status: o.replyStatus,
      source: o.source || "manual",
      providerMessageId: o.providerMessageId,
      providerThreadId: o.providerThreadId,
      notes: o.outcome,
    });

    // If an outbound activity has a recorded replyDate and no separate Inbound row, surface the reply event
    if (
      o.replyDate &&
      o.direction !== "Inbound" &&
      REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
    ) {
      const replyKey = `reply:${o.id}`;
      if (!seenProviderIds.has(replyKey)) {
        seenProviderIds.add(replyKey);
        events.push({
          id: `tl-reply-${o.id}`,
          leadId: lead.id,
          channel:
            o.communicationChannel === "Cold Emails"
              ? "Email Reply"
              : channelMap[o.communicationChannel],
          timestamp: `${o.replyDate} 14:30`,
          teamMemberId: o.memberId || lead.assignedTeamMemberId,
          teamMemberName: lead.contactPerson || lead.businessName,
          summary:
            o.outcome ||
            `Prospect replied to ${o.communicationChannel} (${o.replyStatus})`,
          direction: "Inbound",
          status: o.replyStatus,
          source: o.source || "manual",
          providerMessageId: o.providerMessageId,
          providerThreadId: o.providerThreadId,
          notes: o.outcome,
        });
      }
    }
  }

  // 2. Cold calls
  for (const c of coldCalls) {
    if (c.leadId !== lead.id && c.businessName !== lead.businessName) continue;
    if (c.providerCallId) {
      const dedupeKey = `${c.provider || "call"}:${c.providerCallId}`;
      if (seenProviderIds.has(dedupeKey)) continue;
      seenProviderIds.add(dedupeKey);
    }

    const durLabel =
      c.durationSeconds != null
        ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s`
        : "duration not recorded";

    events.push({
      id: `tl-call-${c.id}`,
      leadId: lead.id,
      channel: "Cold Call",
      timestamp: `${c.callDate} ${c.callTime}`,
      teamMemberId: c.callingTeamMemberId,
      teamMemberName: memberName(c.callingTeamMemberId),
      summary: `Outbound call (${c.outcome}, ${durLabel}) — ${
        c.notes || c.nextAction || "No notes"
      }`,
      direction: "Outbound",
      status: c.outcome,
      source: c.source,
      providerMessageId: c.providerCallId,
      notes: c.nextAction ? `Next action: ${c.nextAction}` : undefined,
    });
  }

  // 3. Internal notes
  for (const n of lead.internalNotes || []) {
    events.push({
      id: `tl-note-${n.id}`,
      leadId: lead.id,
      channel: "Note",
      timestamp: n.createdAt,
      teamMemberId: n.authorId,
      teamMemberName: n.authorName,
      summary: n.content,
      direction: "Outbound",
      status: "Internal Note",
      source: "manual",
    });
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
