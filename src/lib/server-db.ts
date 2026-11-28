import fs from "fs";
import os from "os";
import path from "path";
import {
  ActivityLogItem,
  AgencyDatabaseState,
  AgencyNotification,
  Client,
  FinanceRecord,
  IntegrationProviderId,
  Lead,
  PaymentTransaction,
  Project,
  TeamMember,
} from "@/types/agency";
import { INITIAL_AGENCY_DATA, SEED_DEMO_IDS } from "./initial-data";
import {
  CONNECTED_CALL_OUTCOMES,
  createDefaultProjectChecklist,
  DEFAULT_INTEGRATIONS,
  normalizeOutreachStatus,
} from "./constants";
import { decryptSecrets, encryptSecrets } from "./crypto-vault";
import { realtimeBus } from "./realtime-bus";
import { getSupabaseServiceClient } from "./supabase";

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "twofold-studio-data")
  : path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "agency-db.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const SECRETS_FILE_PATH = path.join(DATA_DIR, "integration-secrets.enc.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");

const SEED_DOCUMENT_CONTENTS: Record<string, string> = {};

export function ensureDataDirectories() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, BACKUPS_DIR]) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
  }

  for (const [relativePath, content] of Object.entries(
    SEED_DOCUMENT_CONTENTS
  )) {
    const fullPath = path.join(UPLOADS_DIR, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
    if (!fs.existsSync(/*turbopackIgnore: true*/ fullPath)) {
      fs.writeFileSync(/*turbopackIgnore: true*/ fullPath, content, "utf-8");
    }
  }
}

/**
 * Normalizes and upgrades any existing database state so new collections
 * (coldCalls, campaigns, integrations, invitations, importHistory, payments)
 * and `isDemo` flags are always present without losing existing user records.
 */
function upgradeStateSchema(raw: AgencyDatabaseState): AgencyDatabaseState {
  const leads = (raw.leads || []).map((l) => ({
    ...l,
    isDemo:
      typeof l.isDemo === "boolean" ? l.isDemo : SEED_DEMO_IDS.leads.has(l.id),
  }));
  const seenOutreachIds = new Set<string>();
  const outreach = (raw.outreach || []).map((o, idx) => {
    let safeId = o.id || `out-norm-${idx}-${Date.now()}`;
    if (seenOutreachIds.has(safeId)) {
      safeId = `${safeId}-dup-${idx}`;
    }
    seenOutreachIds.add(safeId);
    const dir = o.direction || "Outbound";
    return {
      ...o,
      id: safeId,
      direction: dir,
      source: o.source || "manual",
      deliveryStatus: o.deliveryStatus || "sent",
      replyStatus: normalizeOutreachStatus(o.replyStatus, dir),
      isDemo:
        typeof o.isDemo === "boolean"
          ? o.isDemo
          : SEED_DEMO_IDS.outreach.has(safeId),
    };
  });
  const clients = (raw.clients || []).map((c) => ({
    ...c,
    isDemo:
      typeof c.isDemo === "boolean"
        ? c.isDemo
        : SEED_DEMO_IDS.clients.has(c.id),
  }));
  const projects = (raw.projects || []).map((p) => ({
    ...p,
    isDemo:
      typeof p.isDemo === "boolean"
        ? p.isDemo
        : SEED_DEMO_IDS.projects.has(p.id),
  }));
  const tasks = (raw.tasks || []).map((t) => ({
    ...t,
    isDemo:
      typeof t.isDemo === "boolean" ? t.isDemo : SEED_DEMO_IDS.tasks.has(t.id),
  }));
  const finance = (raw.finance || []).map((f) => ({
    ...f,
    isDemo:
      typeof f.isDemo === "boolean"
        ? f.isDemo
        : SEED_DEMO_IDS.finance.has(f.id),
  }));
  const documents = (raw.documents || []).map((d) => ({
    ...d,
    isDemo:
      typeof d.isDemo === "boolean"
        ? d.isDemo
        : SEED_DEMO_IDS.documents.has(d.id),
  }));

  // Ensure all 6 integration cards exist
  const existingIntegrations = raw.integrations || [];
  const mergedIntegrations = DEFAULT_INTEGRATIONS.map((def) => {
    const found = existingIntegrations.find(
      (i) => i.provider === def.provider
    );
    return found ? { ...def, ...found } : def;
  });

  return {
    ...INITIAL_AGENCY_DATA,
    ...raw,
    leads,
    outreach,
    coldCalls: raw.coldCalls || INITIAL_AGENCY_DATA.coldCalls || [],
    campaigns: raw.campaigns || INITIAL_AGENCY_DATA.campaigns || [],
    clients,
    projects,
    tasks,
    finance,
    payments: raw.payments || INITIAL_AGENCY_DATA.payments || [],
    documents,
    invitations: raw.invitations || [],
    integrations: mergedIntegrations,
    importHistory: raw.importHistory || [],
    prospects: raw.prospects || [],
    prospectImports: raw.prospectImports || [],
    settings: {
      ...INITIAL_AGENCY_DATA.settings,
      ...(raw.settings || {}),
      includeDemoDataInAnalytics:
        raw.settings?.includeDemoDataInAnalytics ?? true,
    },
  };
}

export function readAgencyDb(): AgencyDatabaseState {
  ensureDataDirectories();
  if (!fs.existsSync(DB_FILE_PATH)) {
    const initial = upgradeStateSchema(INITIAL_AGENCY_DATA);
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AgencyDatabaseState;
    return upgradeStateSchema(parsed);
  } catch {
    return upgradeStateSchema(INITIAL_AGENCY_DATA);
  }
}

export function writeAgencyDb(
  state: AgencyDatabaseState
): AgencyDatabaseState {
  ensureDataDirectories();
  const normalized = upgradeStateSchema(state);
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

/**
 * Filters the state returned to a client based on the authenticated member's RBAC role.
 * Team Members cannot access financial records or payments, and only see permitted clients/projects.
 */
export function filterStateForMember(
  state: AgencyDatabaseState,
  member: TeamMember | null
): AgencyDatabaseState {
  if (!member) return state;
  const roleConfig = state.settings.rolePermissions?.[member.role];
  const canSeeFinance = roleConfig
    ? roleConfig.finance
    : member.role === "Admin" || member.role === "Manager";

  if (member.role === "Admin" || member.role === "Manager") {
    return {
      ...state,
      finance: canSeeFinance ? state.finance : [],
      payments: canSeeFinance ? state.payments : [],
    };
  }

  // Team Member role restrictions:
  // 1. Assigned projects
  const assignedProjects = state.projects.filter((p) =>
    p.assignedTeamMembers.includes(member.id)
  );
  const assignedProjectIds = new Set(assignedProjects.map((p) => p.id));
  const permittedClientIds = new Set(assignedProjects.map((p) => p.clientId));

  // 2. Permitted clients
  const permittedClients = state.clients.filter(
    (c) =>
      permittedClientIds.has(c.id) ||
      c.assignedAccountManagerId === member.id
  );

  return {
    ...state,
    projects: assignedProjects,
    clients: permittedClients,
    finance: canSeeFinance ? state.finance : [],
    payments: canSeeFinance ? state.payments : [],
  };
}

function nowTimestamp(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function appendAuditAndNotification(
  db: AgencyDatabaseState,
  params: {
    actorId: string;
    actorName: string;
    action: ActivityLogItem["action"];
    entityType: string;
    entityName: string;
    details: string;
    notification?: Omit<AgencyNotification, "id" | "isRead" | "createdAt">;
  }
) {
  const logItem: ActivityLogItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actorId: params.actorId,
    actorName: params.actorName,
    action: params.action,
    entityType: params.entityType,
    entityName: params.entityName,
    details: params.details,
    createdAt: nowTimestamp(),
  };
  db.activityLog = [logItem, ...db.activityLog.slice(0, 149)];

  if (params.notification) {
    const notifItem: AgencyNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...params.notification,
      isRead: false,
      createdAt: nowTimestamp(),
    };
    db.notifications = [notifItem, ...db.notifications.slice(0, 99)];
  }
}

export type CollectionName =
  | "leads"
  | "outreach"
  | "coldCalls"
  | "campaigns"
  | "clients"
  | "projects"
  | "tasks"
  | "finance"
  | "payments"
  | "documents"
  | "templates"
  | "teamMembers"
  | "notifications"
  | "integrations"
  | "invitations";

/**
 * Granular record creation with audit logging and real-time multi-user broadcast.
 */
export async function insertRecord<T extends { id: string }>(
  collection: CollectionName,
  record: T,
  actor: { id: string; name: string },
  auditMeta?: {
    entityType: string;
    entityName: string;
    details: string;
    notification?: Omit<AgencyNotification, "id" | "isRead" | "createdAt">;
  }
): Promise<T> {
  const db = readAgencyDb();
  const list = ((db[collection] as unknown as T[]) || []).filter(
    (item) => item.id !== record.id
  );
  (db[collection] as unknown as T[]) = [record, ...list];

  // Side effects for relational consistency:
  // If outreach or coldCall is logged for a lead, update lead.lastContacted & status
  if (collection === "outreach") {
    const out = record as unknown as AgencyDatabaseState["outreach"][number];
    db.leads = db.leads.map((l) => {
      if (l.id !== out.leadId && l.businessName !== out.leadName) return l;
      return {
        ...l,
        lastContacted: out.dateSent || todayDate(),
        nextFollowUpDate: out.nextFollowUpDate || l.nextFollowUpDate,
        status:
          l.status === "New" || l.status === "Qualified"
            ? "Contacted"
            : out.direction === "Inbound" && l.status === "Contacted"
            ? "Replied"
            : l.status,
        history: [
          {
            id: `lh-${Date.now()}`,
            action: `${
              out.direction === "Inbound" ? "Inbound reply" : "Outreach"
            } via ${out.communicationChannel} (${out.replyStatus})`,
            actorName: actor.name,
            timestamp: nowTimestamp(),
          },
          ...l.history,
        ],
      };
    });
  } else if (collection === "coldCalls") {
    const call =
      record as unknown as NonNullable<AgencyDatabaseState["coldCalls"]>[number];
    call.connected = CONNECTED_CALL_OUTCOMES.has(call.outcome);
    db.leads = db.leads.map((l) => {
      if (l.id !== call.leadId && l.businessName !== call.businessName)
        return l;
      const nextStatus =
        call.outcome === "Meeting Booked"
          ? "Meeting Scheduled"
          : call.outcome === "Interested"
          ? "Interested"
          : call.outcome === "Converted"
          ? "Converted"
          : l.status === "New"
          ? "Contacted"
          : l.status;
      return {
        ...l,
        lastContacted: call.callDate || todayDate(),
        nextFollowUpDate: call.followUpDate || l.nextFollowUpDate,
        status: nextStatus,
        history: [
          {
            id: `lh-${Date.now()}`,
            action: `Cold call logged (${call.outcome})`,
            actorName: actor.name,
            timestamp: nowTimestamp(),
          },
          ...l.history,
        ],
      };
    });
  }

  if (auditMeta) {
    appendAuditAndNotification(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "created",
      ...auditMeta,
    });
  } else if (collection === "tasks") {
    const task = record as unknown as AgencyDatabaseState["tasks"][number];
    appendAuditAndNotification(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "created",
      entityType: "Task",
      entityName: task.taskTitle,
      details: `Assigned task "${task.taskTitle}" (due ${task.dueDate}).`,
      notification: {
        type: "Task Assigned",
        recipientMemberId: task.assignedPersonId,
        title: `Task Assigned: ${task.taskTitle}`,
        message: `Priority: ${task.priority} · Due ${task.dueDate}`,
        section: "tasks",
        entityId: task.id,
      },
    });
  }

  writeAgencyDb(db);

  // Sync to Supabase if configured
  const supa = getSupabaseServiceClient();
  if (supa) {
    try {
      await syncRecordToSupabase(collection, "INSERT", record);
    } catch {
      // non-fatal fallback
    }
  }

  realtimeBus.emit({
    table: collection,
    action: "INSERT",
    recordId: record.id,
    actorId: actor.id,
  });

  return record;
}

/**
 * Granular record update by ID with real-time broadcast.
 */
export async function updateRecordById<T extends { id: string }>(
  collection: CollectionName,
  id: string,
  updates: Partial<T>,
  actor: { id: string; name: string },
  auditMeta?: {
    action?: ActivityLogItem["action"];
    entityType: string;
    entityName: string;
    details: string;
    notification?: Omit<AgencyNotification, "id" | "isRead" | "createdAt">;
  },
  fallbackRecord?: T
): Promise<T | null> {
  const db = readAgencyDb();
  const list = (db[collection] as unknown as T[]) || [];
  const idx = list.findIndex((item) => item.id === id);
  const stampedUpdates = {
    ...updates,
    updatedAtMs: Date.now(),
  } as Partial<T>;

  let updated: T;
  if (idx < 0) {
    if (!fallbackRecord) return null;
    updated = { ...fallbackRecord, ...stampedUpdates, id } as T;
    (db[collection] as unknown as T[]) = [updated, ...list];
  } else {
    updated = { ...list[idx], ...stampedUpdates, id };
    list[idx] = updated;
    (db[collection] as unknown as T[]) = list;
  }

  // If a task is completed and linked to a project, recalculate project progress if appropriate
  if (collection === "tasks") {
    const task = updated as unknown as AgencyDatabaseState["tasks"][number];
    if (task.relatedProjectId && task.status === "Completed") {
      const projTasks = db.tasks.filter(
        (t) => t.relatedProjectId === task.relatedProjectId
      );
      if (projTasks.length > 0) {
        const doneTasks = projTasks.filter(
          (t) => t.status === "Completed"
        ).length;
        db.projects = db.projects.map((p) => {
          if (p.id !== task.relatedProjectId) return p;
          const chkDone = p.checklist.filter((c) => c.completed).length;
          const totalItems = p.checklist.length + projTasks.length;
          const nextPct = Math.round(
            ((chkDone + doneTasks) / Math.max(1, totalItems)) * 100
          );
          return {
            ...p,
            progressPercentage: Math.max(p.progressPercentage, nextPct),
          };
        });
      }
    }
  }

  if (auditMeta) {
    appendAuditAndNotification(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: auditMeta.action || "edited",
      entityType: auditMeta.entityType,
      entityName: auditMeta.entityName,
      details: auditMeta.details,
      notification: auditMeta.notification,
    });
  }

  writeAgencyDb(db);

  const supa = getSupabaseServiceClient();
  if (supa) {
    try {
      await syncRecordToSupabase(collection, "UPDATE", updated);
    } catch {
      // non-fatal
    }
  }

  realtimeBus.emit({
    table: collection,
    action: "UPDATE",
    recordId: id,
    actorId: actor.id,
  });

  return updated;
}

/**
 * Granular record deletion by ID with real-time broadcast.
 */
export async function deleteRecordById(
  collection: CollectionName,
  id: string,
  actor: { id: string; name: string },
  auditMeta?: {
    entityType: string;
    entityName: string;
    details: string;
  }
): Promise<boolean> {
  const db = readAgencyDb();
  const list = (db[collection] as unknown as { id: string }[]) || [];
  const exists = list.some((item) => item.id === id);
  if (!exists) return false;

  (db[collection] as unknown as { id: string }[]) = list.filter(
    (item) => item.id !== id
  );

  if (auditMeta) {
    appendAuditAndNotification(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "deleted",
      ...auditMeta,
    });
  }

  writeAgencyDb(db);

  const supa = getSupabaseServiceClient();
  if (supa) {
    try {
      await syncRecordToSupabase(collection, "DELETE", { id });
    } catch {
      // non-fatal
    }
  }

  realtimeBus.emit({
    table: collection,
    action: "DELETE",
    recordId: id,
    actorId: actor.id,
  });

  return true;
}

/**
 * Atomic Transaction: Convert Lead -> Client (+ Optional Project + Checklist)
 */
export function convertLeadTransaction(params: {
  leadId: string;
  servicesPurchased: string[];
  createProject: boolean;
  projectName?: string;
  projectType?: string;
  projectBudget?: number;
  projectDeadline?: string;
  actor: { id: string; name: string };
}): { client: Client; project?: Project; lead: Lead } | null {
  const db = readAgencyDb();
  const leadIdx = db.leads.findIndex((l) => l.id === params.leadId);
  if (leadIdx < 0) return null;
  const lead = db.leads[leadIdx];

  const newClient: Client = {
    id: `client-${Date.now()}`,
    clientName: lead.contactPerson || lead.businessName,
    businessName: lead.businessName,
    industry: lead.industry,
    contactPerson: lead.contactPerson,
    email: lead.businessEmail,
    phone: lead.phoneNumber,
    country: lead.country,
    city: lead.city,
    website: lead.websiteUrl,
    socialMediaLinks: {
      instagram: lead.instagramUrl || undefined,
      linkedin: lead.linkedinUrl || undefined,
      facebook: lead.facebookUrl || undefined,
    },
    clientSince: todayDate(),
    servicesPurchased:
      params.servicesPurchased.length > 0
        ? params.servicesPurchased
        : [
            "Custom Website Design (UI/UX)",
            "Next.js Full-Stack Development",
          ],
    totalProjectValue:
      params.projectBudget ?? lead.estimatedProjectValue ?? 20000,
    paymentStatus: "Pending",
    assignedAccountManagerId: lead.assignedTeamMemberId || params.actor.id,
    internalNotes:
      lead.personalizationNotes ||
      `Converted from ${lead.leadSource} lead.`,
    communicationHistory: [
      {
        id: `cc-${Date.now()}`,
        date: todayDate(),
        channel: "CRM Conversion",
        summary: `Lead converted to active client by ${params.actor.name}.`,
        authorName: params.actor.name,
      },
    ],
    meetingHistory: [],
    originLeadId: lead.id,
    isDemo: false,
  };

  let newProject: Project | undefined;
  if (params.createProject) {
    const checklist = createDefaultProjectChecklist();
    checklist[0].completed = true;
    newProject = {
      id: `proj-${Date.now()}`,
      projectName:
        params.projectName?.trim() ||
        `${lead.businessName} — Digital Platform`,
      clientId: newClient.id,
      projectType: params.projectType || "Next.js Full-Stack Development",
      projectDescription:
        lead.potentialOpportunity ||
        `End-to-end design and engineering engagement for ${lead.businessName}.`,
      projectBudget:
        params.projectBudget ?? lead.estimatedProjectValue ?? 20000,
      startDate: todayDate(),
      deadline:
        params.projectDeadline ||
        new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
      projectStatus: "Agreement Signed",
      progressPercentage: 10,
      assignedTeamMembers: [
        lead.assignedTeamMemberId || params.actor.id,
        "tm-3",
        "tm-4",
      ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i),
      websiteDemoUrl: `https://${lead.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}-staging.twofold.studio`,
      liveWebsiteUrl: lead.websiteUrl || "",
      referenceWebsites: ["https://linear.app", "https://stripe.com"],
      internalNotes: `Kickoff project provisioned from converted lead ${lead.businessName}.`,
      checklist,
      isDemo: false,
    };
  }

  const updatedLead: Lead = {
    ...lead,
    status: "Converted",
    convertedClientId: newClient.id,
    history: [
      {
        id: `lh-${Date.now()}`,
        action: `Converted into Client (${newClient.businessName})`,
        actorName: params.actor.name,
        timestamp: nowTimestamp(),
      },
      ...lead.history,
    ],
  };

  db.leads[leadIdx] = updatedLead;
  db.clients = [newClient, ...db.clients];
  if (newProject) {
    db.projects = [newProject, ...db.projects];
  }

  appendAuditAndNotification(db, {
    actorId: params.actor.id,
    actorName: params.actor.name,
    action: "converted",
    entityType: "Lead → Client",
    entityName: lead.businessName,
    details: `Converted ${lead.businessName} into Client${
      newProject ? ` and created project "${newProject.projectName}"` : ""
    }.`,
    notification: {
      type: "New Client",
      title: `Lead Converted: ${lead.businessName}`,
      message: `${lead.contactPerson} is now an active client ($${newClient.totalProjectValue.toLocaleString()}).`,
      section: "clients",
      entityId: newClient.id,
    },
  });

  writeAgencyDb(db);

  realtimeBus.emit({
    table: "clients",
    action: "TRANSACTION",
    recordId: newClient.id,
    actorId: params.actor.id,
  });

  return { client: newClient, project: newProject, lead: updatedLead };
}

/**
 * Atomic Transaction: Record Invoice Payment
 */
export function recordPaymentTransaction(params: {
  invoiceId: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  actor: { id: string; name: string };
}): { invoice: FinanceRecord; payment: PaymentTransaction } | null {
  const db = readAgencyDb();
  const invIdx = db.finance.findIndex((f) => f.id === params.invoiceId);
  if (invIdx < 0) return null;
  const inv = db.finance[invIdx];

  const nextPaid = Math.min(inv.amount, inv.paidAmount + params.amount);
  const nextStatus =
    nextPaid >= inv.amount
      ? "Paid"
      : nextPaid > 0
      ? "Partially Paid"
      : inv.paymentStatus;

  const updatedInvoice: FinanceRecord = {
    ...inv,
    paidAmount: nextPaid,
    paymentStatus: nextStatus,
    paymentDate: todayDate(),
    paymentMethod: params.paymentMethod || inv.paymentMethod,
  };
  db.finance[invIdx] = updatedInvoice;

  const paymentRow: PaymentTransaction = {
    id: `pay-${Date.now()}`,
    invoiceId: inv.id,
    amount: params.amount,
    currency: inv.currency,
    paidAt: todayDate(),
    method: params.paymentMethod || inv.paymentMethod,
    notes: params.notes || `Payment recorded on ${inv.invoiceNumber}`,
    recordedById: params.actor.id,
    isDemo: false,
  };
  db.payments = [paymentRow, ...(db.payments || [])];

  if (inv.clientId) {
    db.clients = db.clients.map((c) =>
      c.id === inv.clientId
        ? {
            ...c,
            paymentStatus: nextStatus === "Paid" ? "Paid" : "Partially Paid",
          }
        : c
    );
  }

  appendAuditAndNotification(db, {
    actorId: params.actor.id,
    actorName: params.actor.name,
    action: "recorded",
    entityType: "Payment",
    entityName: inv.invoiceNumber,
    details: `Recorded payment of ${inv.currency} ${params.amount.toLocaleString()} on ${inv.invoiceNumber} (${nextStatus}).`,
    notification: {
      type: "Payment Received",
      title: `Payment Recorded: ${inv.invoiceNumber}`,
      message: `${inv.currency} ${params.amount.toLocaleString()} received (${nextStatus}).`,
      section: "finance",
      entityId: inv.id,
    },
  });

  writeAgencyDb(db);

  realtimeBus.emit({
    table: "finance",
    action: "TRANSACTION",
    recordId: inv.id,
    actorId: params.actor.id,
  });

  return { invoice: updatedInvoice, payment: paymentRow };
}

/**
 * Atomic Transaction: Safely remove seeded DEMO records while preserving all legitimate user data.
 */
export function purgeDemoRecordsTransaction(actor: {
  id: string;
  name: string;
}): {
  leadsRemoved: number;
  clientsRemoved: number;
  projectsRemoved: number;
  tasksRemoved: number;
  outreachRemoved: number;
  callsRemoved: number;
  financeRemoved: number;
} {
  const db = readAgencyDb();
  const prevCounts = {
    leads: db.leads.length,
    clients: db.clients.length,
    projects: db.projects.length,
    tasks: db.tasks.length,
    outreach: db.outreach.length,
    calls: (db.coldCalls || []).length,
    finance: db.finance.length,
  };

  db.leads = db.leads.filter((l) => !l.isDemo);
  db.clients = db.clients.filter((c) => !c.isDemo);
  db.projects = db.projects.filter((p) => !p.isDemo);
  db.tasks = db.tasks.filter((t) => !t.isDemo);
  db.outreach = db.outreach.filter((o) => !o.isDemo);
  db.coldCalls = (db.coldCalls || []).filter((c) => !c.isDemo);
  db.campaigns = (db.campaigns || []).filter((c) => !c.isDemo);
  db.finance = db.finance.filter((f) => !f.isDemo);
  db.payments = (db.payments || []).filter((p) => !p.isDemo);
  db.documents = db.documents.filter((d) => !d.isDemo);

  const summary = {
    leadsRemoved: prevCounts.leads - db.leads.length,
    clientsRemoved: prevCounts.clients - db.clients.length,
    projectsRemoved: prevCounts.projects - db.projects.length,
    tasksRemoved: prevCounts.tasks - db.tasks.length,
    outreachRemoved: prevCounts.outreach - db.outreach.length,
    callsRemoved: prevCounts.calls - (db.coldCalls || []).length,
    financeRemoved: prevCounts.finance - db.finance.length,
  };

  appendAuditAndNotification(db, {
    actorId: actor.id,
    actorName: actor.name,
    action: "deleted",
    entityType: "Demo Data Purge",
    entityName: "Removed Seeded Demo Records",
    details: `Removed ${summary.leadsRemoved} demo leads, ${summary.clientsRemoved} demo clients, ${summary.projectsRemoved} demo projects, ${summary.financeRemoved} demo finance records. All user records preserved.`,
  });

  writeAgencyDb(db);

  realtimeBus.emit({
    table: "all",
    action: "TRANSACTION",
    actorId: actor.id,
  });

  return summary;
}

/**
 * Encrypted Server-Only Integration Secrets Vault (AES-256-GCM)
 * Never returned in any client payload.
 */
export function saveEncryptedIntegrationSecret(
  provider: IntegrationProviderId,
  secrets: Record<string, unknown>
) {
  ensureDataDirectories();
  let map: Record<string, string> = {};
  if (fs.existsSync(SECRETS_FILE_PATH)) {
    try {
      map = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, "utf-8"));
    } catch {
      map = {};
    }
  }
  map[provider] = encryptSecrets(secrets);
  fs.writeFileSync(SECRETS_FILE_PATH, JSON.stringify(map, null, 2), "utf-8");
}

export function loadDecryptedIntegrationSecret<T = Record<string, unknown>>(
  provider: IntegrationProviderId
): T | null {
  ensureDataDirectories();
  if (!fs.existsSync(SECRETS_FILE_PATH)) return null;
  try {
    const map = JSON.parse(
      fs.readFileSync(SECRETS_FILE_PATH, "utf-8")
    ) as Record<string, string>;
    const cipher = map[provider];
    if (!cipher) return null;
    return decryptSecrets<T>(cipher);
  } catch {
    return null;
  }
}

export function removeEncryptedIntegrationSecret(
  provider: IntegrationProviderId
) {
  ensureDataDirectories();
  if (!fs.existsSync(SECRETS_FILE_PATH)) return;
  try {
    const map = JSON.parse(
      fs.readFileSync(SECRETS_FILE_PATH, "utf-8")
    ) as Record<string, string>;
    delete map[provider];
    fs.writeFileSync(SECRETS_FILE_PATH, JSON.stringify(map, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

async function syncRecordToSupabase(
  collection: CollectionName,
  op: "INSERT" | "UPDATE" | "DELETE",
  record: { id: string }
) {
  const supa = getSupabaseServiceClient();
  if (!supa) return;
  const tableMap: Partial<Record<CollectionName, string>> = {
    leads: "leads",
    outreach: "outreach_activities",
    coldCalls: "cold_calls",
    campaigns: "campaigns",
    clients: "clients",
    projects: "projects",
    tasks: "tasks",
    finance: "finance_records",
    payments: "payments",
    documents: "documents",
    templates: "templates",
    teamMembers: "team_members",
    notifications: "notifications",
    integrations: "integrations",
  };
  const table = tableMap[collection];
  if (!table) return;
  if (op === "DELETE") {
    await supa.from(table).delete().eq("legacy_id", record.id);
  }
}

export function saveUploadedFileToStorage(
  storagePath: string,
  buffer: Buffer
): string {
  ensureDataDirectories();
  const safeRelative = storagePath.replace(/\.\./g, "");
  const fullPath = path.join(UPLOADS_DIR, safeRelative);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

export function readStoredFile(storagePath: string): Buffer | null {
  ensureDataDirectories();
  const safeRelative = storagePath.replace(/\.\./g, "");
  const fullPath = path.join(UPLOADS_DIR, safeRelative);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath);
}

export function deleteStoredFile(storagePath: string): void {
  ensureDataDirectories();
  const safeRelative = storagePath.replace(/\.\./g, "");
  const fullPath = path.join(UPLOADS_DIR, safeRelative);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}
