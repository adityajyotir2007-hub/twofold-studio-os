import { NextRequest, NextResponse } from "next/server";
import {
  canMemberAccessFinance,
  canMemberDeleteRecords,
  canMemberManageSettings,
  canMemberManageTeam,
  getSessionFromRequest,
} from "@/lib/server-auth";
import {
  appendAuditAndNotification,
  CollectionName,
  convertLeadTransaction,
  deleteRecordById,
  deleteStoredFile,
  filterStateForMember,
  insertRecord,
  purgeDemoRecordsTransaction,
  readAgencyDb,
  readStoredFile,
  recordPaymentTransaction,
  saveUploadedFileToStorage,
  updateRecordById,
  writeAgencyDb,
} from "@/lib/server-db";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectLeadDuplicate, isValidEmail, isValidUrl } from "@/lib/validation";
import { realtimeBus } from "@/lib/realtime-bus";
import { isSupabaseConfigured, STORAGE_BUCKET, supabase } from "@/lib/supabase";
import { AgencyDocument, DocumentCategory, ImportJobRecord, Lead } from "@/types/agency";

const VALID_COLLECTIONS = new Set<CollectionName>([
  "leads",
  "outreach",
  "coldCalls",
  "campaigns",
  "clients",
  "projects",
  "tasks",
  "finance",
  "payments",
  "documents",
  "templates",
  "teamMembers",
  "notifications",
  "integrations",
  "invitations",
]);

function resolveCollectionParam(req: NextRequest): string | null {
  const { searchParams } = new URL(req.url);
  return (
    searchParams.get("__collection") || searchParams.get("collection") || null
  );
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const collection = resolveCollectionParam(req);
    if (collection) {
      if (!VALID_COLLECTIONS.has(collection as CollectionName)) {
        return NextResponse.json(
          { error: `Invalid collection: ${collection}` },
          { status: 400 }
        );
      }
      const session = getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      if (
        (collection === "finance" || collection === "payments") &&
        !canMemberAccessFinance(session.role)
      ) {
        return NextResponse.json(
          {
            error:
              "Access denied: financial records are restricted for your role.",
          },
          { status: 403 }
        );
      }
      const db = readAgencyDb();
      const records = db[collection as CollectionName] || [];
      return NextResponse.json({ records });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("__mode");

    // 1. SSE Realtime stream mode (rewritten from /api/realtime)
    if (mode === "realtime") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now() })}\n\n`
            )
          );
          const unsubscribe = realtimeBus.subscribe((event) => {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
            } catch {
              // stream closed
            }
          });
          const keepAlive = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`: keepalive\n\n`));
            } catch {
              clearInterval(keepAlive);
            }
          }, 20_000);
          req.signal.addEventListener("abort", () => {
            clearInterval(keepAlive);
            unsubscribe();
            try {
              controller.close();
            } catch {
              // already closed
            }
          });
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // 2. Documents mode (rewritten from /api/documents and /api/documents/:id/file)
    if (mode === "documents" || searchParams.get("fileId")) {
      const id = searchParams.get("fileId") || searchParams.get("id");
      const download = searchParams.get("download") === "1";
      const db = readAgencyDb();
      if (!id) {
        return NextResponse.json({ documents: db.documents });
      }
      const doc = db.documents.find((d) => d.id === id);
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      const buffer = readStoredFile(doc.storagePath);
      if (!buffer) {
        const fallback = Buffer.from(
          `Document Title: ${doc.title}\nFile Name: ${doc.fileName}\nCategory: ${doc.category}\nStorage Path: ${doc.storagePath}\nUploaded: ${doc.createdAt}`,
          "utf-8"
        );
        return new NextResponse(new Uint8Array(fallback), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName}"`,
          },
        });
      }
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": doc.mimeType || "application/octet-stream",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName}"`,
        },
      });
    }

    // 3. Default state mode (/api/transactions & /api/state)
    const session = getSessionFromRequest(req);
    const data = readAgencyDb();
    const filtered = filterStateForMember(data, session?.member || null);
    return NextResponse.json(filtered);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to read agency database", details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const collection = resolveCollectionParam(req);
    if (collection) {
      if (!VALID_COLLECTIONS.has(collection as CollectionName)) {
        return NextResponse.json(
          { error: `Invalid collection: ${collection}` },
          { status: 400 }
        );
      }
      const session = getSessionFromRequest(req);
      const actor = session
        ? { id: session.member.id, name: session.member.name, role: session.role }
        : { id: "tm-1", name: "Rajdhar Diwedi", role: "Admin" as const };

      if (!canMemberDeleteRecords(actor.role)) {
        return NextResponse.json(
          { error: "Forbidden: your role is not permitted to delete records." },
          { status: 403 }
        );
      }
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ error: "Missing record id" }, { status: 400 });
      }
      const deleted = await deleteRecordById(
        collection as CollectionName,
        id,
        { id: actor.id, name: actor.name },
        {
          entityType: collection,
          entityName: id,
          details: `Deleted record ${id} from ${collection}.`,
        }
      );
      return NextResponse.json({ ok: deleted });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }
    const db = readAgencyDb();
    const target = db.documents.find((d) => d.id === id);
    if (target) {
      deleteStoredFile(target.storagePath);
      if (isSupabaseConfigured && supabase) {
        await supabase.storage.from(STORAGE_BUCKET).remove([target.storagePath]);
      }
      db.documents = db.documents.filter((d) => d.id !== id);
      writeAgencyDb(db);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete document", details: String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const collection = resolveCollectionParam(req);
  if (!collection || !VALID_COLLECTIONS.has(collection as CollectionName)) {
    return NextResponse.json(
      { error: `Invalid collection: ${collection}` },
      { status: 400 }
    );
  }

  const session = getSessionFromRequest(req);
  const actor = session
    ? { id: session.member.id, name: session.member.name, role: session.role }
    : { id: "tm-1", name: "Rajdhar Diwedi", role: "Admin" as const };

  if (
    (collection === "finance" || collection === "payments") &&
    !canMemberAccessFinance(actor.role)
  ) {
    return NextResponse.json(
      { error: "Forbidden: financial updates require Admin or Manager role." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) {
      return NextResponse.json({ error: "Missing record id" }, { status: 400 });
    }

    const updated = await updateRecordById(
      collection as CollectionName,
      id,
      body.updates || {},
      { id: actor.id, name: actor.name },
      body.auditMeta
    );

    if (!updated) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, record: updated });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update record", details: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return NextResponse.json(
    {
      error:
        "Complete JSON state replacement is disabled. Use granular /api/records/[collection] or /api/transactions endpoints.",
    },
    { status: 405 }
  );
}

export async function POST(req: NextRequest) {
  const collection = resolveCollectionParam(req);
  if (collection) {
    const ip = req.headers.get("x-forwarded-for") || "local";
    const rl = checkRateLimit(`rec-post:${ip}`, 120, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!VALID_COLLECTIONS.has(collection as CollectionName)) {
      return NextResponse.json(
        { error: `Invalid collection: ${collection}` },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    const actor = session
      ? { id: session.member.id, name: session.member.name, role: session.role }
      : { id: "tm-1", name: "Rajdhar Diwedi", role: "Admin" as const };

    if (
      (collection === "finance" || collection === "payments") &&
      !canMemberAccessFinance(actor.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: financial writes require Admin or Manager role." },
        { status: 403 }
      );
    }
    if (collection === "teamMembers" && !canMemberManageTeam(actor.role)) {
      return NextResponse.json(
        { error: "Forbidden: team management requires Admin or Manager role." },
        { status: 403 }
      );
    }

    try {
      const body = await req.json();
      const record = {
        ...body.record,
        id:
          body.record?.id ||
          `${collection.slice(0, 4)}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
        isDemo: false,
      };

      const created = await insertRecord(
        collection as CollectionName,
        record,
        { id: actor.id, name: actor.name },
        body.auditMeta
      );

      return NextResponse.json({ ok: true, record: created });
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to insert record", details: String(err) },
        { status: 500 }
      );
    }
  }

  const session = getSessionFromRequest(req);
  const actor = session
    ? { id: session.member.id, name: session.member.name, role: session.role }
    : { id: "tm-1", name: "Rajdhar Diwedi", role: "Admin" as const };

  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const title = (formData.get("title") as string) || "";
      const category = ((formData.get("category") as string) ||
        "Internal Documents") as DocumentCategory;
      const folder = (formData.get("folder") as string) || "General";
      const clientId = (formData.get("clientId") as string) || "";
      const projectId = (formData.get("projectId") as string) || "";
      const uploadedById = (formData.get("uploadedById") as string) || actor.id;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const slugCategory = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const storagePath = `${slugCategory}/${Date.now()}-${cleanFileName}`;

      saveUploadedFileToStorage(storagePath, buffer);

      if (isSupabaseConfigured && supabase) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: true,
          });
      }

      const db = readAgencyDb();
      const newDoc: AgencyDocument = {
        id: `doc-${Date.now()}`,
        title: title.trim() || file.name,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        storagePath,
        category,
        folder: folder.trim() || "General",
        clientId,
        projectId,
        uploadedById,
        createdAt: new Date().toISOString().slice(0, 10),
        isDemo: false,
      };

      db.documents = [newDoc, ...db.documents];
      writeAgencyDb(db);

      return NextResponse.json(newDoc);
    }

    const body = await req.json();
    const type = body.type as string;

    if (type === "convert_lead") {
      const result = convertLeadTransaction({
        leadId: body.leadId,
        servicesPurchased: body.servicesPurchased || [],
        createProject: Boolean(body.createProject),
        projectName: body.projectName,
        projectType: body.projectType,
        projectBudget: body.projectBudget,
        projectDeadline: body.projectDeadline,
        actor: { id: actor.id, name: actor.name },
      });
      if (!result) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, ...result });
    }

    if (type === "record_payment") {
      if (!canMemberAccessFinance(actor.role)) {
        return NextResponse.json(
          { error: "Forbidden: payment recording requires finance access." },
          { status: 403 }
        );
      }
      const result = recordPaymentTransaction({
        invoiceId: body.invoiceId,
        amount: Number(body.amount) || 0,
        paymentMethod: body.paymentMethod,
        notes: body.notes,
        actor: { id: actor.id, name: actor.name },
      });
      if (!result) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, ...result });
    }

    if (type === "purge_demo") {
      if (!canMemberDeleteRecords(actor.role)) {
        return NextResponse.json(
          { error: "Forbidden: only Admins/Managers can purge demo records." },
          { status: 403 }
        );
      }
      const summary = purgeDemoRecordsTransaction({
        id: actor.id,
        name: actor.name,
      });
      return NextResponse.json({ ok: true, summary });
    }

    if (type === "bulk_leads_update") {
      const ids = new Set<string>(body.ids || []);
      const updates = body.updates || {};
      const db = readAgencyDb();
      const now = `${new Date().toISOString().slice(0, 10)} ${new Date()
        .toTimeString()
        .slice(0, 5)}`;
      db.leads = db.leads.map((l) =>
        ids.has(l.id)
          ? {
              ...l,
              ...updates,
              history: [
                {
                  id: `lh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  action: `Bulk updated (${Object.keys(updates).join(", ")})`,
                  actorName: actor.name,
                  timestamp: now,
                },
                ...l.history,
              ],
            }
          : l
      );
      appendAuditAndNotification(db, {
        actorId: actor.id,
        actorName: actor.name,
        action: "edited",
        entityType: "Lead",
        entityName: `${ids.size} Leads`,
        details: `Bulk updated ${ids.size} leads.`,
      });
      writeAgencyDb(db);
      realtimeBus.emit({
        table: "leads",
        action: "UPDATE",
        actorId: actor.id,
      });
      return NextResponse.json({ ok: true, count: ids.size });
    }

    if (type === "bulk_leads_delete") {
      if (!canMemberDeleteRecords(actor.role)) {
        return NextResponse.json(
          { error: "Forbidden: delete permission required." },
          { status: 403 }
        );
      }
      const ids = new Set<string>(body.ids || []);
      const db = readAgencyDb();
      db.leads = db.leads.filter((l) => !ids.has(l.id));
      appendAuditAndNotification(db, {
        actorId: actor.id,
        actorName: actor.name,
        action: "deleted",
        entityType: "Lead",
        entityName: `${ids.size} Leads`,
        details: `Bulk deleted ${ids.size} leads.`,
      });
      writeAgencyDb(db);
      realtimeBus.emit({
        table: "leads",
        action: "DELETE",
        actorId: actor.id,
      });
      return NextResponse.json({ ok: true, count: ids.size });
    }

    if (type === "import_leads") {
      const rows = (body.rows || []) as Partial<Lead>[];
      const duplicateStrategy =
        (body.duplicateStrategy as "skip" | "update" | "create") || "skip";
      const source =
        (body.source as "CSV Upload" | "Google Sheets") || "CSV Upload";
      const sourceLabel = String(body.sourceLabel || "Batch Lead Import");

      const db = readAgencyDb();
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: { row: number; reason: string }[] = [];
      const now = `${new Date().toISOString().slice(0, 10)} ${new Date()
        .toTimeString()
        .slice(0, 5)}`;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;
        if (!r.businessName || !String(r.businessName).trim()) {
          errors.push({ row: rowNum, reason: "Missing Business Name" });
          continue;
        }
        if (r.businessEmail && !isValidEmail(r.businessEmail)) {
          errors.push({
            row: rowNum,
            reason: `Invalid email address: ${r.businessEmail}`,
          });
          continue;
        }
        if (r.websiteUrl && !isValidUrl(r.websiteUrl)) {
          errors.push({
            row: rowNum,
            reason: `Invalid website URL: ${r.websiteUrl}`,
          });
          continue;
        }

        const dup = detectLeadDuplicate(r, db.leads);
        if (dup) {
          if (duplicateStrategy === "skip") {
            skippedCount++;
            continue;
          } else if (duplicateStrategy === "update") {
            db.leads = db.leads.map((existing) =>
              existing.id === dup.existingLeadId
                ? {
                    ...existing,
                    ...r,
                    id: existing.id,
                    isDemo: false,
                    history: [
                      {
                        id: `lh-${Date.now()}-${i}`,
                        action: `Updated via ${source} (${sourceLabel})`,
                        actorName: actor.name,
                        timestamp: now,
                      },
                      ...existing.history,
                    ],
                  }
                : existing
            );
            updatedCount++;
            continue;
          }
        }

        const newLead: Lead = {
          id: `lead-${Date.now()}-${i}`,
          businessName: String(r.businessName).trim(),
          contactPerson: String(r.contactPerson || "Founder").trim(),
          industry: String(r.industry || "SaaS & Technology"),
          country: String(r.country || "United States"),
          city: String(r.city || ""),
          businessEmail: String(r.businessEmail || "").trim(),
          phoneNumber: String(r.phoneNumber || "").trim(),
          websiteUrl: String(r.websiteUrl || "").trim(),
          instagramUrl: String(r.instagramUrl || "").trim(),
          facebookUrl: String(r.facebookUrl || "").trim(),
          linkedinUrl: String(r.linkedinUrl || "").trim(),
          googleMapsUrl: String(r.googleMapsUrl || "").trim(),
          leadSource: (r.leadSource as Lead["leadSource"]) || "Other",
          businessDescription: String(r.businessDescription || ""),
          websiteStatus:
            (r.websiteStatus as Lead["websiteStatus"]) || "Outdated Website",
          rating: Number(r.rating) || 4.7,
          numberOfReviews: Number(r.numberOfReviews) || 0,
          personalizationNotes: String(r.personalizationNotes || ""),
          potentialOpportunity: String(r.potentialOpportunity || ""),
          estimatedProjectValue: Number(r.estimatedProjectValue) || 18000,
          leadPriority: (r.leadPriority as Lead["leadPriority"]) || "Medium",
          status: (r.status as Lead["status"]) || "New",
          assignedTeamMemberId: r.assignedTeamMemberId || actor.id,
          dateAdded: r.dateAdded || new Date().toISOString().slice(0, 10),
          lastContacted: r.lastContacted || "",
          nextFollowUpDate:
            r.nextFollowUpDate ||
            new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
          internalNotes: [],
          history: [
            {
              id: `lh-${Date.now()}-${i}`,
              action: `Imported via ${source} (${sourceLabel})`,
              actorName: actor.name,
              timestamp: now,
            },
          ],
          isDemo: false,
        };
        db.leads.unshift(newLead);
        createdCount++;
      }

      const importJob: ImportJobRecord = {
        id: `imp-${Date.now()}`,
        source,
        sourceLabel,
        totalRows: rows.length,
        createdCount,
        updatedCount,
        skippedCount,
        errorCount: errors.length,
        errors,
        createdByName: actor.name,
        createdAt: now,
      };
      db.importHistory = [importJob, ...(db.importHistory || [])];

      appendAuditAndNotification(db, {
        actorId: actor.id,
        actorName: actor.name,
        action: "imported",
        entityType: source,
        entityName: sourceLabel,
        details: `Created ${createdCount}, updated ${updatedCount}, skipped ${skippedCount} duplicates, ${errors.length} errors.`,
        notification: {
          type: "Import Completed",
          title: `${source}: ${createdCount} leads imported`,
          message: `${sourceLabel} — ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
          section: "leads",
        },
      });

      writeAgencyDb(db);
      realtimeBus.emit({
        table: "leads",
        action: "INSERT",
        actorId: actor.id,
      });

      return NextResponse.json({
        ok: true,
        importJob,
      });
    }

    if (type === "update_settings") {
      if (
        body.updates &&
        ("rolePermissions" in body.updates ||
          "agencyName" in body.updates ||
          "defaultCurrency" in body.updates) &&
        !canMemberManageSettings(actor.role)
      ) {
        return NextResponse.json(
          { error: "Forbidden: only Admins can modify agency settings." },
          { status: 403 }
        );
      }
      const db = readAgencyDb();
      db.settings = { ...db.settings, ...(body.updates || {}) };
      writeAgencyDb(db);
      realtimeBus.emit({
        table: "settings",
        action: "UPDATE",
        actorId: actor.id,
      });
      return NextResponse.json({ ok: true, settings: db.settings });
    }

    if (type === "mark_all_notifications_read") {
      const db = readAgencyDb();
      db.notifications = db.notifications.map((n) => ({
        ...n,
        isRead: true,
      }));
      writeAgencyDb(db);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: `Unknown transaction type: ${type}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Transaction failed", details: String(err) },
      { status: 500 }
    );
  }
}
