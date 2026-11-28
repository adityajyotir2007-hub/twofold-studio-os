import crypto from "crypto";
import {
  appendAuditAndNotification,
  insertRecord,
  readAgencyDb,
  writeAgencyDb,
} from "@/lib/server-db";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import {
  detectLeadDuplicate,
  normalizeEmail,
  normalizePhone,
  normalizeWebsiteDomain,
} from "@/lib/validation";
import { extractInstagramHandle } from "@/lib/auto-outreach";
import { Lead, LeadSource } from "@/types/agency";
import {
  DuplicateCheckResultItem,
  DuplicateMatchInfo,
  Prospect,
  ProspectImport,
  ProspectImportRowResult,
  ProspectInput,
  ProspectingCapabilities,
  ProspectingConversation,
  ProspectStatus,
  SendToCrmItemResult,
} from "@/types/prospecting";
import {
  findDuplicateIn,
  PROSPECTING_DEFAULT_MAX_ROWS,
  PROSPECTING_MAX_FILE_BYTES,
  prospectDedupeKeys,
  validateProspectRow,
} from "./validate";

export const DEFAULT_CRM_WORKSPACE = "ws-twofold-studio";

export function getMaxImportRows(): number {
  const raw = Number(process.env.PROSPECTING_MAX_IMPORT_ROWS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 10000) {
    return Math.floor(raw);
  }
  return PROSPECTING_DEFAULT_MAX_ROWS;
}

export function getCapabilities(): ProspectingCapabilities {
  const db = readAgencyDb();
  const gmailConnected =
    (db.integrations || []).find((i) => i.provider === "gmail")?.status ===
    "connected";
  const whatsappConnected =
    (db.integrations || []).find((i) => i.provider === "whatsapp")?.status ===
    "connected" ||
    Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
    );
  const instagramConnected =
    (db.integrations || []).find((i) => i.provider === "instagram")?.status ===
    "connected" || Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);
  const gcalConnected =
    (db.integrations || []).find((i) => i.provider === "google_calendar")
      ?.status === "connected";

  return {
    storage: process.env.VERCEL ? "ephemeral_serverless" : "local_file",
    supabaseConfigured: isSupabaseAdminConfigured,
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    n8n: Boolean(
      process.env.N8N_WEBHOOK_BASE_URL?.trim() &&
        process.env.N8N_WEBHOOK_SECRET?.trim()
    ),
    gmail: gmailConnected,
    whatsapp: whatsappConnected,
    instagram: instagramConnected,
    googleCalendar: gcalConnected,
    enrichmentProviders: [],
    maxImportRows: getMaxImportRows(),
    maxFileBytes: PROSPECTING_MAX_FILE_BYTES,
  };
}

export function listProspecting(workspaceId: string): {
  prospects: Prospect[];
  imports: ProspectImport[];
  conversations: ProspectingConversation[];
} {
  const db = readAgencyDb();
  const prospects = (db.prospects || []).filter(
    (p) => p.workspaceId === workspaceId
  );
  const imports = (db.prospectImports || []).filter(
    (imp) => imp.workspaceId === workspaceId
  );
  const conversations = (db.prospectConversations || []).filter(
    (c) => c.workspaceId === workspaceId
  );
  return { prospects, imports, conversations };
}

function leadDedupeKeys(lead: Lead): string[] {
  return prospectDedupeKeys({
    businessName: lead.businessName,
    email: normalizeEmail(lead.businessEmail),
    website: lead.websiteUrl,
    websiteDomain: normalizeWebsiteDomain(lead.websiteUrl),
    phone: normalizePhone(lead.phoneNumber),
    instagram: extractInstagramHandle(lead.instagramUrl || lead.instagramHandle),
    country: lead.country,
  });
}

function buildWorkspaceDedupeIndexes(
  workspaceId: string,
  prospects: Prospect[],
  crmLeads: Lead[]
): {
  prospectIndex: Map<string, Prospect>;
  crmIndex: Map<string, Lead>;
} {
  const prospectIndex = new Map<string, Prospect>();
  for (const p of prospects) {
    if (p.workspaceId !== workspaceId) continue;
    for (const key of prospectDedupeKeys(p)) {
      if (!prospectIndex.has(key)) {
        prospectIndex.set(key, p);
      }
    }
  }

  const crmIndex = new Map<string, Lead>();
  if (workspaceId === DEFAULT_CRM_WORKSPACE) {
    for (const l of crmLeads) {
      for (const key of leadDedupeKeys(l)) {
        if (!crmIndex.has(key)) {
          crmIndex.set(key, l);
        }
      }
    }
  }

  return { prospectIndex, crmIndex };
}

export function checkDuplicates(
  workspaceId: string,
  rows: Partial<ProspectInput>[]
): DuplicateCheckResultItem[] {
  const db = readAgencyDb();
  const { prospectIndex, crmIndex } = buildWorkspaceDedupeIndexes(
    workspaceId,
    db.prospects || [],
    db.leads || []
  );

  const fileIndex = new Map<string, { rowIndex: number; label: string }>();
  const results: DuplicateCheckResultItem[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const validated = validateProspectRow(rows[idx] || {});
    if (validated.status === "invalid") {
      results.push({ rowIndex: idx, duplicateOf: null });
      continue;
    }

    const keys = prospectDedupeKeys({
      ...validated.clean,
      websiteDomain: validated.websiteDomain,
    });

    let match: DuplicateMatchInfo | null = null;
    const inFile = findDuplicateIn(keys, fileIndex);
    if (inFile) {
      match = {
        type: "file",
        label: `Row ${inFile.rowIndex + 1} (${inFile.label})`,
      };
    } else {
      const existingProspect = findDuplicateIn(keys, prospectIndex);
      if (existingProspect) {
        match = {
          type: "prospect",
          id: existingProspect.id,
          label:
            existingProspect.businessName ||
            existingProspect.contactPerson ||
            existingProspect.email ||
            existingProspect.websiteDomain ||
            existingProspect.id,
        };
      } else {
        const existingLead = findDuplicateIn(keys, crmIndex);
        if (existingLead) {
          match = {
            type: "crm_lead",
            id: existingLead.id,
            label: existingLead.businessName || existingLead.businessEmail,
          };
        }
      }
    }

    const rowLabel =
      validated.clean.businessName ||
      validated.clean.contactPerson ||
      validated.clean.email ||
      validated.websiteDomain ||
      `Row ${idx + 1}`;
    for (const k of keys) {
      if (!fileIndex.has(k)) {
        fileIndex.set(k, { rowIndex: idx, label: rowLabel });
      }
    }

    results.push({ rowIndex: idx, duplicateOf: match });
  }

  return results;
}

export interface RunImportRowInput {
  rowNumber: number;
  included: boolean;
  data: Partial<ProspectInput>;
}

export interface RunImportPayload {
  idempotencyKey: string;
  fileName: string;
  fileType: "csv" | "xlsx" | "xls";
  fileSize: number;
  duplicateStrategy: "skip" | "update";
  columnMapping: Record<string, string>;
  rows: RunImportRowInput[];
}

export function runImport(
  workspaceId: string,
  actor: { id: string; name: string },
  payload: RunImportPayload
): {
  importRecord: ProspectImport;
  prospects: Prospect[];
  imports: ProspectImport[];
} {
  const db = readAgencyDb();
  const existingImport = (db.prospectImports || []).find(
    (imp) =>
      imp.workspaceId === workspaceId &&
      imp.idempotencyKey === payload.idempotencyKey
  );
  if (existingImport) {
    return {
      importRecord: existingImport,
      prospects: (db.prospects || []).filter(
        (p) => p.workspaceId === workspaceId
      ),
      imports: (db.prospectImports || []).filter(
        (imp) => imp.workspaceId === workspaceId
      ),
    };
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const importId = crypto.randomUUID();

  try {
    const caps = getCapabilities();
    const { prospectIndex, crmIndex } = buildWorkspaceDedupeIndexes(
      workspaceId,
      db.prospects || [],
      db.leads || []
    );

    const fileIndex = new Map<string, { rowNumber: number; label: string }>();
    const newProspects: Prospect[] = [];
    const updatedMap = new Map<string, Prospect>();
    const rowResults: ProspectImportRowResult[] = [];

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const row of payload.rows) {
      if (!row.included) {
        skippedCount++;
        rowResults.push({
          rowNumber: row.rowNumber,
          outcome: "skipped_excluded",
          reason: "Excluded in import review",
        });
        continue;
      }

      const validated = validateProspectRow(row.data || {});
      if (validated.status === "invalid") {
        failedCount++;
        rowResults.push({
          rowNumber: row.rowNumber,
          outcome: "failed",
          reason: validated.reason || "Row has no identifying fields",
        });
        continue;
      }

      const keys = prospectDedupeKeys({
        ...validated.clean,
        websiteDomain: validated.websiteDomain,
      });

      const inFileDup = findDuplicateIn(keys, fileIndex);
      if (inFileDup) {
        skippedCount++;
        rowResults.push({
          rowNumber: row.rowNumber,
          outcome: "skipped_duplicate",
          reason: `Duplicate of row ${inFileDup.rowNumber} in this file (${inFileDup.label})`,
        });
        continue;
      }

      const rowLabel =
        validated.clean.businessName ||
        validated.clean.contactPerson ||
        validated.clean.email ||
        validated.websiteDomain ||
        `Row ${row.rowNumber}`;
      for (const k of keys) {
        if (!fileIndex.has(k)) {
          fileIndex.set(k, { rowNumber: row.rowNumber, label: rowLabel });
        }
      }

      const existingProspect = findDuplicateIn(keys, prospectIndex);
      if (existingProspect) {
        if (payload.duplicateStrategy === "skip") {
          skippedCount++;
          rowResults.push({
            rowNumber: row.rowNumber,
            outcome: "skipped_duplicate",
            prospectId: existingProspect.id,
            reason: `Matches existing prospect "${
              existingProspect.businessName ||
              existingProspect.email ||
              existingProspect.id
            }"`,
          });
          continue;
        }

        // Update existing prospect with non-empty incoming fields only
        const current =
          updatedMap.get(existingProspect.id) || existingProspect;
        const mergedWarnings = Array.from(
          new Set([...(current.validationWarnings || []), ...validated.warnings])
        );
        const updatedProspect: Prospect = {
          ...current,
          businessName: validated.clean.businessName || current.businessName,
          contactPerson: validated.clean.contactPerson || current.contactPerson,
          website: validated.clean.website || current.website,
          websiteDomain: validated.websiteDomain || current.websiteDomain,
          email: validated.clean.email || current.email,
          phone: validated.clean.phone || current.phone,
          instagram: validated.clean.instagram || current.instagram,
          linkedinUrl: validated.clean.linkedinUrl || current.linkedinUrl,
          category: validated.clean.category || current.category,
          location: validated.clean.location || current.location,
          country: validated.clean.country || current.country,
          notes: validated.clean.notes || current.notes,
          source: validated.clean.source || current.source,
          validationWarnings: mergedWarnings,
          updatedAt: nowIso,
          updatedAtMs: nowMs,
        };
        updatedMap.set(existingProspect.id, updatedProspect);
        updatedCount++;
        rowResults.push({
          rowNumber: row.rowNumber,
          outcome: "updated",
          prospectId: existingProspect.id,
        });
        continue;
      }

      // Check CRM lead match (still import, link crmLeadId + add warning)
      const crmMatch = findDuplicateIn(keys, crmIndex);
      const warnings = [...validated.warnings];
      if (crmMatch) {
        warnings.push(
          `Already exists in CRM as "${
            crmMatch.businessName || crmMatch.businessEmail
          }"`
        );
      }

      const prospect: Prospect = {
        id: crypto.randomUUID(),
        workspaceId,
        ...validated.clean,
        source: validated.clean.source || `Spreadsheet: ${payload.fileName}`,
        websiteDomain: validated.websiteDomain,
        importId,
        status: "Imported",
        enrichmentStatus: "not_configured",
        researchStatus: caps.gemini ? "not_started" : "not_configured",
        outreachStatus: "not_started",
        qualificationStatus: "unqualified",
        campaignId: null,
        crmLeadId: crmMatch ? crmMatch.id : null,
        validationWarnings: warnings,
        createdById: actor.id,
        createdAt: nowIso,
        updatedAt: nowIso,
        updatedAtMs: nowMs,
      };

      newProspects.push(prospect);
      for (const k of keys) {
        if (!prospectIndex.has(k)) {
          prospectIndex.set(k, prospect);
        }
      }

      importedCount++;
      rowResults.push({
        rowNumber: row.rowNumber,
        outcome: "imported",
        prospectId: prospect.id,
      });
    }

    const importStatus: ProspectImport["status"] =
      importedCount + updatedCount === 0 && failedCount > 0
        ? "failed"
        : failedCount > 0
        ? "completed_with_errors"
        : "completed";

    const importRecord: ProspectImport = {
      id: importId,
      workspaceId,
      idempotencyKey: payload.idempotencyKey,
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSize,
      totalRows: payload.rows.length,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount,
      status: importStatus,
      duplicateStrategy: payload.duplicateStrategy,
      columnMapping: payload.columnMapping,
      rowResults,
      createdById: actor.id,
      createdByName: actor.name,
      createdAt: nowIso,
      completedAt: new Date().toISOString(),
      updatedAtMs: Date.now(),
    };

    const existingList = (db.prospects || []).map(
      (p) => updatedMap.get(p.id) || p
    );
    db.prospects = [...newProspects, ...existingList];
    db.prospectImports = [importRecord, ...(db.prospectImports || [])];

    appendAuditAndNotification(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "imported",
      entityType: "Prospect Import",
      entityName: payload.fileName,
      details: `Imported ${importedCount}, updated ${updatedCount}, skipped ${skippedCount}, failed ${failedCount} prospects from ${payload.fileName}.`,
      notification: {
        type: "Import Completed",
        title: `Prospect Import: ${importedCount} added`,
        message: `${payload.fileName} — ${importedCount} imported, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} failed.`,
        section: "prospecting",
        entityId: importId,
      },
    });

    writeAgencyDb(db);

    return {
      importRecord,
      prospects: db.prospects.filter((p) => p.workspaceId === workspaceId),
      imports: db.prospectImports.filter((imp) => imp.workspaceId === workspaceId),
    };
  } catch (err) {
    const failedImport: ProspectImport = {
      id: importId,
      workspaceId,
      idempotencyKey: payload.idempotencyKey,
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSize,
      totalRows: payload.rows.length,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: payload.rows.length,
      status: "failed",
      duplicateStrategy: payload.duplicateStrategy,
      columnMapping: payload.columnMapping,
      rowResults: [],
      createdById: actor.id,
      createdByName: actor.name,
      createdAt: nowIso,
      completedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Import processing error",
      updatedAtMs: Date.now(),
    };
    const latest = readAgencyDb();
    latest.prospectImports = [failedImport, ...(latest.prospectImports || [])];
    writeAgencyDb(latest);
    throw err;
  }
}

export function updateProspect(
  workspaceId: string,
  actor: { id: string; name: string },
  id: string,
  patch: Partial<
    Pick<
      Prospect,
      | "businessName"
      | "contactPerson"
      | "website"
      | "email"
      | "phone"
      | "instagram"
      | "linkedinUrl"
      | "category"
      | "location"
      | "country"
      | "notes"
      | "source"
      | "status"
      | "campaignId"
    >
  >
): Prospect | null {
  const db = readAgencyDb();
  const list = db.prospects || [];
  const idx = list.findIndex(
    (p) => p.id === id && p.workspaceId === workspaceId
  );
  if (idx < 0) return null;

  const existing = list[idx];
  const mergedInput: ProspectInput = {
    businessName: patch.businessName ?? existing.businessName,
    contactPerson: patch.contactPerson ?? existing.contactPerson,
    website: patch.website ?? existing.website,
    email: patch.email ?? existing.email,
    phone: patch.phone ?? existing.phone,
    instagram: patch.instagram ?? existing.instagram,
    linkedinUrl: patch.linkedinUrl ?? existing.linkedinUrl,
    category: patch.category ?? existing.category,
    location: patch.location ?? existing.location,
    country: patch.country ?? existing.country,
    notes: patch.notes ?? existing.notes,
    source: patch.source ?? existing.source,
  };

  const validated = validateProspectRow(mergedInput);
  if (validated.status === "invalid") {
    throw new Error(
      validated.reason ||
        "Prospect must retain at least one identifying field (business name, contact, email, website, Instagram, or LinkedIn)."
    );
  }

  const nextStatus: ProspectStatus = patch.status ?? existing.status;
  let nextQual = existing.qualificationStatus;
  if (nextStatus === "Interested" || nextStatus === "Call Booked") {
    nextQual = "interested";
  } else if (nextStatus === "Converted") {
    nextQual = "converted";
  } else if (
    nextStatus === "Not Interested" ||
    nextStatus === "Do Not Contact"
  ) {
    nextQual = "not_interested";
  }

  const updated: Prospect = {
    ...existing,
    ...validated.clean,
    websiteDomain: validated.websiteDomain,
    status: nextStatus,
    qualificationStatus: nextQual,
    campaignId:
      patch.campaignId !== undefined ? patch.campaignId : existing.campaignId,
    validationWarnings: validated.warnings,
    updatedAt: new Date().toISOString(),
    updatedAtMs: Date.now(),
  };

  list[idx] = updated;
  db.prospects = list;

  appendAuditAndNotification(db, {
    actorId: actor.id,
    actorName: actor.name,
    action: "edited",
    entityType: "Prospect",
    entityName: updated.businessName || updated.contactPerson || updated.email || updated.id,
    details:
      patch.status && patch.status !== existing.status
        ? `Updated prospect status to ${patch.status}.`
        : `Updated prospect details.`,
  });

  writeAgencyDb(db);
  return updated;
}

export function bulkUpdateProspectStatus(
  workspaceId: string,
  actor: { id: string; name: string },
  ids: string[],
  status: ProspectStatus
): Prospect[] {
  const idSet = new Set(ids);
  const db = readAgencyDb();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  let count = 0;

  db.prospects = (db.prospects || []).map((p) => {
    if (p.workspaceId !== workspaceId || !idSet.has(p.id)) return p;
    count++;
    let qual = p.qualificationStatus;
    if (status === "Interested" || status === "Call Booked") qual = "interested";
    else if (status === "Converted") qual = "converted";
    else if (status === "Not Interested" || status === "Do Not Contact") {
      qual = "not_interested";
    }
    return {
      ...p,
      status,
      qualificationStatus: qual,
      updatedAt: nowIso,
      updatedAtMs: nowMs,
    };
  });

  if (count > 0) {
    appendAuditAndNotification(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "edited",
      entityType: "Prospect",
      entityName: `${count} Prospects`,
      details: `Bulk updated ${count} prospects to status "${status}".`,
    });
    writeAgencyDb(db);
  }

  return (db.prospects || []).filter((p) => p.workspaceId === workspaceId);
}

export function deleteProspects(
  workspaceId: string,
  actor: { id: string; name: string },
  ids: string[]
): { deletedCount: number; prospects: Prospect[] } {
  const idSet = new Set(ids);
  const db = readAgencyDb();
  const before = db.prospects || [];
  let deletedCount = 0;

  db.prospects = before.filter((p) => {
    if (p.workspaceId === workspaceId && idSet.has(p.id)) {
      deletedCount++;
      return false;
    }
    return true;
  });

  if (deletedCount > 0) {
    appendAuditAndNotification(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "deleted",
      entityType: "Prospect",
      entityName: `${deletedCount} Prospects`,
      details: `Deleted ${deletedCount} prospects from workspace.`,
    });
    writeAgencyDb(db);
  }

  return {
    deletedCount,
    prospects: (db.prospects || []).filter((p) => p.workspaceId === workspaceId),
  };
}

function mapSourceToLeadSource(rawSource: string): LeadSource {
  const lower = rawSource.toLowerCase();
  if (lower.includes("instagram") || lower.includes("ig")) return "Instagram";
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("google") || lower.includes("maps")) return "Google Maps";
  if (lower.includes("facebook") || lower.includes("fb")) return "Facebook";
  if (lower.includes("yelp")) return "Yelp";
  if (lower.includes("referral")) return "Referrals";
  if (lower.includes("web")) return "Website";
  return "Other";
}

export async function sendProspectsToCrm(
  workspaceId: string,
  actor: { id: string; name: string },
  ids: string[]
): Promise<{
  conflict?: string;
  results: SendToCrmItemResult[];
  prospects: Prospect[];
}> {
  if (workspaceId !== DEFAULT_CRM_WORKSPACE) {
    return {
      conflict:
        "CRM lead sync is scoped to the primary workspace until multi-workspace CRM partitioning is provisioned.",
      results: [],
      prospects: listProspecting(workspaceId).prospects,
    };
  }

  const results: SendToCrmItemResult[] = [];
  const linkedMap = new Map<string, string>();
  const nowDate = new Date().toISOString().slice(0, 10);
  const nowStamp = `${nowDate} ${new Date().toTimeString().slice(0, 5)}`;

  for (const prospectId of ids) {
    const db = readAgencyDb();
    const prospect = (db.prospects || []).find(
      (p) => p.id === prospectId && p.workspaceId === workspaceId
    );
    if (!prospect) {
      results.push({
        prospectId,
        outcome: "not_found",
        reason: "Prospect not found in this workspace",
      });
      continue;
    }

    if (
      prospect.crmLeadId &&
      db.leads.some((l) => l.id === prospect.crmLeadId)
    ) {
      results.push({
        prospectId,
        outcome: "already_linked",
        crmLeadId: prospect.crmLeadId,
        label: prospect.businessName || prospect.email,
      });
      continue;
    }

    // Also match by Instagram handle if businessName/email/domain/phone weren't matched
    const igMatch = prospect.instagram
      ? db.leads.find(
          (l) =>
            extractInstagramHandle(
              l.instagramUrl || l.instagramHandle
            ).toLowerCase() === prospect.instagram.toLowerCase()
        )
      : undefined;
    const dup = detectLeadDuplicate(
      {
        businessName: prospect.businessName,
        businessEmail: prospect.email,
        websiteUrl: prospect.website,
        phoneNumber: prospect.phone,
      },
      db.leads
    );

    const matchedLeadId = dup?.existingLeadId || igMatch?.id;
    if (matchedLeadId) {
      const existingLead = db.leads.find((l) => l.id === matchedLeadId)!;
      existingLead.history = [
        {
          id: `lh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          action: `Linked from AI Prospecting (${prospect.source || "Prospect Database"})`,
          actorName: actor.name,
          timestamp: nowStamp,
        },
        ...(existingLead.history || []),
      ];
      writeAgencyDb(db);
      linkedMap.set(prospectId, matchedLeadId);
      results.push({
        prospectId,
        outcome: "linked_existing",
        crmLeadId: matchedLeadId,
        label: existingLead.businessName,
      });
      continue;
    }

    const displayName =
      prospect.businessName ||
      prospect.contactPerson ||
      prospect.websiteDomain ||
      prospect.email ||
      `Prospect ${prospect.id.slice(0, 8)}`;

    const newLead: Lead = {
      id: `lead-${crypto.randomUUID()}`,
      businessName: displayName,
      contactPerson: prospect.contactPerson || "",
      industry: prospect.category || "SaaS & Technology",
      country: prospect.country || "",
      city: prospect.location || "",
      businessEmail: prospect.email || "",
      phoneNumber: prospect.phone || "",
      websiteUrl: prospect.website || "",
      instagramUrl: prospect.instagram
        ? `https://instagram.com/${prospect.instagram}`
        : "",
      facebookUrl: "",
      linkedinUrl: prospect.linkedinUrl || "",
      googleMapsUrl: "",
      leadSource: mapSourceToLeadSource(prospect.source || ""),
      businessDescription: "",
      websiteStatus: prospect.website ? "Outdated Website" : "No Website",
      rating: 0,
      numberOfReviews: 0,
      personalizationNotes: prospect.notes || "",
      potentialOpportunity: "",
      estimatedProjectValue: 0,
      leadPriority: "Medium",
      status: prospect.status === "Interested" ? "Interested" : "New",
      assignedTeamMemberId: actor.id,
      dateAdded: nowDate,
      lastContacted: "",
      nextFollowUpDate: new Date(Date.now() + 3 * 86400000)
        .toISOString()
        .slice(0, 10),
      internalNotes: [],
      history: [
        {
          id: `lh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          action: `Created from AI Prospecting (${
            prospect.source || "Prospect Database"
          })`,
          actorName: actor.name,
          timestamp: nowStamp,
        },
      ],
      instagramHandle: prospect.instagram || undefined,
      isDemo: false,
    };

    await insertRecord("leads", newLead, actor, {
      entityType: "Lead",
      entityName: newLead.businessName,
      details: `Added CRM lead "${newLead.businessName}" from AI Prospecting.`,
      notification: {
        type: "New Lead",
        title: `Prospect Promoted to CRM: ${newLead.businessName}`,
        message: prospect.email || prospect.website || prospect.source || "Added to CRM Leads",
        section: "leads",
        entityId: newLead.id,
      },
    });

    linkedMap.set(prospectId, newLead.id);
    results.push({
      prospectId,
      outcome: "created",
      crmLeadId: newLead.id,
      label: newLead.businessName,
    });
  }

  // Re-read freshest DB after insertRecord calls so we never clobber newly created leads
  const finalDb = readAgencyDb();
  if (linkedMap.size > 0) {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    finalDb.prospects = (finalDb.prospects || []).map((p) => {
      const linkedLeadId = linkedMap.get(p.id);
      if (!linkedLeadId || p.workspaceId !== workspaceId) return p;
      return {
        ...p,
        crmLeadId: linkedLeadId,
        updatedAt: nowIso,
        updatedAtMs: nowMs,
      };
    });
    writeAgencyDb(finalDb);
  }

  return {
    results,
    prospects: (finalDb.prospects || []).filter(
      (p) => p.workspaceId === workspaceId
    ),
  };
}
