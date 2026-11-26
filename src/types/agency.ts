export type NavigationSection =
  | "dashboard"
  | "leads"
  | "outreach"
  | "calls"
  | "clients"
  | "projects"
  | "tasks"
  | "calendar"
  | "finance"
  | "documents"
  | "templates"
  | "analytics"
  | "team"
  | "settings";

export type UserRole = "Admin" | "Manager" | "Team Member";

export interface TeamMember {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  avatarInitials: string;
  phone: string;
  department: string;
  hourlyRate: number;
  status: "Active" | "Invited" | "Away" | "Inactive";
  dailyTargets?: {
    calls: number;
    emails: number;
    dms: number;
    leadsAdded: number;
  };
  isDemo?: boolean;
  legacyId?: string;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  department: string;
  token: string;
  invitedById: string;
  invitedByName: string;
  status: "Pending" | "Accepted" | "Revoked";
  createdAt: string;
  acceptedAt?: string;
}

export type LeadSource =
  | "Google Maps"
  | "Yelp"
  | "Instagram"
  | "Facebook"
  | "LinkedIn"
  | "Referrals"
  | "Website"
  | "Other";

export type LeadStatus =
  | "New"
  | "Qualified"
  | "Contacted"
  | "Replied"
  | "Interested"
  | "Meeting Scheduled"
  | "Proposal Sent"
  | "Converted"
  | "Not Interested"
  | "Lost";

export type PriorityLevel = "Low" | "Medium" | "High" | "Urgent";

export interface LeadNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface LeadHistoryItem {
  id: string;
  action: string;
  actorName: string;
  timestamp: string;
}

export interface Lead {
  id: string;
  businessName: string;
  contactPerson: string;
  industry: string;
  country: string;
  city: string;
  businessEmail: string;
  phoneNumber: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  googleMapsUrl: string;
  leadSource: LeadSource;
  businessDescription: string;
  websiteStatus:
    | "No Website"
    | "Outdated Website"
    | "Slow / Poor UX"
    | "Needs Redesign"
    | "Modern Website";
  rating: number;
  numberOfReviews: number;
  personalizationNotes: string;
  potentialOpportunity: string;
  estimatedProjectValue: number;
  leadPriority: PriorityLevel;
  status: LeadStatus;
  assignedTeamMemberId: string;
  dateAdded: string;
  lastContacted: string;
  nextFollowUpDate: string;
  internalNotes: LeadNote[];
  history: LeadHistoryItem[];
  convertedClientId?: string;
  whatsappOptIn?: boolean;
  whatsappOptInAt?: string;
  instagramHandle?: string;
  isDemo?: boolean;
  legacyId?: string;
}

export type OutreachChannel =
  | "Cold Emails"
  | "Instagram DMs"
  | "WhatsApp Messages"
  | "LinkedIn Messages"
  | "Follow-up Messages";

export type OutreachStatus =
  | "Not Contacted"
  | "Message Sent"
  | "No Reply"
  | "Follow-up Required"
  | "Replied"
  | "Interested"
  | "Demo Shared"
  | "Meeting Booked"
  | "Converted"
  | "Not Interested";

export interface OutreachActivity {
  id: string;
  leadId: string;
  leadName: string;
  campaignId?: string;
  memberId?: string;
  communicationChannel: OutreachChannel;
  messageTemplateUsed: string;
  subject?: string;
  dateSent: string;
  occurredAt?: string;
  messageContent: string;
  direction?: "Outbound" | "Inbound";
  source?: "manual" | "api";
  provider?: "gmail" | "whatsapp_cloud" | "instagram";
  providerMessageId?: string;
  providerThreadId?: string;
  deliveryStatus?: "sent" | "delivered" | "read" | "failed" | "received";
  replyStatus: OutreachStatus;
  replyDate: string;
  nextFollowUpDate: string;
  outcome: string;
  updatedAtMs?: number;
  isDemo?: boolean;
  legacyId?: string;
}

export type CallOutcome =
  | "No Answer"
  | "Busy"
  | "Call Back Later"
  | "Interested"
  | "Not Interested"
  | "Meeting Booked"
  | "Wrong Number"
  | "Converted";

export interface ColdCallRecord {
  id: string;
  leadId: string;
  businessName: string;
  phoneNumber: string;
  callingTeamMemberId: string;
  campaignId?: string;
  callDate: string;
  callTime: string;
  durationSeconds: number | null;
  outcome: CallOutcome;
  connected: boolean;
  notes: string;
  followUpDate: string;
  nextAction: string;
  source: "manual" | "api";
  provider?: "twilio" | "aircall";
  providerCallId?: string;
  recordingConsent?: boolean;
  recordingUrl?: string;
  isDemo?: boolean;
  createdAt: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  targetIndustry: string;
  targetCountry: string;
  targetCity: string;
  assignedTeamMembers: string[];
  startDate: string;
  endDate: string;
  leadIds: string[];
  communicationChannels: string[];
  status: "Draft" | "Active" | "Paused" | "Completed";
  isDemo?: boolean;
  createdAt: string;
}

export interface UnifiedTimelineEvent {
  id: string;
  leadId: string;
  channel:
    | "Cold Email"
    | "Email Reply"
    | "Instagram DM"
    | "WhatsApp"
    | "LinkedIn"
    | "Cold Call"
    | "Follow-up"
    | "Meeting"
    | "Note";
  timestamp: string;
  teamMemberId: string;
  teamMemberName: string;
  summary: string;
  direction: "Outbound" | "Inbound";
  status: string;
  source: "manual" | "api";
  providerMessageId?: string;
  providerThreadId?: string;
  notes?: string;
}

export interface ClientCommunicationItem {
  id: string;
  date: string;
  channel: string;
  summary: string;
  authorName: string;
}

export interface ClientMeetingItem {
  id: string;
  date: string;
  title: string;
  attendees: string;
  notes: string;
}

export interface Client {
  id: string;
  clientName: string;
  businessName: string;
  industry: string;
  contactPerson: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  website: string;
  socialMediaLinks: {
    instagram?: string;
    linkedin?: string;
    facebook?: string;
    twitter?: string;
  };
  clientSince: string;
  servicesPurchased: string[];
  totalProjectValue: number;
  paymentStatus: "Paid" | "Partially Paid" | "Pending" | "Overdue";
  assignedAccountManagerId: string;
  internalNotes: string;
  communicationHistory: ClientCommunicationItem[];
  meetingHistory: ClientMeetingItem[];
  originLeadId?: string;
  isDemo?: boolean;
  legacyId?: string;
}

export type ProjectStage =
  | "Proposal Sent"
  | "Agreement Signed"
  | "Client Onboarding"
  | "Content & Assets Collection"
  | "Website Design"
  | "Website Development"
  | "Internal Review"
  | "Client Review"
  | "Revisions"
  | "Final Approval"
  | "Website Launch"
  | "Completed";

export interface ProjectChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  assignedToId?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  projectName: string;
  clientId: string;
  projectType: string;
  projectDescription: string;
  projectBudget: number;
  startDate: string;
  deadline: string;
  projectStatus: ProjectStage;
  progressPercentage: number;
  assignedTeamMembers: string[];
  websiteDemoUrl: string;
  liveWebsiteUrl: string;
  referenceWebsites: string[];
  internalNotes: string;
  checklist: ProjectChecklistItem[];
  isDemo?: boolean;
  legacyId?: string;
}

export type TaskStatus = "To Do" | "In Progress" | "Under Review" | "Completed";

export interface AgencyTask {
  id: string;
  taskTitle: string;
  description: string;
  relatedClientId: string;
  relatedProjectId: string;
  assignedPersonId: string;
  priority: PriorityLevel;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
  isRecurring: boolean;
  recurrencePattern?: "Daily" | "Weekly" | "Monthly";
  isDemo?: boolean;
  legacyId?: string;
}

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "INR";

export type PaymentStatus =
  | "Unpaid"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Refunded";

export interface PaymentTransaction {
  id: string;
  invoiceId: string;
  amount: number;
  currency: CurrencyCode;
  paidAt: string;
  method: string;
  notes: string;
  recordedById: string;
  isDemo?: boolean;
}

export interface FinanceRecord {
  id: string;
  clientId: string;
  projectId: string;
  amount: number;
  paidAmount: number;
  currency: CurrencyCode;
  transactionType: "Invoice" | "Payment" | "Expense";
  expenseCategory?: string;
  paymentDate: string;
  dueDate: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  invoiceNumber: string;
  notes: string;
  isDemo?: boolean;
  legacyId?: string;
}

export type DocumentCategory =
  | "Proposals"
  | "Agreements"
  | "Invoices"
  | "Onboarding Forms"
  | "Client Content"
  | "Images & Assets"
  | "Brand Guidelines"
  | "Project Deliverables"
  | "Internal Documents";

export interface AgencyDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  category: DocumentCategory;
  folder: string;
  clientId: string;
  projectId: string;
  uploadedById: string;
  createdAt: string;
  isDemo?: boolean;
  legacyId?: string;
}

export type TemplateCategory =
  | "Cold Email Templates"
  | "Instagram DM Templates"
  | "WhatsApp Templates"
  | "Follow-up Templates"
  | "Website Proposals"
  | "Service Agreements"
  | "Client Onboarding Questions"
  | "Project Checklists"
  | "Website Launch Checklists";

export interface AgencyTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  subjectOrHook: string;
  content: string;
  tags: string[];
  usageCount: number;
  updatedAt: string;
  isDemo?: boolean;
  legacyId?: string;
}

export type NotificationType =
  | "New Lead"
  | "Follow-up Due"
  | "New Client"
  | "Project Deadline"
  | "Overdue Task"
  | "Pending Payment"
  | "Project Status Change"
  | "Task Assigned"
  | "Reply Received"
  | "Payment Received"
  | "Integration Error"
  | "Import Completed";

export interface AgencyNotification {
  id: string;
  recipientMemberId?: string;
  type: NotificationType;
  title: string;
  message: string;
  section?: NavigationSection;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  actorId: string;
  actorName: string;
  action:
    | "created"
    | "edited"
    | "completed"
    | "deleted"
    | "converted"
    | "recorded"
    | "imported"
    | "connected"
    | "disconnected"
    | "sent"
    | "received";
  entityType: string;
  entityName: string;
  details: string;
  createdAt: string;
}

export type IntegrationProviderId =
  | "gmail"
  | "google_sheets"
  | "whatsapp"
  | "instagram"
  | "calling"
  | "google_calendar";

export interface IntegrationConnection {
  id: string;
  provider: IntegrationProviderId;
  name: string;
  status: "disconnected" | "connected" | "error";
  accountInfo: {
    email?: string;
    accountName?: string;
    phoneNumber?: string;
    externalId?: string;
    providerType?: "twilio" | "aircall";
  };
  permissionsGranted: string[];
  syncSettings: {
    autoMatchLeads: boolean;
    autoCreateOutreach: boolean;
    webhookEnabled: boolean;
    syncIntervalMinutes: number;
  };
  lastSyncAt: string | null;
  lastSyncError: string | null;
  connectedAt: string | null;
  connectedByName: string | null;
}

export interface ImportJobRecord {
  id: string;
  source: "CSV Upload" | "Google Sheets";
  sourceLabel: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: { row: number; reason: string }[];
  createdByName: string;
  createdAt: string;
}

export interface RolePermissionConfig {
  finance: boolean;
  settings: boolean;
  team: boolean;
  deleteRecords: boolean;
}

export interface AgencySettings {
  agencyName: string;
  tagline: string;
  logoText: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  website: string;
  defaultCurrency: CurrencyCode;
  dateFormat: "MMM DD, YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  themePreference: "light" | "dark";
  includeDemoDataInAnalytics?: boolean;
  notificationPreferences: {
    newLeads: boolean;
    followUpsDue: boolean;
    newClients: boolean;
    projectDeadlines: boolean;
    overdueTasks: boolean;
    pendingPayments: boolean;
    projectStatusChanges: boolean;
  };
  rolePermissions: Record<UserRole, RolePermissionConfig>;
}

export interface AgencyDatabaseState {
  teamMembers: TeamMember[];
  invitations?: TeamInvitation[];
  leads: Lead[];
  outreach: OutreachActivity[];
  coldCalls?: ColdCallRecord[];
  campaigns?: OutreachCampaign[];
  clients: Client[];
  projects: Project[];
  tasks: AgencyTask[];
  finance: FinanceRecord[];
  payments?: PaymentTransaction[];
  documents: AgencyDocument[];
  templates: AgencyTemplate[];
  notifications: AgencyNotification[];
  activityLog: ActivityLogItem[];
  integrations?: IntegrationConnection[];
  importHistory?: ImportJobRecord[];
  settings: AgencySettings;
}
