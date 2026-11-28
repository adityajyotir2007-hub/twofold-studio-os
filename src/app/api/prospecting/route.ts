import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { canMemberDeleteRecords, getSessionFromRequest } from "@/lib/server-auth";
import {
  bulkUpdateProspectStatus,
  checkDuplicates,
  deleteProspects,
  getCapabilities,
  getMaxImportRows,
  listProspecting,
  runImport,
  sendProspectsToCrm,
  updateProspect,
} from "@/lib/prospecting/server-store";
import {
  approveAndExecuteCampaign,
  cancelCampaignApproval,
  processConversationalTurn,
} from "@/lib/prospecting/assistant-engine";
import { PROSPECT_STATUSES } from "@/types/prospecting";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB

const ProspectStatusSchema = z.enum(
  PROSPECT_STATUSES as [
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
  ]
);

const ProspectInputFieldsSchema = z
  .object({
    businessName: z.string().max(2000).optional(),
    contactPerson: z.string().max(2000).optional(),
    website: z.string().max(2000).optional(),
    email: z.string().max(2000).optional(),
    phone: z.string().max(2000).optional(),
    instagram: z.string().max(2000).optional(),
    linkedinUrl: z.string().max(2000).optional(),
    category: z.string().max(2000).optional(),
    location: z.string().max(2000).optional(),
    country: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
    source: z.string().max(2000).optional(),
  })
  .strip();

const CheckDuplicatesSchema = z
  .object({
    action: z.literal("check_duplicates"),
    rows: z.array(ProspectInputFieldsSchema).max(getMaxImportRows()),
  })
  .strip();

const ImportSchema = z
  .object({
    action: z.literal("import"),
    idempotencyKey: z.string().min(8).max(128),
    fileName: z.string().min(1).max(255),
    fileType: z.enum(["csv", "xlsx", "xls"]),
    fileSize: z.number().int().min(1).max(5 * 1024 * 1024),
    duplicateStrategy: z.enum(["skip", "update"]),
    columnMapping: z.record(z.string(), z.string().max(200)),
    rows: z
      .array(
        z
          .object({
            rowNumber: z.number().int().min(1),
            included: z.boolean(),
            data: ProspectInputFieldsSchema,
          })
          .strip()
      )
      .min(1)
      .max(getMaxImportRows()),
  })
  .strip();

const SendToCrmSchema = z
  .object({
    action: z.literal("send_to_crm"),
    ids: z.array(z.string().min(1).max(128)).min(1).max(500),
  })
  .strip();

const BulkUpdateStatusSchema = z
  .object({
    action: z.literal("bulk_update_status"),
    ids: z.array(z.string().min(1).max(128)).min(1).max(1000),
    status: ProspectStatusSchema,
  })
  .strip();

const BulkDeleteSchema = z
  .object({
    action: z.literal("bulk_delete"),
    ids: z.array(z.string().min(1).max(128)).min(1).max(1000),
  })
  .strip();

const ChatTurnFileSchema = z
  .object({
    idempotencyKey: z.string().max(128).optional(),
    fileName: z.string().min(1).max(255),
    fileType: z.enum(["csv", "xlsx", "xls"]),
    fileSize: z.number().int().min(1).max(5 * 1024 * 1024),
    duplicateStrategy: z.enum(["skip", "update"]).default("skip"),
    columnMapping: z.record(z.string(), z.string().max(200)).default({}),
    rows: z
      .array(
        z
          .object({
            rowNumber: z.number().int().min(1),
            included: z.boolean(),
            data: ProspectInputFieldsSchema,
          })
          .strip()
      )
      .min(1)
      .max(getMaxImportRows()),
  })
  .strip();

const ChatTurnSchema = z
  .object({
    action: z.literal("chat_turn"),
    conversationId: z.string().max(128).optional(),
    prompt: z.string().max(4000).default(""),
    selectedChannels: z
      .array(z.enum(["email", "whatsapp", "instagram", "linkedin"]))
      .default(["email"]),
    files: z.array(ChatTurnFileSchema).max(5).optional(),
  })
  .strip();

const ApproveCampaignSchema = z
  .object({
    action: z.literal("approve_campaign"),
    conversationId: z.string().min(1).max(128),
    messageId: z.string().min(1).max(128),
    followUpSchedule: z.string().max(300).optional(),
    editedDrafts: z
      .array(
        z
          .object({
            prospectId: z.string().min(1).max(128),
            subject: z.string().max(500),
            body: z.string().max(5000),
            suppressed: z.boolean().optional(),
          })
          .strip()
      )
      .max(2000)
      .optional(),
  })
  .strip();

const CancelCampaignSchema = z
  .object({
    action: z.literal("cancel_campaign"),
    conversationId: z.string().min(1).max(128),
    messageId: z.string().min(1).max(128),
  })
  .strip();

const PatchSchema = z
  .object({
    id: z.string().min(1).max(128),
    patch: ProspectInputFieldsSchema.extend({
      status: ProspectStatusSchema.optional(),
      campaignId: z.string().max(128).nullable().optional(),
    }).strip(),
  })
  .strip();

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Your session has expired. Please sign in again." },
    { status: 401 }
  );
}

function checkProspectingRateLimit(memberId: string) {
  return checkRateLimit(`prospecting:${memberId}`, 60, 60_000);
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return unauthorizedResponse();

  const rl = checkProspectingRateLimit(session.member.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      { status: 429 }
    );
  }

  try {
    const { prospects, imports, conversations } = listProspecting(
      session.workspaceId
    );
    const capabilities = getCapabilities();
    return NextResponse.json({
      prospects,
      imports,
      conversations,
      capabilities,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load prospecting data",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return unauthorizedResponse();

  const rl = checkProspectingRateLimit(session.member.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      { status: 429 }
    );
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request payload exceeds the 4 MB JSON limit." },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const actor = { id: session.member.id, name: session.member.name };
  const action =
    body && typeof body === "object" && "action" in body
      ? (body as { action?: unknown }).action
      : undefined;

  try {
    if (action === "check_duplicates") {
      const parsed = CheckDuplicatesSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Invalid rows payload." },
          { status: 400 }
        );
      }
      const duplicates = checkDuplicates(session.workspaceId, parsed.data.rows);
      return NextResponse.json({ duplicates });
    }

    if (action === "import") {
      const maxRows = getMaxImportRows();
      const parsed = ImportSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message || "Invalid import request.",
          },
          { status: 400 }
        );
      }
      if (parsed.data.rows.length > maxRows) {
        return NextResponse.json(
          {
            error: `This import has ${parsed.data.rows.length} rows; the limit is ${maxRows} per import.`,
          },
          { status: 400 }
        );
      }
      const result = runImport(session.workspaceId, actor, parsed.data);
      return NextResponse.json(result);
    }

    if (action === "send_to_crm") {
      const parsed = SendToCrmSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Invalid prospect IDs." },
          { status: 400 }
        );
      }
      const result = await sendProspectsToCrm(
        session.workspaceId,
        actor,
        parsed.data.ids
      );
      if (result.conflict) {
        return NextResponse.json(
          { error: result.conflict, results: result.results },
          { status: 409 }
        );
      }
      return NextResponse.json({
        results: result.results,
        prospects: result.prospects,
      });
    }

    if (action === "bulk_update_status") {
      const parsed = BulkUpdateStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message || "Invalid status update payload.",
          },
          { status: 400 }
        );
      }
      const prospects = bulkUpdateProspectStatus(
        session.workspaceId,
        actor,
        parsed.data.ids,
        parsed.data.status
      );
      return NextResponse.json({ prospects });
    }

    if (action === "bulk_delete") {
      if (!canMemberDeleteRecords(session.role)) {
        return NextResponse.json(
          { error: "Forbidden: your role is not permitted to delete prospects." },
          { status: 403 }
        );
      }
      const parsed = BulkDeleteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Invalid delete payload." },
          { status: 400 }
        );
      }
      const resData = deleteProspects(
        session.workspaceId,
        actor,
        parsed.data.ids
      );
      return NextResponse.json(resData);
    }

    if (action === "chat_turn") {
      const parsed = ChatTurnSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid conversational request.",
          },
          { status: 400 }
        );
      }
      const result = await processConversationalTurn(
        session.workspaceId,
        actor,
        parsed.data
      );
      return NextResponse.json(result);
    }

    if (action === "approve_campaign") {
      const parsed = ApproveCampaignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid campaign approval payload.",
          },
          { status: 400 }
        );
      }
      const result = await approveAndExecuteCampaign(
        session.workspaceId,
        actor,
        parsed.data
      );
      return NextResponse.json(result);
    }

    if (action === "cancel_campaign") {
      const parsed = CancelCampaignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              "Invalid campaign cancel payload.",
          },
          { status: 400 }
        );
      }
      const result = cancelCampaignApproval(session.workspaceId, parsed.data);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Unsupported prospecting action." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Prospecting request failed.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return unauthorizedResponse();

  const rl = checkProspectingRateLimit(session.member.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid update payload." },
      { status: 400 }
    );
  }

  try {
    const updated = updateProspect(
      session.workspaceId,
      { id: session.member.id, name: session.member.name },
      parsed.data.id,
      parsed.data.patch
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Prospect not found in this workspace." },
        { status: 404 }
      );
    }
    return NextResponse.json({ prospect: updated });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update prospect.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return unauthorizedResponse();

  const rl = checkProspectingRateLimit(session.member.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      { status: 429 }
    );
  }

  if (!canMemberDeleteRecords(session.role)) {
    return NextResponse.json(
      { error: "Forbidden: your role is not permitted to delete prospects." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing prospect id." }, { status: 400 });
  }

  try {
    const resData = deleteProspects(
      session.workspaceId,
      { id: session.member.id, name: session.member.name },
      [id]
    );
    if (resData.deletedCount === 0) {
      return NextResponse.json(
        { error: "Prospect not found in this workspace." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, ...resData });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to delete prospect.",
      },
      { status: 500 }
    );
  }
}
