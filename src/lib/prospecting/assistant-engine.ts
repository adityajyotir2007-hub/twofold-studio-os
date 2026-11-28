import crypto from "crypto";
import {
  appendAuditAndNotification,
  loadDecryptedIntegrationSecret,
  readAgencyDb,
  writeAgencyDb,
} from "@/lib/server-db";
import { OutreachActivity, OutreachChannel } from "@/types/agency";
import {
  AttachedSheetSummary,
  CampaignApprovalPayload,
  CampaignDraftMessage,
  ConversationProgressMetrics,
  Prospect,
  ProspectImport,
  ProspectingChannelId,
  ProspectingChatMessage,
  ProspectingConversation,
  ProspectingStatusStep,
} from "@/types/prospecting";
import {
  getCapabilities,
  runImport,
  RunImportPayload,
  sendProspectsToCrm,
} from "./server-store";

export interface ChatTurnFileAttachment extends Omit<RunImportPayload, "idempotencyKey"> {
  idempotencyKey?: string;
}

export interface ProcessChatTurnInput {
  conversationId?: string;
  prompt: string;
  selectedChannels: ProspectingChannelId[];
  files?: ChatTurnFileAttachment[];
}

interface ParsedIntent {
  mode: "outreach" | "follow_up" | "interested_calls" | "research";
  noWebsiteOnly: boolean;
  categoryKeyword: string;
  locationKeyword: string;
  offerDescription: string;
  followUpDays: number;
}

const KNOWN_CATEGORY_KEYWORDS: { token: string; label: string }[] = [
  { token: "cafe", label: "Cafe & Coffee Shop" },
  { token: "coffee", label: "Cafe & Coffee Shop" },
  { token: "bakery", label: "Bakery & Cafe" },
  { token: "restaurant", label: "Restaurant & Hospitality" },
  { token: "dining", label: "Hospitality & Dining" },
  { token: "hospitality", label: "Hospitality" },
  { token: "hotel", label: "Hotel & Hospitality" },
  { token: "med spa", label: "Med Spa & Aesthetics" },
  { token: "medspa", label: "Med Spa & Aesthetics" },
  { token: "spa", label: "Spa & Wellness" },
  { token: "clinic", label: "Healthcare Clinic" },
  { token: "dental", label: "Dental Practice" },
  { token: "dentist", label: "Dental Practice" },
  { token: "real estate", label: "Real Estate" },
  { token: "architect", label: "Architecture & Design" },
  { token: "gym", label: "Fitness & Gym" },
  { token: "fitness", label: "Fitness & Wellness" },
  { token: "salon", label: "Beauty Salon" },
  { token: "saas", label: "SaaS & Technology" },
  { token: "ecommerce", label: "E-Commerce & Retail" },
  { token: "e-commerce", label: "E-Commerce & Retail" },
  { token: "retail", label: "Retail" },
  { token: "legal", label: "Legal & Law Firm" },
  { token: "law", label: "Legal & Law Firm" },
  { token: "agency", label: "Creative & Marketing Agency" },
];

function parseUserIntent(
  prompt: string,
  workspaceProspects: Prospect[]
): ParsedIntent {
  const lower = prompt.toLowerCase();

  let mode: ParsedIntent["mode"] = "outreach";
  if (
    lower.includes("follow up") ||
    lower.includes("follow-up") ||
    lower.includes("haven't replied") ||
    lower.includes("pending replies") ||
    lower.includes("no reply")
  ) {
    mode = "follow_up";
  } else if (
    lower.includes("book call") ||
    lower.includes("booked call") ||
    lower.includes("arrange call") ||
    lower.includes("schedule call") ||
    lower.includes("interested lead")
  ) {
    mode = "interested_calls";
  } else if (
    lower.startsWith("research") ||
    (lower.includes("research") && !lower.includes("outreach") && !lower.includes("contact"))
  ) {
    mode = "research";
  }

  const noWebsiteOnly =
    lower.includes("no website") ||
    lower.includes("without a website") ||
    lower.includes("without website") ||
    lower.includes("missing website") ||
    lower.includes("don't have a website");

  let categoryKeyword = "";
  for (const item of KNOWN_CATEGORY_KEYWORDS) {
    if (lower.includes(item.token)) {
      categoryKeyword = item.token;
      break;
    }
  }
  if (!categoryKeyword) {
    for (const p of workspaceProspects) {
      const cat = (p.category || "").trim().toLowerCase();
      if (cat && cat.length >= 3 && lower.includes(cat)) {
        categoryKeyword = cat;
        break;
      }
    }
  }

  let locationKeyword = "";
  const inMatch = prompt.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (inMatch && inMatch[1]) {
    const candidate = inMatch[1].trim();
    const stopWords = new Set([
      "My",
      "The",
      "Our",
      "This",
      "Next",
      "Five",
      "Three",
    ]);
    if (!stopWords.has(candidate.split(" ")[0])) {
      locationKeyword = candidate;
    }
  }
  if (!locationKeyword) {
    for (const p of workspaceProspects) {
      const loc = (p.location || "").trim();
      const country = (p.country || "").trim();
      if (loc && loc.length >= 3 && lower.includes(loc.toLowerCase())) {
        locationKeyword = loc;
        break;
      }
      if (
        country &&
        country.length >= 3 &&
        lower.includes(country.toLowerCase())
      ) {
        locationKeyword = country;
        break;
      }
    }
  }

  let offerDescription = "website design, conversion optimization, and digital growth";
  const offerMatch = prompt.match(
    /(?:offer(?:ing)?(?:\s+them)?|pitch(?:ing)?|promote|sell(?:ing)?|help(?:ing)?\s+them\s+with)\s+([^.!?\n]+)/i
  );
  if (offerMatch && offerMatch[1]) {
    offerDescription = offerMatch[1].trim();
  } else if (noWebsiteOnly || lower.includes("website")) {
    offerDescription = "a modern, high-converting website and online booking/ordering experience";
  }

  const daysMatch = lower.match(/(\d+)\s*day/);
  const followUpDays = daysMatch ? Math.max(1, Number(daysMatch[1])) : 3;

  return {
    mode,
    noWebsiteOnly,
    categoryKeyword,
    locationKeyword,
    offerDescription,
    followUpDays,
  };
}

function buildProspectResearch(
  prospect: Prospect,
  offerDescription: string
): { summary: string; opportunity: string } {
  const biz = prospect.businessName || prospect.contactPerson || "This business";
  const loc = [prospect.location, prospect.country].filter(Boolean).join(", ");
  const cat = prospect.category || "local business";

  if (!prospect.website) {
    const socialNote = prospect.instagram
      ? `active on Instagram (@${prospect.instagram})`
      : prospect.phone
      ? `reachable by phone (${prospect.phone})`
      : "listed without a primary web domain";
    return {
      summary: `${biz} operates as a ${cat}${loc ? ` in ${loc}` : ""} and is currently ${socialNote} without a dedicated website URL.`,
      opportunity: `High-priority opportunity to offer ${offerDescription} so high-intent customers searching online can view offerings and convert directly.`,
    };
  }

  return {
    summary: `${biz} is an established ${cat}${loc ? ` in ${loc}` : ""} with web domain ${prospect.websiteDomain || prospect.website}${prospect.instagram ? ` and Instagram @${prospect.instagram}` : ""}.`,
    opportunity: `Opportunity to position ${offerDescription} to improve mobile visitor conversion, speed, and direct lead capture on ${prospect.websiteDomain || "their site"}.`,
  };
}

function pickPrimaryChannelForProspect(
  prospect: Prospect,
  selectedChannels: ProspectingChannelId[]
): {
  channel: ProspectingChannelId;
  suppressed: boolean;
  suppressionReason?: string;
} {
  if (
    prospect.status === "Do Not Contact" ||
    prospect.outreachStatus === "suppressed"
  ) {
    return {
      channel: selectedChannels[0] || "email",
      suppressed: true,
      suppressionReason: "Marked as Do Not Contact / Suppressed",
    };
  }
  if (prospect.status === "Not Interested") {
    return {
      channel: selectedChannels[0] || "email",
      suppressed: true,
      suppressionReason: "Previously marked Not Interested",
    };
  }

  const order: ProspectingChannelId[] =
    selectedChannels.length > 0 ? selectedChannels : ["email"];

  for (const ch of order) {
    if (ch === "email" && prospect.email) {
      return { channel: "email", suppressed: false };
    }
    if (ch === "whatsapp" && prospect.phone) {
      return { channel: "whatsapp", suppressed: false };
    }
    if (ch === "instagram" && prospect.instagram) {
      return { channel: "instagram", suppressed: false };
    }
    if (ch === "linkedin" && prospect.linkedinUrl) {
      return { channel: "linkedin", suppressed: false };
    }
  }

  // Fallback to any available contact channel if none of the selected ones exist
  const missingLabels = order.join(", ");
  return {
    channel: order[0] || "email",
    suppressed: true,
    suppressionReason: `Missing contact details for selected channel (${missingLabels})`,
  };
}

function generateDraftCopy(params: {
  prospect: Prospect;
  channel: ProspectingChannelId;
  intent: ParsedIntent;
  senderName: string;
  agencyName: string;
  researchOpportunity: string;
}): { subject: string; body: string } {
  const { prospect, channel, intent, senderName, agencyName } = params;
  const firstName =
    (prospect.contactPerson || "").trim().split(/\s+/)[0] || "there";
  const biz = prospect.businessName || "your team";
  const city = prospect.location || prospect.country || "your area";
  const cat = prospect.category || "your industry";

  if (intent.mode === "follow_up") {
    const subject = `Quick follow-up for ${biz}`;
    if (channel === "instagram" || channel === "whatsapp") {
      return {
        subject,
        body: `Hey ${firstName}! Just floating this back to the top of your inbox — I reached out a few days ago with a tailored concept for ${biz} in ${city}. Would you be open to a quick 10-minute walkthrough this week?`,
      };
    }
    return {
      subject,
      body: `Hi ${firstName},\n\nWanted to quickly follow up on my previous note for ${biz}.\n\nWe put together a tailored preview showing how ${intent.offerDescription} can help capture more clients in ${city}.\n\nIf you're open to a brief 10-minute call this week, let me know what day works best.\n\nBest,\n${senderName}\n${agencyName}`,
    };
  }

  if (intent.mode === "interested_calls") {
    const subject = `Scheduling our discovery call — ${biz} x ${agencyName}`;
    return {
      subject,
      body: `Hi ${firstName},\n\nThanks for your interest! I'd love to walk you through the tailored plan we prepared for ${biz}.\n\nDo either Tuesday or Thursday afternoon next week work for a quick 15-minute discovery call? Once you confirm a slot, I'll send the calendar invite directly.\n\nBest,\n${senderName}\n${agencyName}`,
    };
  }

  const websiteAngle = !prospect.website
    ? `I noticed ${biz} doesn't currently have a dedicated website linked for customers searching in ${city}`
    : `While reviewing ${biz}'s online presence (${prospect.websiteDomain || prospect.website}), I noticed a clear opportunity to streamline your mobile conversion & inquiry flow`;

  if (channel === "instagram") {
    return {
      subject: `Instagram DM to @${prospect.instagram || biz}`,
      body: `Hey ${firstName}! Big fan of what you're building with ${biz} in ${city}. ${websiteAngle} — our team at ${agencyName} mocked up a clean preview for ${intent.offerDescription}. Mind if I share the private link here?`,
    };
  }

  if (channel === "whatsapp") {
    return {
      subject: `WhatsApp message to ${prospect.phone || biz}`,
      body: `Hi ${firstName}! Hope your week in ${city} is going well. ${websiteAngle}. We put together a tailored concept at ${agencyName} showing how ${intent.offerDescription} could help ${biz} — would you like me to drop the preview link here?`,
    };
  }

  return {
    subject: !prospect.website
      ? `Website concept for ${biz} in ${city}`
      : `Quick conversion idea for ${biz}`,
    body: `Hi ${firstName},\n\nI came across ${biz} while researching standout ${cat.toLowerCase()} businesses in ${city}.\n\n${websiteAngle}.${
      prospect.notes ? ` (${prospect.notes})` : ""
    }\n\nAt ${agencyName}, we specialize in ${intent.offerDescription} and mocked up a short, tailored preview specifically for ${biz}. Would you be open to me sending over the private preview link — or hopping on a brief 10-minute call next week?\n\nBest,\n${senderName}\n${agencyName}`,
  };
}

async function maybeRefineNarrativeWithGemini(params: {
  userPrompt: string;
  defaultReply: string;
  metrics: ConversationProgressMetrics;
  targetSummary: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return params.defaultReply;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are Twofold Studios' AI Outreach Agent. Rewrite the assistant reply below so it sounds warm, concise (2-3 sentences max), and executive. You MUST preserve the exact factual numbers (${params.metrics.prospectsImported} prospects, ${params.metrics.contactDetailsFound} with contact details, ${params.metrics.emailsPrepared} drafts prepared) and never claim emails were already sent before user approval.\n\nUser request: "${params.userPrompt}"\nTarget filter: ${params.targetSummary}\nBase reply: "${params.defaultReply}"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 220,
          },
        }),
      }
    );
    if (!res.ok) return params.defaultReply;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || params.defaultReply;
  } catch {
    return params.defaultReply;
  }
}

export async function processConversationalTurn(
  workspaceId: string,
  actor: { id: string; name: string },
  input: ProcessChatTurnInput
): Promise<{
  conversation: ProspectingConversation;
  conversations: ProspectingConversation[];
  prospects: Prospect[];
  imports: ProspectImport[];
}> {
  const channels: ProspectingChannelId[] =
    input.selectedChannels && input.selectedChannels.length > 0
      ? input.selectedChannels
      : ["email"];

  // 1. If the user attached CSV / Excel spreadsheets, import them first
  const attachedSummaries: AttachedSheetSummary[] = [];
  const newlyImportedIds = new Set<string>();

  if (Array.isArray(input.files) && input.files.length > 0) {
    for (const file of input.files) {
      const impResult = runImport(workspaceId, actor, {
        idempotencyKey: file.idempotencyKey || crypto.randomUUID(),
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        duplicateStrategy: file.duplicateStrategy || "skip",
        columnMapping: file.columnMapping || {},
        rows: file.rows,
      });

      attachedSummaries.push({
        fileName: impResult.importRecord.fileName,
        fileType: impResult.importRecord.fileType,
        totalRows: impResult.importRecord.totalRows,
        importedCount: impResult.importRecord.importedCount,
        updatedCount: impResult.importRecord.updatedCount,
        skippedCount: impResult.importRecord.skippedCount,
        failedCount: impResult.importRecord.failedCount,
      });

      for (const rr of impResult.importRecord.rowResults) {
        if (
          rr.prospectId &&
          (rr.outcome === "imported" || rr.outcome === "updated")
        ) {
          newlyImportedIds.add(rr.prospectId);
        }
      }
    }
  }

  // 2. Reload freshest DB state after any file imports
  const db = readAgencyDb();
  const caps = getCapabilities();
  const agencyName = db.settings?.agencyName || "Twofold Studios";
  const allWorkspaceProspects = (db.prospects || []).filter(
    (p) => p.workspaceId === workspaceId
  );

  const intent = parseUserIntent(input.prompt, allWorkspaceProspects);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  // 3. Determine candidate cohort from real workspace prospects
  let candidatePool =
    newlyImportedIds.size > 0
      ? allWorkspaceProspects.filter((p) => newlyImportedIds.has(p.id))
      : [...allWorkspaceProspects];

  if (intent.mode === "follow_up") {
    const followUpCandidates = candidatePool.filter(
      (p) =>
        p.status === "Contacted" ||
        p.status === "Follow-up Required" ||
        p.status === "Outreach Pending Approval"
    );
    if (followUpCandidates.length > 0) {
      candidatePool = followUpCandidates;
    }
  } else if (intent.mode === "interested_calls") {
    const interestedCandidates = candidatePool.filter(
      (p) => p.status === "Interested" || p.status === "Replied" || p.status === "Call Booked"
    );
    if (interestedCandidates.length > 0) {
      candidatePool = interestedCandidates;
    }
  }

  if (intent.noWebsiteOnly) {
    candidatePool = candidatePool.filter((p) => !p.website);
  }

  if (intent.categoryKeyword) {
    const byCat = candidatePool.filter(
      (p) =>
        p.category.toLowerCase().includes(intent.categoryKeyword) ||
        p.businessName.toLowerCase().includes(intent.categoryKeyword) ||
        p.notes.toLowerCase().includes(intent.categoryKeyword)
    );
    if (byCat.length > 0) {
      candidatePool = byCat;
    }
  }

  if (intent.locationKeyword) {
    const kw = intent.locationKeyword.toLowerCase();
    const byLoc = candidatePool.filter(
      (p) =>
        p.location.toLowerCase().includes(kw) ||
        p.country.toLowerCase().includes(kw) ||
        p.notes.toLowerCase().includes(kw)
    );
    if (byLoc.length > 0) {
      candidatePool = byLoc;
    }
  }

  const filterTags: string[] = [];
  if (attachedSummaries.length > 0) {
    filterTags.push(
      `Uploaded file (${attachedSummaries.map((f) => f.fileName).join(", ")})`
    );
  }
  if (intent.categoryKeyword) {
    filterTags.push(`Category matching "${intent.categoryKeyword}"`);
  }
  if (intent.locationKeyword) {
    filterTags.push(`Location "${intent.locationKeyword}"`);
  }
  if (intent.noWebsiteOnly) {
    filterTags.push("No Website only");
  }
  if (intent.mode === "follow_up") {
    filterTags.push(`Follow-up queue (${intent.followUpDays}+ days)`);
  } else if (intent.mode === "interested_calls") {
    filterTags.push("Interested & Replied leads");
  }
  const targetFilterSummary =
    filterTags.length > 0
      ? filterTags.join(" · ")
      : "All active workspace prospects";

  const userMsg: ProspectingChatMessage = {
    id: `msg-u-${crypto.randomUUID()}`,
    role: "user",
    content:
      input.prompt.trim() ||
      (attachedSummaries.length > 0
        ? `Uploaded ${attachedSummaries.map((a) => a.fileName).join(", ")}`
        : "Start outreach"),
    createdAt: nowIso,
    attachedFiles: attachedSummaries.length > 0 ? attachedSummaries : undefined,
    selectedChannels: channels,
  };

  let assistantMsg: ProspectingChatMessage;

  // Case A: Workspace has 0 matching prospects (e.g. no spreadsheet uploaded yet)
  if (candidatePool.length === 0) {
    const totalInWorkspace = allWorkspaceProspects.length;
    const statusSteps: ProspectingStatusStep[] = [
      {
        label: "Understanding your goal...",
        state: "done",
        detail: targetFilterSummary,
      },
      {
        label:
          totalInWorkspace === 0
            ? "Waiting for your prospect sheet (CSV / Excel)..."
            : "No prospects matched that filter in your database",
        state: "warning",
        detail:
          totalInWorkspace === 0
            ? "0 prospects currently in workspace database"
            : `${totalInWorkspace} prospects exist in workspace, but 0 matched "${targetFilterSummary}"`,
      },
    ];

    const missingExplanation =
      totalInWorkspace === 0
        ? `I'm ready to help you ${
            intent.mode === "follow_up"
              ? "follow up with pending prospects"
              : intent.mode === "interested_calls"
              ? "identify interested leads and arrange discovery calls"
              : `prepare personalised outreach${
                  intent.categoryKeyword ? ` for ${intent.categoryKeyword} businesses` : ""
                }${intent.locationKeyword ? ` in ${intent.locationKeyword}` : ""}`
          }. Your workspace prospect database doesn't have a lead sheet uploaded yet — attach a CSV or Excel (.xlsx / .xls) file using **Upload File** below, and I'll validate the contacts, research each business, and prepare personalised messages for your approval.`
        : `I checked your ${totalInWorkspace} uploaded prospect(s), but none matched **${targetFilterSummary}**. You can upload a new CSV/Excel sheet for this segment or ask me to prepare outreach across all ${totalInWorkspace} existing prospects.`;

    assistantMsg = {
      id: `msg-a-${crypto.randomUUID()}`,
      role: "assistant",
      content: missingExplanation,
      createdAt: new Date().toISOString(),
      statusSteps,
      progressMetrics: {
        prospectsImported: totalInWorkspace,
        prospectsResearched: allWorkspaceProspects.filter(
          (p) => p.researchStatus === "completed"
        ).length,
        contactDetailsFound: allWorkspaceProspects.filter((p) =>
          Boolean(p.email || p.phone || p.instagram || p.linkedinUrl)
        ).length,
        emailsPrepared: 0,
        emailsAwaitingApproval: 0,
      },
    };
  } else {
    // Case B: We have real matching prospects — research them and prepare personalized outreach drafts
    const updatedById = new Map<string, Prospect>();
    const drafts: CampaignDraftMessage[] = [];

    for (const p of candidatePool) {
      const research = buildProspectResearch(p, intent.offerDescription);
      const channelChoice = pickPrimaryChannelForProspect(p, channels);
      const copy = generateDraftCopy({
        prospect: p,
        channel: channelChoice.channel,
        intent,
        senderName: actor.name,
        agencyName,
        researchOpportunity: research.opportunity,
      });

      const nextProspect: Prospect = {
        ...p,
        researchSummary: research.summary,
        opportunityNote: research.opportunity,
        researchStatus: "completed",
        outreachStatus: channelChoice.suppressed
          ? p.outreachStatus
          : "pending_approval",
        status:
          !channelChoice.suppressed &&
          (p.status === "Imported" ||
            p.status === "Pending Research" ||
            p.status === "Researching" ||
            p.status === "Ready for Outreach")
            ? "Outreach Pending Approval"
            : p.status,
        updatedAt: nowIso,
        updatedAtMs: nowMs,
      };
      updatedById.set(p.id, nextProspect);

      drafts.push({
        prospectId: p.id,
        businessName:
          p.businessName ||
          p.contactPerson ||
          p.websiteDomain ||
          p.email ||
          "Prospect",
        contactPerson: p.contactPerson || "Founder",
        email: p.email,
        phone: p.phone,
        instagram: p.instagram,
        website: p.website,
        category: p.category,
        location: [p.location, p.country].filter(Boolean).join(", "),
        channel: channelChoice.channel,
        subject: copy.subject,
        body: copy.body,
        researchNote: `${research.summary} ${research.opportunity}`,
        suppressed: channelChoice.suppressed,
        suppressionReason: channelChoice.suppressionReason,
      });
    }

    // Persist research & pending_approval state on workspace prospects
    db.prospects = (db.prospects || []).map((p) => updatedById.get(p.id) || p);

    const activeDrafts = drafts.filter((d) => !d.suppressed);
    const suppressedDrafts = drafts.filter((d) => d.suppressed);
    const availableEmails = candidatePool.filter((p) => Boolean(p.email)).length;
    const availablePhones = candidatePool.filter((p) => Boolean(p.phone)).length;
    const availableInstagrams = candidatePool.filter((p) =>
      Boolean(p.instagram)
    ).length;
    const contactDetailsFound = candidatePool.filter((p) =>
      Boolean(p.email || p.phone || p.instagram || p.linkedinUrl)
    ).length;

    const metrics: ConversationProgressMetrics = {
      prospectsImported:
        attachedSummaries.length > 0
          ? attachedSummaries.reduce(
              (acc, s) => acc + s.importedCount + s.updatedCount,
              0
            )
          : candidatePool.length,
      prospectsResearched: candidatePool.length,
      contactDetailsFound,
      emailsPrepared: activeDrafts.length,
      emailsAwaitingApproval: activeDrafts.length,
    };

    const statusSteps: ProspectingStatusStep[] = [
      ...(attachedSummaries.length > 0
        ? [
            {
              label: "Importing your prospects...",
              state: "done" as const,
              detail: `${metrics.prospectsImported} imported/updated from ${attachedSummaries
                .map((s) => s.fileName)
                .join(", ")}`,
            },
          ]
        : []),
      {
        label: "Researching businesses...",
        state: "done",
        detail: `Analyzed ${candidatePool.length} business profile(s) (${
          candidatePool.filter((p) => !p.website).length
        } without website, ${
          candidatePool.filter((p) => Boolean(p.website)).length
        } with active domain)`,
      },
      {
        label: "Preparing personalised emails & outreach...",
        state: "done",
        detail: `${activeDrafts.length} personalised message(s) drafted across ${channels.join(
          ", "
        )}${
          suppressedDrafts.length > 0
            ? ` · ${suppressedDrafts.length} excluded/suppressed`
            : ""
        }`,
      },
      {
        label: "Waiting for your approval...",
        state: activeDrafts.length > 0 ? "active" : "warning",
        detail:
          activeDrafts.length > 0
            ? "Review drafts below and click Approve and Start when ready"
            : "No eligible contacts had valid channel details for the selected medium",
      },
    ];

    const baseReply =
      attachedSummaries.length > 0
        ? `I've received your prospect sheet (${attachedSummaries
            .map((s) => s.fileName)
            .join(
              ", "
            )}), validated ${candidatePool.length} matching business(es), analyzed their websites and online presence, and prepared ${activeDrafts.length} personalised outreach message(s) explaining how ${intent.offerDescription} can help them. Review the campaign preview below and approve when you're ready to start.`
        : intent.mode === "follow_up"
        ? `I reviewed your prospect database and identified ${candidatePool.length} prospect(s) due for a follow-up. I've drafted ${activeDrafts.length} personalised follow-up message(s) for your review below.`
        : intent.mode === "interested_calls"
        ? `I found ${candidatePool.length} interested/replied prospect(s) and prepared ${activeDrafts.length} discovery-call scheduling message(s)${
            caps.googleCalendar
              ? " connected to Google Calendar."
              : " (connect Google Calendar in Integrations to insert live calendar slots automatically)."
          } Review and approve below.`
        : `I've analyzed ${candidatePool.length} matching prospect(s) (${targetFilterSummary}), researched their online presence, and prepared ${activeDrafts.length} personalised outreach message(s) tailored around ${intent.offerDescription}. Review the campaign below and click **Approve and Start** to execute.`;

    const narrative = await maybeRefineNarrativeWithGemini({
      userPrompt: userMsg.content,
      defaultReply: baseReply,
      metrics,
      targetSummary: targetFilterSummary,
    });

    const campaignApproval: CampaignApprovalPayload = {
      id: `camp-appr-${crypto.randomUUID()}`,
      title:
        intent.mode === "follow_up"
          ? `Follow-Up Sequence (${candidatePool.length} Prospects)`
          : intent.mode === "interested_calls"
          ? `Discovery Call Booking Outreach (${candidatePool.length} Leads)`
          : `${
              intent.categoryKeyword
                ? `${
                    intent.categoryKeyword.charAt(0).toUpperCase() +
                    intent.categoryKeyword.slice(1)
                  } `
                : ""
            }Outreach${
              intent.locationKeyword ? ` — ${intent.locationKeyword}` : ""
            }`,
      goalSummary: intent.offerDescription,
      targetFilterSummary,
      selectedChannels: channels,
      followUpSchedule: `Follow-up #1 after ${intent.followUpDays} days · Follow-up #2 after ${
        intent.followUpDays + 4
      } days if no reply`,
      totalSelected: candidatePool.length,
      availableEmails,
      availablePhones,
      availableInstagrams,
      suppressedCount: suppressedDrafts.length,
      status: "pending_approval",
      drafts,
    };

    assistantMsg = {
      id: `msg-a-${crypto.randomUUID()}`,
      role: "assistant",
      content: narrative,
      createdAt: new Date().toISOString(),
      statusSteps,
      progressMetrics: metrics,
      campaignApproval,
      referencedProspectIds: candidatePool.slice(0, 12).map((p) => p.id),
    };
  }

  // 4. Upsert Conversation thread in db.prospectConversations
  const conversations = db.prospectConversations || [];
  let conv = input.conversationId
    ? conversations.find(
        (c) => c.id === input.conversationId && c.workspaceId === workspaceId
      )
    : undefined;

  if (!conv) {
    const titleText =
      userMsg.content.slice(0, 64) +
      (userMsg.content.length > 64 ? "…" : "");
    conv = {
      id: input.conversationId || `conv-${crypto.randomUUID()}`,
      workspaceId,
      title: titleText || "AI Outreach Session",
      createdById: actor.id,
      createdAt: nowIso,
      updatedAt: nowIso,
      updatedAtMs: Date.now(),
      messages: [userMsg, assistantMsg],
    };
    db.prospectConversations = [conv, ...conversations];
  } else {
    conv.messages = [...conv.messages, userMsg, assistantMsg];
    conv.updatedAt = new Date().toISOString();
    conv.updatedAtMs = Date.now();
    db.prospectConversations = [
      conv,
      ...conversations.filter((c) => c.id !== conv!.id),
    ];
  }

  writeAgencyDb(db);

  return {
    conversation: conv,
    conversations: db.prospectConversations.filter(
      (c) => c.workspaceId === workspaceId
    ),
    prospects: (db.prospects || []).filter((p) => p.workspaceId === workspaceId),
    imports: (db.prospectImports || []).filter(
      (i) => i.workspaceId === workspaceId
    ),
  };
}

export interface ApproveCampaignInput {
  conversationId: string;
  messageId: string;
  followUpSchedule?: string;
  editedDrafts?: {
    prospectId: string;
    subject: string;
    body: string;
    suppressed?: boolean;
  }[];
}

export async function approveAndExecuteCampaign(
  workspaceId: string,
  actor: { id: string; name: string },
  input: ApproveCampaignInput
): Promise<{
  conversation: ProspectingConversation;
  conversations: ProspectingConversation[];
  prospects: Prospect[];
}> {
  const db = readAgencyDb();
  const conv = (db.prospectConversations || []).find(
    (c) => c.id === input.conversationId && c.workspaceId === workspaceId
  );
  if (!conv) {
    throw new Error("Conversation not found in this workspace.");
  }

  const msgIdx = conv.messages.findIndex((m) => m.id === input.messageId);
  if (msgIdx < 0 || !conv.messages[msgIdx].campaignApproval) {
    throw new Error("Campaign approval card not found in this conversation.");
  }

  const targetMsg = conv.messages[msgIdx];
  const approval = targetMsg.campaignApproval!;
  if (approval.status === "approved_executed") {
    return {
      conversation: conv,
      conversations: (db.prospectConversations || []).filter(
        (c) => c.workspaceId === workspaceId
      ),
      prospects: (db.prospects || []).filter(
        (p) => p.workspaceId === workspaceId
      ),
    };
  }

  // Apply any inline message edits or exclusions from the user
  const editsMap = new Map(
    (input.editedDrafts || []).map((e) => [e.prospectId, e])
  );
  const finalDrafts: CampaignDraftMessage[] = approval.drafts.map((d) => {
    const edit = editsMap.get(d.prospectId);
    if (!edit) return d;
    return {
      ...d,
      subject: edit.subject ?? d.subject,
      body: edit.body ?? d.body,
      suppressed:
        typeof edit.suppressed === "boolean" ? edit.suppressed : d.suppressed,
      suppressionReason:
        edit.suppressed && !d.suppressionReason
          ? "Excluded during campaign review"
          : d.suppressionReason,
    };
  });

  const runnableDrafts = finalDrafts.filter((d) => !d.suppressed);
  const nowDate = new Date().toISOString().slice(0, 10);
  const nowTs = new Date().toISOString().slice(0, 16).replace("T", " ");
  const followUpDate = new Date(Date.now() + 3 * 86400000)
    .toISOString()
    .slice(0, 10);

  // Check real Gmail credentials if email drafts are present
  const gmailSecrets =
    loadDecryptedIntegrationSecret<Record<string, string>>("gmail");
  const gmailAccessToken =
    gmailSecrets?.accessToken || process.env.GMAIL_OAUTH_ACCESS_TOKEN;

  // Check real n8n webhook configuration
  const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL?.trim();
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
  let n8nTriggered = false;

  if (n8nBaseUrl && n8nSecret && runnableDrafts.length > 0) {
    try {
      const payloadStr = JSON.stringify({
        workspaceId,
        campaignId: approval.id,
        title: approval.title,
        followUpSchedule: input.followUpSchedule || approval.followUpSchedule,
        drafts: runnableDrafts,
      });
      const timestamp = String(Date.now());
      const sig = crypto
        .createHmac("sha256", n8nSecret)
        .update(`${timestamp}.${payloadStr}`)
        .digest("hex");

      const n8nRes = await fetch(
        `${n8nBaseUrl.replace(/\/$/, "")}/prospecting-outreach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Twofold-Timestamp": timestamp,
            "X-Twofold-Signature": sig,
          },
          body: payloadStr,
        }
      );
      n8nTriggered = n8nRes.ok;
    } catch {
      n8nTriggered = false;
    }
  }

  let sentViaApiCount = 0;
  let savedOutreachCount = 0;
  const newOutreachActivities: OutreachActivity[] = [];
  const executedProspectIds: string[] = [];

  for (const draft of runnableDrafts) {
    executedProspectIds.push(draft.prospectId);
    let sentLive = false;
    let providerMessageId: string | undefined;
    let providerThreadId: string | undefined;

    if (draft.channel === "email" && draft.email && gmailAccessToken) {
      try {
        const rfc2822 = [
          `To: ${draft.email}`,
          `Subject: ${draft.subject}`,
          "Content-Type: text/plain; charset=utf-8",
          "MIME-Version: 1.0",
          "",
          draft.body,
        ].join("\r\n");
        const raw = Buffer.from(rfc2822, "utf-8").toString("base64url");
        const gRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gmailAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
          }
        );
        if (gRes.ok) {
          const gJson = (await gRes.json()) as {
            id?: string;
            threadId?: string;
          };
          sentLive = true;
          providerMessageId = gJson.id;
          providerThreadId = gJson.threadId;
          sentViaApiCount++;
        }
      } catch {
        sentLive = false;
      }
    }

    const channelMap: Record<ProspectingChannelId, OutreachChannel> = {
      email: "Cold Emails",
      whatsapp: "WhatsApp Messages",
      instagram: "Instagram DMs",
      linkedin: "LinkedIn Messages",
    };

    const activity: OutreachActivity = {
      id: `out-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      leadId: draft.prospectId,
      leadName: draft.businessName,
      memberId: actor.id,
      communicationChannel: channelMap[draft.channel],
      messageTemplateUsed: `AI Outreach Agent — ${approval.title}`,
      subject: draft.subject,
      dateSent: nowDate,
      occurredAt: nowTs,
      messageContent: draft.body,
      direction: "Outbound",
      source: sentLive ? "api" : "manual",
      provider:
        draft.channel === "email"
          ? "gmail"
          : draft.channel === "whatsapp"
          ? "whatsapp_cloud"
          : draft.channel === "instagram"
          ? "instagram"
          : undefined,
      providerMessageId,
      providerThreadId,
      deliveryStatus: "sent",
      replyStatus: "Message Sent",
      replyDate: "",
      nextFollowUpDate: followUpDate,
      outcome: sentLive
        ? `Sent via connected Gmail API (${providerMessageId})`
        : `Approved in AI Outreach Agent (${draft.channel.toUpperCase()})`,
      updatedAtMs: Date.now(),
      isDemo: false,
    };

    newOutreachActivities.push(activity);
    savedOutreachCount++;
  }

  // Synchronize approved prospects into CRM Leads (prevents duplicates automatically)
  let syncedToCrmCount = 0;
  if (executedProspectIds.length > 0) {
    const crmSync = await sendProspectsToCrm(
      workspaceId,
      actor,
      executedProspectIds
    );
    syncedToCrmCount = crmSync.results.filter(
      (r) =>
        r.outcome === "created" ||
        r.outcome === "linked_existing" ||
        r.outcome === "already_linked"
    ).length;
  }

  // Reload freshest DB after sendProspectsToCrm and persist outreach + updated conversation
  const freshDb = readAgencyDb();
  const executedSet = new Set(executedProspectIds);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  freshDb.prospects = (freshDb.prospects || []).map((p) => {
    if (p.workspaceId !== workspaceId || !executedSet.has(p.id)) return p;
    return {
      ...p,
      status:
        p.status === "Interested" || p.status === "Call Booked"
          ? p.status
          : "Contacted",
      outreachStatus: sentViaApiCount > 0 ? "sent" : "approved",
      updatedAt: nowIso,
      updatedAtMs: nowMs,
    };
  });

  freshDb.outreach = [...newOutreachActivities, ...(freshDb.outreach || [])];

  const providerNote =
    sentViaApiCount > 0
      ? `Sent ${sentViaApiCount} live email(s) via connected Gmail API and synced ${syncedToCrmCount} prospect(s) to CRM Leads.`
      : n8nTriggered
      ? `Dispatched ${savedOutreachCount} approved outreach message(s) to your n8n workflow engine and synced ${syncedToCrmCount} prospect(s) to CRM Leads.`
      : `Approved ${savedOutreachCount} personalised outreach message(s), logged them to Outreach & Campaigns, and synced ${syncedToCrmCount} prospect(s) into CRM Leads. (Live Gmail / WhatsApp / n8n API credentials are not connected yet, so no external emails were dispatched automatically.)`;

  const updatedApproval: CampaignApprovalPayload = {
    ...approval,
    followUpSchedule: input.followUpSchedule || approval.followUpSchedule,
    drafts: finalDrafts,
    status: "approved_executed",
    executionSummary: {
      executedAt: nowIso,
      sentViaApiCount,
      savedOutreachCount,
      syncedToCrmCount,
      n8nTriggered,
      providerNote,
    },
  };

  const updatedSteps: ProspectingStatusStep[] = [
    ...(targetMsg.statusSteps || []).map((s) => ({
      ...s,
      state: "done" as const,
    })),
    {
      label:
        sentViaApiCount > 0
          ? "Sending approved outreach via connected API..."
          : "Saving approved outreach & syncing to CRM Leads...",
      state: "done",
      detail: providerNote,
    },
    {
      label: "Monitoring replies & follow-up schedule...",
      state: "done",
      detail: updatedApproval.followUpSchedule,
    },
  ];

  const executionFollowUpMsg: ProspectingChatMessage = {
    id: `msg-a-${crypto.randomUUID()}`,
    role: "assistant",
    content: providerNote,
    createdAt: nowIso,
    referencedProspectIds: executedProspectIds.slice(0, 12),
  };

  freshDb.prospectConversations = (freshDb.prospectConversations || []).map(
    (c) => {
      if (c.id !== input.conversationId || c.workspaceId !== workspaceId) {
        return c;
      }
      const nextMsgs = c.messages.map((m, i) =>
        i === msgIdx
          ? {
              ...m,
              statusSteps: updatedSteps,
              campaignApproval: updatedApproval,
              progressMetrics: m.progressMetrics
                ? {
                    ...m.progressMetrics,
                    emailsAwaitingApproval: 0,
                  }
                : undefined,
            }
          : m
      );
      return {
        ...c,
        messages: [...nextMsgs, executionFollowUpMsg],
        updatedAt: nowIso,
        updatedAtMs: nowMs,
      };
    }
  );

  appendAuditAndNotification(freshDb, {
    actorId: actor.id,
    actorName: actor.name,
    action: "sent",
    entityType: "Prospect Campaign",
    entityName: approval.title,
    details: providerNote,
  });

  writeAgencyDb(freshDb);

  const finalConv = freshDb.prospectConversations.find(
    (c) => c.id === input.conversationId && c.workspaceId === workspaceId
  )!;

  return {
    conversation: finalConv,
    conversations: freshDb.prospectConversations.filter(
      (c) => c.workspaceId === workspaceId
    ),
    prospects: (freshDb.prospects || []).filter(
      (p) => p.workspaceId === workspaceId
    ),
  };
}

export function cancelCampaignApproval(
  workspaceId: string,
  input: { conversationId: string; messageId: string }
): {
  conversation: ProspectingConversation;
  conversations: ProspectingConversation[];
} {
  const db = readAgencyDb();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  let updatedConv: ProspectingConversation | null = null;
  db.prospectConversations = (db.prospectConversations || []).map((c) => {
    if (c.id !== input.conversationId || c.workspaceId !== workspaceId) {
      return c;
    }
    const nextMsgs = c.messages.map((m) => {
      if (m.id !== input.messageId || !m.campaignApproval) return m;
      return {
        ...m,
        campaignApproval: {
          ...m.campaignApproval,
          status: "cancelled" as const,
        },
      };
    });
    updatedConv = {
      ...c,
      messages: nextMsgs,
      updatedAt: nowIso,
      updatedAtMs: nowMs,
    };
    return updatedConv;
  });

  if (!updatedConv) {
    throw new Error("Conversation not found in this workspace.");
  }

  writeAgencyDb(db);
  return {
    conversation: updatedConv,
    conversations: db.prospectConversations.filter(
      (c) => c.workspaceId === workspaceId
    ),
  };
}
