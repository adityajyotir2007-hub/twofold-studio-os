"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  autoMapColumns,
  EMPTY_PROSPECT_INPUT,
  PROSPECT_IMPORT_FIELDS,
} from "@/lib/prospecting/fields";
import {
  ParsedSpreadsheet,
  parseSpreadsheetFile,
} from "@/lib/prospecting/parse";
import {
  PROSPECTING_DEFAULT_MAX_ROWS,
  validateProspectRow,
} from "@/lib/prospecting/validate";
import {
  approveProspectingCampaign,
  bulkUpdateProspectsStatus,
  cancelProspectingCampaign,
  deleteProspectRecords,
  fetchProspectingState,
  sendProspectsToCrmApi,
  submitProspectingChatTurn,
  updateProspectRecord,
} from "@/lib/prospecting/client-api";
import {
  CampaignApprovalPayload,
  CampaignDraftMessage,
  Prospect,
  ProspectImport,
  ProspectInput,
  ProspectingCapabilities,
  ProspectingChannelId,
  ProspectingConversation,
  ProspectStatus,
} from "@/types/prospecting";
import { ProspectTable } from "@/components/prospecting/ProspectTable";
import { ProspectDrawer } from "@/components/prospecting/ProspectDrawer";
import { AutomationHistoryPanel } from "@/components/prospecting/AutomationHistoryPanel";
import { IntegrationsPanel } from "@/components/prospecting/IntegrationsPanel";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  Edit3,
  Eye,
  FileSpreadsheet,
  History,
  Instagram,
  LayoutGrid,
  Linkedin,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Paperclip,
  Plug,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";

interface ProspectingViewProps {
  onOpenCrm?: () => void;
  onOpenLogin?: () => void;
}

interface StagedSpreadsheetAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: "csv" | "xlsx" | "xls";
  parsed: ParsedSpreadsheet;
  columnMap: Record<keyof ProspectInput, number>;
  duplicateStrategy: "skip" | "update";
}

type SecondaryDrawerTab =
  | "campaigns"
  | "prospects"
  | "integrations"
  | "settings"
  | "usage"
  | null;

const QUICK_SUGGESTIONS: string[] = [
  "Start outreach for my cafe leads.",
  "Follow up on pending replies.",
  "Find potential clients in my industry.",
  "Book calls this week.",
  "Research my uploaded prospects.",
];

export function ProspectingView({
  onOpenCrm,
  onOpenLogin,
}: ProspectingViewProps) {
  const {
    db,
    isAuthenticated,
    currentUser,
    logout,
    applyProspectingState,
    markProspectsDeleted,
    refreshState,
    setActiveSection,
  } = useAgency();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [capabilities, setCapabilities] =
    useState<ProspectingCapabilities | null>(null);

  // Composer state
  const [prompt, setPrompt] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<
    ProspectingChannelId[]
  >(["email"]);
  const [stagedFiles, setStagedFiles] = useState<StagedSpreadsheetAttachment[]>(
    []
  );
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(
    null
  );
  const [dragOver, setDragOver] = useState(false);
  const [submittingTurn, setSubmittingTurn] = useState(false);
  const [liveProgressLabel, setLiveProgressLabel] = useState<string | null>(
    null
  );

  // Active conversation thread (null = centered landing hero screen)
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  // Secondary menu & overlay drawers
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [secondaryDrawer, setSecondaryDrawer] =
    useState<SecondaryDrawerTab>(null);
  const [inspectedProspectId, setInspectedProspectId] = useState<string | null>(
    null
  );

  // Campaign approval inline interaction states
  const [activeDraftIndexByMsg, setActiveDraftIndexByMsg] = useState<
    Record<string, number>
  >({});
  const [editingApprovalMsgId, setEditingApprovalMsgId] = useState<
    string | null
  >(null);
  const [draftEditsByMsg, setDraftEditsByMsg] = useState<
    Record<
      string,
      Record<
        string,
        { subject: string; body: string; suppressed?: boolean }
      >
    >
  >({});
  const [scheduleEditByMsg, setScheduleEditByMsg] = useState<
    Record<string, string>
  >({});
  const [reviewingProspectsMsgId, setReviewingProspectsMsgId] = useState<
    string | null
  >(null);
  const [approvingMsgId, setApprovingMsgId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const prospects = db.prospects || [];
  const imports = db.prospectImports || [];
  const conversations = db.prospectConversations || [];

  const activeConversation: ProspectingConversation | null = useMemo(
    () =>
      activeConversationId
        ? conversations.find((c) => c.id === activeConversationId) || null
        : null,
    [conversations, activeConversationId]
  );

  const inspectedProspect: Prospect | null = useMemo(
    () => prospects.find((p) => p.id === inspectedProspectId) || null,
    [prospects, inspectedProspectId]
  );

  const previewAttachment = useMemo(
    () => stagedFiles.find((f) => f.id === previewAttachmentId) || null,
    [stagedFiles, previewAttachmentId]
  );

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchProspectingState();
      applyProspectingState({
        prospects: data.prospects,
        prospectImports: data.imports,
        prospectConversations: data.conversations,
      });
      setCapabilities(data.capabilities);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load AI Outreach Agent."
      );
    } finally {
      setLoading(false);
    }
  }, [applyProspectingState, isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeConversation) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation?.messages.length, submittingTurn]);

  const navigateToCrm = () => {
    if (onOpenCrm) {
      onOpenCrm();
    } else {
      setActiveSection("dashboard");
    }
  };

  const toggleChannel = (ch: ProspectingChannelId) => {
    setSelectedChannels((prev) => {
      if (prev.includes(ch)) {
        return prev.length > 1 ? prev.filter((x) => x !== ch) : prev;
      }
      return [...prev, ch];
    });
  };

  const handleAttachFiles = async (fileList: FileList | File[]) => {
    const maxRows = capabilities?.maxImportRows || PROSPECTING_DEFAULT_MAX_ROWS;
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    const newlyStaged: StagedSpreadsheetAttachment[] = [];
    for (const file of arr) {
      try {
        const parsed = await parseSpreadsheetFile(file, maxRows);
        const colMap = autoMapColumns(parsed.headers);
        newlyStaged.push({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          fileSize: file.size,
          fileType: parsed.fileType,
          parsed,
          columnMap: colMap,
          duplicateStrategy: "skip",
        });
      } catch (err) {
        setToast({
          type: "err",
          text:
            err instanceof Error
              ? err.message
              : `Could not parse ${file.name}.`,
        });
      }
    }

    if (newlyStaged.length > 0) {
      setStagedFiles((prev) => [...prev, ...newlyStaged]);
    }
  };

  const buildRowsForAttachment = (att: StagedSpreadsheetAttachment) => {
    return att.parsed.rows.map((cells, idx) => {
      const data: ProspectInput = { ...EMPTY_PROSPECT_INPUT };
      for (const field of PROSPECT_IMPORT_FIELDS) {
        const colIdx = att.columnMap[field.key];
        if (colIdx >= 0 && colIdx < cells.length) {
          data[field.key] = cells[colIdx] || "";
        }
      }
      const validated = validateProspectRow(data);
      return {
        rowNumber: idx + 1,
        included: validated.status !== "invalid",
        data: validated.clean,
      };
    });
  };

  const handleSubmitTurn = async (overridePrompt?: string) => {
    const finalPrompt = (overridePrompt ?? prompt).trim();
    if (!finalPrompt && stagedFiles.length === 0) return;
    if (submittingTurn) return;

    if (!isAuthenticated) {
      if (onOpenLogin) {
        onOpenLogin();
      } else {
        setToast({
          type: "err",
          text: "Please click Login in the top-right corner to start your outreach session.",
        });
      }
      return;
    }

    setSubmittingTurn(true);
    setToast(null);
    setLiveProgressLabel(
      stagedFiles.length > 0
        ? "Importing your prospects..."
        : "Researching businesses..."
    );

    const progressTimer1 = setTimeout(() => {
      setLiveProgressLabel("Researching businesses...");
    }, 650);
    const progressTimer2 = setTimeout(() => {
      setLiveProgressLabel("Preparing personalised emails...");
    }, 1350);

    try {
      const filesPayload = stagedFiles.map((att) => {
        const mappingLabels: Record<string, string> = {};
        for (const f of PROSPECT_IMPORT_FIELDS) {
          const idx = att.columnMap[f.key];
          if (idx >= 0 && att.parsed.headers[idx]) {
            mappingLabels[f.key] = att.parsed.headers[idx];
          }
        }
        return {
          idempotencyKey: crypto.randomUUID(),
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          duplicateStrategy: att.duplicateStrategy,
          columnMapping: mappingLabels,
          rows: buildRowsForAttachment(att),
        };
      });

      const res = await submitProspectingChatTurn({
        conversationId: activeConversationId || undefined,
        prompt:
          finalPrompt ||
          `Upload ${stagedFiles.map((f) => f.fileName).join(", ")} and prepare personalised outreach.`,
        selectedChannels,
        files: filesPayload.length > 0 ? filesPayload : undefined,
      });

      applyProspectingState({
        prospects: res.prospects,
        prospectImports: res.imports,
        prospectConversations: res.conversations,
      });
      setActiveConversationId(res.conversation.id);
      setPrompt("");
      setStagedFiles([]);
    } catch (err) {
      setToast({
        type: "err",
        text:
          err instanceof Error
            ? err.message
            : "Failed to process outreach request.",
      });
    } finally {
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      setLiveProgressLabel(null);
      setSubmittingTurn(false);
    }
  };

  const getEffectiveDraft = (
    msgId: string,
    draft: CampaignDraftMessage
  ): CampaignDraftMessage => {
    const custom = draftEditsByMsg[msgId]?.[draft.prospectId];
    if (!custom) return draft;
    return {
      ...draft,
      subject: custom.subject ?? draft.subject,
      body: custom.body ?? draft.body,
      suppressed:
        typeof custom.suppressed === "boolean"
          ? custom.suppressed
          : draft.suppressed,
    };
  };

  const updateDraftField = (
    msgId: string,
    draft: CampaignDraftMessage,
    updates: Partial<{ subject: string; body: string; suppressed: boolean }>
  ) => {
    setDraftEditsByMsg((prev) => {
      const msgMap = prev[msgId] || {};
      const cur = msgMap[draft.prospectId] || {
        subject: draft.subject,
        body: draft.body,
        suppressed: draft.suppressed,
      };
      return {
        ...prev,
        [msgId]: {
          ...msgMap,
          [draft.prospectId]: {
            ...cur,
            ...updates,
          },
        },
      };
    });
  };

  const handleApproveAndStart = async (
    conversationId: string,
    messageId: string,
    approval: CampaignApprovalPayload
  ) => {
    if (approvingMsgId) return;
    setApprovingMsgId(messageId);
    setToast(null);
    try {
      const editsMap = draftEditsByMsg[messageId] || {};
      const editedDrafts = approval.drafts
        .filter((d) => editsMap[d.prospectId] !== undefined)
        .map((d) => ({
          prospectId: d.prospectId,
          subject: editsMap[d.prospectId].subject,
          body: editsMap[d.prospectId].body,
          suppressed: editsMap[d.prospectId].suppressed,
        }));

      const res = await approveProspectingCampaign({
        conversationId,
        messageId,
        followUpSchedule:
          scheduleEditByMsg[messageId] || approval.followUpSchedule,
        editedDrafts: editedDrafts.length > 0 ? editedDrafts : undefined,
      });

      applyProspectingState({
        prospects: res.prospects,
        prospectConversations: res.conversations,
      });
      await refreshState();
      setEditingApprovalMsgId(null);
      setReviewingProspectsMsgId(null);
      setToast({
        type: "ok",
        text: "Campaign approved and synchronized with CRM Leads.",
      });
    } catch (err) {
      setToast({
        type: "err",
        text:
          err instanceof Error ? err.message : "Failed to approve campaign.",
      });
    } finally {
      setApprovingMsgId(null);
    }
  };

  const handleCancelCampaign = async (
    conversationId: string,
    messageId: string
  ) => {
    try {
      const res = await cancelProspectingCampaign({
        conversationId,
        messageId,
      });
      applyProspectingState({
        prospectConversations: res.conversations,
      });
      setEditingApprovalMsgId(null);
      setReviewingProspectsMsgId(null);
    } catch (err) {
      setToast({
        type: "err",
        text:
          err instanceof Error ? err.message : "Failed to cancel campaign.",
      });
    }
  };

  const handleUpdateProspect = async (
    id: string,
    patch: Partial<{
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
      status: ProspectStatus;
    }>
  ) => {
    const { prospect } = await updateProspectRecord(id, patch);
    applyProspectingState({
      prospects: prospects.map((p) => (p.id === id ? prospect : p)),
    });
    setToast({ type: "ok", text: "Prospect updated." });
  };

  const handleBulkUpdateStatus = async (
    ids: string[],
    status: ProspectStatus
  ) => {
    const data = await bulkUpdateProspectsStatus(ids, status);
    applyProspectingState({ prospects: data.prospects });
    setToast({
      type: "ok",
      text: `Updated ${ids.length} prospect(s) to "${status}".`,
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    const data = await deleteProspectRecords(ids);
    markProspectsDeleted(ids);
    applyProspectingState({ prospects: data.prospects });
    setToast({
      type: "ok",
      text: `Deleted ${data.deletedCount} prospect(s).`,
    });
  };

  const handleSendToCrm = async (ids: string[]) => {
    const data = await sendProspectsToCrmApi(ids);
    applyProspectingState({ prospects: data.prospects });
    await refreshState();
    const created = data.results.filter((r) => r.outcome === "created").length;
    const linked = data.results.filter(
      (r) => r.outcome === "linked_existing"
    ).length;
    setToast({
      type: "ok",
      text: `Synced to CRM Leads (${created} created, ${linked} linked to existing CRM leads).`,
    });
  };

  const channelDefinitions: {
    id: ProspectingChannelId;
    label: string;
    icon: React.ElementType;
    connected: boolean;
    statusDetail: string;
  }[] = [
    {
      id: "email",
      label: "Email",
      icon: Mail,
      connected: Boolean(capabilities?.gmail),
      statusDetail: capabilities?.gmail
        ? "Gmail API Connected"
        : "Gmail not connected — prepares approved drafts",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      connected: Boolean(capabilities?.whatsapp),
      statusDetail: capabilities?.whatsapp
        ? "WhatsApp Cloud API Connected"
        : "WhatsApp API not connected — prepares approved drafts",
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: Instagram,
      connected: Boolean(capabilities?.instagram),
      statusDetail: capabilities?.instagram
        ? "Instagram Graph API Connected"
        : "Instagram API not connected — prepares approved drafts",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: Linkedin,
      connected: false,
      statusDetail: "Prepares personalised LinkedIn outreach drafts",
    },
  ];

  // Shared Composer Renderer (used both centered on the Hero screen and docked in Conversation view)
  const renderComposer = (isCompact = false) => (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleAttachFiles(e.dataTransfer.files);
        }
      }}
      className={`w-full transition-all rounded-3xl border ${
        dragOver
          ? "border-[#f0c999] bg-[#16151c] shadow-[0_0_50px_-10px_rgba(242,166,90,0.35)]"
          : "border-white/10 bg-[#111116]/90 hover:border-white/15 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]"
      } backdrop-blur-xl p-4 sm:p-5`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleAttachFiles(e.target.files);
          }
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* Attached CSV / Excel File Previews */}
      {stagedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-white/[0.07]">
          {stagedFiles.map((att) => {
            const mappedCount = Object.values(att.columnMap).filter(
              (idx) => idx >= 0
            ).length;
            return (
              <div
                key={att.id}
                className="inline-flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/[0.05] border border-white/10 text-xs text-neutral-200"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#f0c999] shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate max-w-[190px]">
                    {att.fileName}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    {att.parsed.rows.length} rows · {mappedCount} columns
                    auto-mapped
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewAttachmentId(att.id)}
                  className="px-2 py-1 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-[11px] text-[#f5dec3] font-medium transition"
                >
                  Preview / Map
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStagedFiles((prev) =>
                      prev.filter((x) => x.id !== att.id)
                    )
                  }
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Natural Language Prompt Input */}
      <textarea
        rows={isCompact ? 2 : 3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmitTurn();
          }
        }}
        placeholder="Upload your lead sheet or describe what you want to do..."
        className="w-full bg-transparent text-sm sm:text-[15px] text-neutral-100 placeholder:text-neutral-500 resize-none focus:outline-none leading-relaxed"
      />

      {/* Composer Footer: Left Upload | Middle Channels | Right Start Outreach */}
      <div className="mt-3 pt-3 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
        {/* Left: Upload File (CSV / Excel) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-neutral-200 transition"
        >
          <Paperclip className="w-3.5 h-3.5 text-[#f0c999]" />
          <span>Upload File (CSV / Excel)</span>
        </button>

        {/* Middle: Channel Selectors reflecting real integration availability */}
        <div className="flex flex-wrap items-center gap-1.5">
          {channelDefinitions.map((ch) => {
            const Icon = ch.icon;
            const selected = selectedChannels.includes(ch.id);
            return (
              <button
                key={ch.id}
                type="button"
                title={ch.statusDetail}
                onClick={() => toggleChannel(ch.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium border transition ${
                  selected
                    ? "bg-[#f0c999]/15 text-[#f7e2c4] border-[#f0c999]/40"
                    : "bg-white/[0.03] text-neutral-400 border-white/[0.07] hover:text-neutral-200 hover:bg-white/[0.06]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ch.label}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ch.connected ? "bg-emerald-400" : "bg-neutral-500"
                  }`}
                  title={ch.statusDetail}
                />
              </button>
            );
          })}
        </div>

        {/* Right: Primary CTA "Start Outreach" */}
        <button
          type="button"
          disabled={
            submittingTurn || (!prompt.trim() && stagedFiles.length === 0)
          }
          onClick={() => handleSubmitTurn()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-[#120e0a] bg-gradient-to-r from-[#f7e5c9] via-[#f0c48c] to-[#ee964b] hover:brightness-105 disabled:opacity-40 transition shadow-[0_10px_30px_-10px_rgba(240,180,110,0.6)]"
        >
          {submittingTurn ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Working…</span>
            </>
          ) : (
            <>
              <span>Start Outreach</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070709] text-neutral-100 flex flex-col relative overflow-x-hidden selection:bg-[#f0c999]/30 selection:text-[#f7e5c9]">
      {/* Atmospheric Glowing Horizon & Champagne/Orange Ambient Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-44 left-1/2 -translate-x-1/2 w-[980px] h-[440px] rounded-full opacity-25 blur-[130px]"
          style={{
            background:
              "radial-gradient(circle, rgba(245,212,169,0.55) 0%, rgba(238,136,58,0.28) 45%, rgba(7,7,9,0) 75%)",
          }}
        />
        <div
          className="absolute bottom-[-220px] left-1/2 -translate-x-1/2 w-[1250px] h-[420px] rounded-full opacity-30 blur-[110px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(242,150,72,0.55) 0%, rgba(245,222,195,0.22) 38%, rgba(7,7,9,0) 72%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#f0c999]/30 to-transparent" />
      </div>

      {/* 3. TOP HEADER */}
      <header className="relative z-30 h-16 px-4 sm:px-8 flex items-center justify-between border-b border-white/[0.06] bg-[#070709]/70 backdrop-blur-md">
        {/* Top-Left: Twofold Studios brand logo and name */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveConversationId(null)}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f7e5c9] via-[#ebb97d] to-[#e07f3a] text-[#120e0a] flex items-center justify-center text-xs font-bold shadow-[0_0_25px_-5px_rgba(240,196,140,0.5)]">
              {db.settings.logoText || "TF"}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-white group-hover:text-[#f7e5c9] transition">
                Twofold Studios
              </div>
              <div className="text-[10px] text-neutral-400">
                AI Outreach Agent
              </div>
            </div>
          </button>

          {activeConversation && (
            <button
              type="button"
              onClick={() => setActiveConversationId(null)}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-neutral-300 transition"
            >
              <Plus className="w-3.5 h-3.5 text-[#f0c999]" />
              <span>New Session</span>
            </button>
          )}
        </div>

        {/* Top-Right: CRM Button + User Profile / Secondary Menu */}
        <div className="flex items-center gap-2.5">
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={() => setSecondaryDrawer("campaigns")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-neutral-300 transition"
            >
              <History className="w-3.5 h-3.5 text-[#f0c999]" />
              <span>Threads ({conversations.length})</span>
            </button>
          )}

          {prospects.length > 0 && (
            <button
              type="button"
              onClick={() => setSecondaryDrawer("prospects")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-neutral-300 transition"
            >
              <Database className="w-3.5 h-3.5 text-[#f0c999]" />
              <span>Prospects ({prospects.length})</span>
            </button>
          )}

          {/* CRM Button — navigates to existing separate CRM product */}
          <button
            type="button"
            onClick={navigateToCrm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/15 text-xs font-semibold text-white transition"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#f0c999]" />
            <span>CRM</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          {!isAuthenticated ? (
            /* Login Button when visitor is not authenticated */
            <button
              type="button"
              onClick={() => {
                if (onOpenLogin) onOpenLogin();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[#120e0a] bg-gradient-to-r from-[#f7e5c9] via-[#f0c48c] to-[#ee964b] hover:brightness-105 transition shadow-[0_6px_20px_-6px_rgba(240,180,110,0.6)]"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          ) : (
            /* User Profile / Secondary Navigation Dropdown when authenticated */
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs transition"
              >
                <div className="w-7 h-7 rounded-full bg-[#f0c999]/20 border border-[#f0c999]/40 text-[#f7e5c9] flex items-center justify-center text-[11px] font-semibold">
                  {currentUser.avatarInitials || "TF"}
                </div>
                <span className="hidden md:inline font-medium text-neutral-200 max-w-[110px] truncate">
                  {currentUser.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#121218] border border-white/10 shadow-2xl py-2 z-50 text-xs">
                    <div className="px-3.5 py-2 border-b border-white/[0.07]">
                      <div className="font-semibold text-white truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {currentUser.email} · {currentUser.role}
                      </div>
                    </div>

                    <div className="py-1">
                      {[
                        {
                          key: "campaigns" as const,
                          label: "Campaign history",
                          icon: History,
                          badge: conversations.length,
                        },
                        {
                          key: "prospects" as const,
                          label: "Prospect history",
                          icon: Users,
                          badge: prospects.length,
                        },
                        {
                          key: "integrations" as const,
                          label: "Integrations",
                          icon: Plug,
                        },
                        {
                          key: "settings" as const,
                          label: "Settings",
                          icon: Settings,
                        },
                        {
                          key: "usage" as const,
                          label: "Usage and billing",
                          icon: CreditCard,
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              setSecondaryDrawer(item.key);
                              setProfileMenuOpen(false);
                            }}
                            className="w-full px-3.5 py-2 flex items-center justify-between text-neutral-300 hover:text-white hover:bg-white/[0.06] transition"
                          >
                            <span className="flex items-center gap-2.5">
                              <Icon className="w-3.5 h-3.5 text-[#f0c999]" />
                              <span>{item.label}</span>
                            </span>
                            {typeof item.badge === "number" && (
                              <span className="px-1.5 py-0.2 rounded-full bg-white/[0.07] text-[10px] text-neutral-300 tabular-nums">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-1 mt-1 border-t border-white/[0.07] space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          navigateToCrm();
                        }}
                        className="w-full px-3.5 py-2 flex items-center justify-between text-[#f7e5c9] hover:bg-white/[0.06] font-medium transition"
                      >
                        <span className="flex items-center gap-2.5">
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>Open CRM Workspace</span>
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-rose-400 hover:bg-white/[0.06] font-medium transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-2xl border border-white/15 bg-[#15151d]/95 backdrop-blur-xl shadow-2xl flex items-center gap-2.5 text-xs">
          {toast.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-neutral-200">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Load Error Notice */}
      {loadError && (
        <div className="relative z-20 max-w-2xl mx-auto mt-4 px-4 py-2.5 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadData}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* MAIN BODY: Centered Hero Landing Screen OR Conversational Assistant Thread */}
      {!activeConversation ? (
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center space-y-7">
            {/* 4. HERO SECTION */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-[#f0c999]/30 text-xs font-medium text-[#f5dec3] shadow-[0_0_25px_-5px_rgba(240,201,153,0.25)]">
                <Sparkles className="w-3.5 h-3.5 text-[#f2a65a]" />
                <span>AI Outreach Agent</span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-[54px] font-semibold tracking-tight text-white leading-[1.12]">
                Let&apos;s turn your leads into{" "}
                <span className="bg-gradient-to-r from-[#f9e8cf] via-[#f2c48d] to-[#f08b43] bg-clip-text text-transparent">
                  booked calls.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto leading-relaxed">
                Upload your lead sheet, tell me your goal, and I&apos;ll handle
                the research, outreach, follow-ups and call booking.
              </p>
            </div>

            {/* 5. CONVERSATIONAL INPUT AREA */}
            {renderComposer(false)}

            {/* 6. QUICK ACTION EXAMPLES */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setPrompt(suggestion);
                  }}
                  className="px-3.5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] hover:border-[#f0c999]/30 text-xs text-neutral-300 hover:text-[#f7e5c9] transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Recent Conversations Pill Bar (if user has previous threads) */}
            {conversations.length > 0 && (
              <div className="pt-4 w-full max-w-2xl">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                  Recent Assistant Sessions
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {conversations.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveConversationId(c.id)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] text-xs text-neutral-300 transition max-w-xs truncate"
                    >
                      <Clock className="w-3 h-3 text-[#f0c999] shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* 7, 8, 9. ACTIVE CONVERSATION INTERFACE */
        <main className="relative z-10 flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 pb-4">
          <div className="flex-1 space-y-6 overflow-y-auto pb-6">
            {activeConversation.messages.map((msg) => {
              const isUser = msg.role === "user";
              const approval = msg.campaignApproval;
              const currentDraftIdx = activeDraftIndexByMsg[msg.id] || 0;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-3xl w-full rounded-3xl p-5 space-y-4 ${
                      isUser
                        ? "bg-white/[0.07] border border-white/10 text-neutral-100 ml-auto max-w-xl"
                        : "bg-[#111116]/95 border border-white/10 text-neutral-100 shadow-2xl"
                    }`}
                  >
                    {/* Role Header */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                        {!isUser && (
                          <Sparkles className="w-3.5 h-3.5 text-[#f0c999]" />
                        )}
                        {isUser ? currentUser.name : "AI Outreach Agent"}
                      </span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Attached Spreadsheet Badges on User Message */}
                    {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.attachedFiles.map((af, i) => (
                          <div
                            key={`${af.fileName}-${i}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/[0.06] border border-white/10 text-xs"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-[#f0c999]" />
                            <span>{af.fileName}</span>
                            <span className="text-[10px] text-emerald-300">
                              +{af.importedCount} imported
                              {af.updatedCount > 0
                                ? `, ${af.updatedCount} updated`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message Narrative */}
                    <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>

                    {/* 9. AI PROGRESS STEPS */}
                    {msg.statusSteps && msg.statusSteps.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.07] space-y-2 text-xs">
                        {msg.statusSteps.map((st, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2"
                          >
                            <div className="flex items-center gap-2">
                              {st.state === "done" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : st.state === "active" ? (
                                <Clock className="w-3.5 h-3.5 text-[#f0c999] shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              )}
                              <span className="font-medium text-neutral-200">
                                {st.label}
                              </span>
                            </div>
                            {st.detail && (
                              <span className="text-[11px] text-neutral-400 text-right">
                                {st.detail}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 7. REAL PROGRESS SUMMARY METRICS */}
                    {msg.progressMetrics && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          {
                            label: "Prospects imported",
                            value: msg.progressMetrics.prospectsImported,
                          },
                          {
                            label: "Prospects researched",
                            value: msg.progressMetrics.prospectsResearched,
                          },
                          {
                            label: "Contact details found",
                            value: msg.progressMetrics.contactDetailsFound,
                          },
                          {
                            label: "Emails prepared",
                            value: msg.progressMetrics.emailsPrepared,
                          },
                          {
                            label: "Awaiting approval",
                            value: msg.progressMetrics.emailsAwaitingApproval,
                          },
                        ].map((m) => (
                          <div
                            key={m.label}
                            className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]"
                          >
                            <div className="text-[10px] text-neutral-400">
                              {m.label}
                            </div>
                            <div className="text-lg font-semibold text-[#f7e5c9] tabular-nums mt-0.5">
                              {m.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 8. CAMPAIGN APPROVAL CARD */}
                    {approval && (
                      <div className="rounded-2xl border border-[#f0c999]/30 bg-gradient-to-b from-[#18161d] to-[#111116] p-4 sm:p-5 space-y-4 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#f0c999]">
                              <Sparkles className="w-3 h-3" />
                              <span>Campaign Approval Required</span>
                            </div>
                            <h3 className="text-base font-semibold text-white mt-0.5">
                              {approval.title}
                            </h3>
                            <p className="text-[11px] text-neutral-400">
                              Target: {approval.targetFilterSummary}
                            </p>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              approval.status === "approved_executed"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : approval.status === "cancelled"
                                ? "bg-neutral-800 text-neutral-400"
                                : "bg-[#f0c999]/15 text-[#f7e5c9] border border-[#f0c999]/40"
                            }`}
                          >
                            {approval.status === "approved_executed"
                              ? "Approved & Executed"
                              : approval.status === "cancelled"
                              ? "Cancelled"
                              : "Awaiting Your Approval"}
                          </span>
                        </div>

                        {/* Campaign Summary Specs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06]">
                            <div className="text-[10px] text-neutral-400">
                              Total Prospects Selected
                            </div>
                            <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                              {approval.totalSelected}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06]">
                            <div className="text-[10px] text-neutral-400">
                              Available Email Addresses
                            </div>
                            <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                              {approval.availableEmails}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06]">
                            <div className="text-[10px] text-neutral-400">
                              Selected Channels
                            </div>
                            <div className="text-sm font-semibold text-white capitalize mt-0.5">
                              {approval.selectedChannels.join(", ")}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06]">
                            <div className="text-[10px] text-neutral-400">
                              Suppressed / Excluded
                            </div>
                            <div className="text-sm font-semibold text-amber-300 tabular-nums mt-0.5">
                              {
                                approval.drafts.filter(
                                  (d) => getEffectiveDraft(msg.id, d).suppressed
                                ).length
                              }
                            </div>
                          </div>
                        </div>

                        {/* Follow-up Schedule */}
                        <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-neutral-400">
                            Follow-up schedule:
                          </span>
                          {editingApprovalMsgId === msg.id ? (
                            <input
                              value={
                                scheduleEditByMsg[msg.id] ??
                                approval.followUpSchedule
                              }
                              onChange={(e) =>
                                setScheduleEditByMsg((prev) => ({
                                  ...prev,
                                  [msg.id]: e.target.value,
                                }))
                              }
                              className="flex-1 max-w-md px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-white text-xs"
                            />
                          ) : (
                            <span className="font-medium text-neutral-200">
                              {scheduleEditByMsg[msg.id] ||
                                approval.followUpSchedule}
                            </span>
                          )}
                        </div>

                        {/* Personalised Message Preview Carousel */}
                        {approval.drafts.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3">
                            {(() => {
                              const safeIdx = Math.min(
                                currentDraftIdx,
                                approval.drafts.length - 1
                              );
                              const rawDraft = approval.drafts[safeIdx];
                              const draft = getEffectiveDraft(msg.id, rawDraft);
                              const isEditing = editingApprovalMsgId === msg.id;

                              return (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded-md bg-[#f0c999]/15 text-[#f7e5c9] font-semibold">
                                        Preview {safeIdx + 1} of{" "}
                                        {approval.drafts.length}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setInspectedProspectId(
                                            draft.prospectId
                                          )
                                        }
                                        className="font-semibold text-white hover:text-[#f7e5c9] underline"
                                      >
                                        {draft.businessName}
                                      </button>
                                      <span className="text-neutral-400">
                                        ({draft.channel.toUpperCase()}:{" "}
                                        {draft.email ||
                                          draft.phone ||
                                          (draft.instagram
                                            ? `@${draft.instagram}`
                                            : "no channel contact")}
                                        )
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={safeIdx <= 0}
                                        onClick={() =>
                                          setActiveDraftIndexByMsg((prev) => ({
                                            ...prev,
                                            [msg.id]: Math.max(0, safeIdx - 1),
                                          }))
                                        }
                                        className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/10 disabled:opacity-30"
                                      >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          safeIdx >= approval.drafts.length - 1
                                        }
                                        onClick={() =>
                                          setActiveDraftIndexByMsg((prev) => ({
                                            ...prev,
                                            [msg.id]: Math.min(
                                              approval.drafts.length - 1,
                                              safeIdx + 1
                                            ),
                                          }))
                                        }
                                        className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/10 disabled:opacity-30"
                                      >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-neutral-400 bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                                    <strong className="text-neutral-300">
                                      AI Research Note:
                                    </strong>{" "}
                                    {draft.researchNote}
                                  </div>

                                  {draft.suppressed && (
                                    <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px]">
                                      Suppressed / Excluded:{" "}
                                      {draft.suppressionReason ||
                                        "Excluded from send"}
                                    </div>
                                  )}

                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <div>
                                        <label className="block text-[10px] text-neutral-400 mb-1">
                                          Subject / Hook
                                        </label>
                                        <input
                                          value={draft.subject}
                                          onChange={(e) =>
                                            updateDraftField(msg.id, rawDraft, {
                                              subject: e.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] text-neutral-400 mb-1">
                                          Personalised Message Body
                                        </label>
                                        <textarea
                                          rows={5}
                                          value={draft.body}
                                          onChange={(e) =>
                                            updateDraftField(msg.id, rawDraft, {
                                              body: e.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-white"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="font-semibold text-neutral-100">
                                        Subject: {draft.subject}
                                      </div>
                                      <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed bg-black/30 p-3 rounded-xl border border-white/[0.05]">
                                        {draft.body}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {/* Inline Review Prospects Drawer inside Approval Card */}
                        {reviewingProspectsMsgId === msg.id && (
                          <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2 max-h-60 overflow-y-auto">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                              <span>
                                Review Campaign Prospects (click name to inspect
                                full record)
                              </span>
                              <button
                                type="button"
                                onClick={() => setReviewingProspectsMsgId(null)}
                                className="text-neutral-400 hover:text-white"
                              >
                                Close
                              </button>
                            </div>
                            <div className="divide-y divide-white/[0.06]">
                              {approval.drafts.map((rawD) => {
                                const eff = getEffectiveDraft(msg.id, rawD);
                                return (
                                  <div
                                    key={rawD.prospectId}
                                    className="py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        disabled={
                                          approval.status !== "pending_approval"
                                        }
                                        checked={!eff.suppressed}
                                        onChange={(e) =>
                                          updateDraftField(msg.id, rawD, {
                                            suppressed: !e.target.checked,
                                          })
                                        }
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setInspectedProspectId(
                                            rawD.prospectId
                                          )
                                        }
                                        className="font-medium text-white hover:text-[#f7e5c9] underline truncate"
                                      >
                                        {rawD.businessName}
                                      </button>
                                      <span className="text-[11px] text-neutral-400 truncate">
                                        {rawD.email ||
                                          rawD.phone ||
                                          (rawD.instagram
                                            ? `@${rawD.instagram}`
                                            : "No contact")}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400 shrink-0">
                                      {eff.suppressed
                                        ? eff.suppressionReason || "Excluded"
                                        : eff.channel.toUpperCase()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Execution Results Banner (after approval) */}
                        {approval.executionSummary && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-1">
                            <div className="font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>Campaign Executed &amp; Synced to CRM</span>
                            </div>
                            <p className="text-[11px] text-emerald-200/90">
                              {approval.executionSummary.providerNote}
                            </p>
                          </div>
                        )}

                        {/* 8. REQUIRED CAMPAIGN APPROVAL ACTIONS */}
                        {approval.status === "pending_approval" && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={approvingMsgId === msg.id}
                              onClick={() =>
                                handleApproveAndStart(
                                  activeConversation.id,
                                  msg.id,
                                  approval
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#120e0a] bg-gradient-to-r from-[#f7e5c9] via-[#f0c48c] to-[#ee964b] hover:brightness-105 disabled:opacity-50"
                            >
                              {approvingMsgId === msg.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Approve and Start</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingApprovalMsgId((prev) =>
                                  prev === msg.id ? null : msg.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-200 font-medium"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#f0c999]" />
                              <span>
                                {editingApprovalMsgId === msg.id
                                  ? "Done Editing"
                                  : "Edit Messages"}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setReviewingProspectsMsgId((prev) =>
                                  prev === msg.id ? null : msg.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-200 font-medium"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#f0c999]" />
                              <span>Review Prospects</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleCancelCampaign(
                                  activeConversation.id,
                                  msg.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.03] hover:bg-rose-500/15 border border-white/10 text-neutral-400 hover:text-rose-300 font-medium ml-auto"
                            >
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clickable Prospect Chips to Inspect Details */}
                    {msg.referencedProspectIds &&
                      msg.referencedProspectIds.length > 0 && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-neutral-400 mr-1">
                            Inspect prospects:
                          </span>
                          {msg.referencedProspectIds.map((pid) => {
                            const found = prospects.find((p) => p.id === pid);
                            if (!found) return null;
                            return (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => setInspectedProspectId(pid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[11px] text-neutral-200 transition"
                              >
                                <span>
                                  {found.businessName ||
                                    found.contactPerson ||
                                    found.email}
                                </span>
                                {found.crmLeadId && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}

            {/* Live In-Flight Progress Bubble */}
            {submittingTurn && (
              <div className="flex justify-start">
                <div className="rounded-3xl bg-[#111116]/95 border border-white/10 px-5 py-4 flex items-center gap-3 text-xs text-neutral-200">
                  <Loader2 className="w-4 h-4 animate-spin text-[#f0c999]" />
                  <span>{liveProgressLabel || "Processing your request..."}</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Docked Composer at Bottom of Active Conversation */}
          <div className="pt-2">{renderComposer(true)}</div>
        </main>
      )}

      {/* Spreadsheet Attachment Preview & Column Mapping Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121218] border border-white/15 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-xs text-neutral-100">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Preview &amp; Column Mapping — {previewAttachment.fileName}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  {previewAttachment.parsed.rows.length} rows detected · Adjust
                  any column mappings before starting outreach
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAttachmentId(null)}
                className="p-1.5 rounded-xl hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Duplicate handling:</span>
                <select
                  value={previewAttachment.duplicateStrategy}
                  onChange={(e) => {
                    const nextStrat = e.target.value as "skip" | "update";
                    setStagedFiles((prev) =>
                      prev.map((f) =>
                        f.id === previewAttachment.id
                          ? { ...f, duplicateStrategy: nextStrat }
                          : f
                      )
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-white"
                >
                  <option value="skip" className="bg-neutral-900 text-white">
                    Skip duplicate prospects
                  </option>
                  <option value="update" className="bg-neutral-900 text-white">
                    Update existing prospects
                  </option>
                </select>
              </div>

              <div className="border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/[0.04] text-[11px] text-neutral-400 border-b border-white/10">
                    <tr>
                      <th className="py-2 px-3">Prospect Field</th>
                      <th className="py-2 px-3">Spreadsheet Column</th>
                      <th className="py-2 px-3">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {PROSPECT_IMPORT_FIELDS.map((field) => {
                      const colIdx = previewAttachment.columnMap[field.key];
                      const samples =
                        colIdx >= 0
                          ? previewAttachment.parsed.rows
                              .slice(0, 2)
                              .map((r) => r[colIdx] || "")
                              .filter(Boolean)
                          : [];
                      return (
                        <tr key={field.key}>
                          <td className="py-2 px-3 font-medium">
                            {field.label}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={colIdx}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStagedFiles((prev) =>
                                  prev.map((f) =>
                                    f.id === previewAttachment.id
                                      ? {
                                          ...f,
                                          columnMap: {
                                            ...f.columnMap,
                                            [field.key]: val,
                                          },
                                        }
                                      : f
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-white"
                            >
                              <option
                                value={-1}
                                className="bg-neutral-900 text-white"
                              >
                                — Not mapped —
                              </option>
                              {previewAttachment.parsed.headers.map((h, i) => (
                                <option
                                  key={`${h}-${i}`}
                                  value={i}
                                  className="bg-neutral-900 text-white"
                                >
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-neutral-400 truncate max-w-[200px]">
                            {samples.length > 0 ? samples.join(" · ") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewAttachmentId(null)}
                className="px-4 py-2 rounded-xl bg-[#f0c999] text-[#120e0a] font-semibold"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. SECONDARY NAVIGATION DRAWERS (Campaign History, Prospect History, Integrations, Settings, Usage) */}
      {secondaryDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="dark bg-[#0e0e13] border-l border-white/10 w-full max-w-5xl h-full flex flex-col text-neutral-100">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(
                  [
                    { key: "campaigns", label: "Campaign History" },
                    { key: "prospects", label: "Prospect History" },
                    { key: "integrations", label: "Integrations" },
                    { key: "settings", label: "Settings" },
                    { key: "usage", label: "Usage & Billing" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSecondaryDrawer(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      secondaryDrawer === tab.key
                        ? "bg-[#f0c999] text-[#120e0a] font-semibold"
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSecondaryDrawer(null)}
                className="p-1.5 rounded-xl hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {secondaryDrawer === "campaigns" && (
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-white">
                      Conversational Outreach Sessions ({conversations.length})
                    </h3>
                    {conversations.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-neutral-400">
                        No conversational outreach sessions yet. Submit a goal
                        in the assistant to start your first campaign.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {conversations.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setActiveConversationId(c.id);
                              setSecondaryDrawer(null);
                            }}
                            className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-left space-y-1 transition"
                          >
                            <div className="text-xs font-semibold text-white truncate">
                              {c.title}
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              {c.messages.length} messages · Updated{" "}
                              {new Date(c.updatedAt).toLocaleString()}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <AutomationHistoryPanel
                    imports={imports}
                    activityLog={db.activityLog || []}
                  />
                </div>
              )}

              {secondaryDrawer === "prospects" && (
                <ProspectTable
                  prospects={prospects}
                  imports={imports}
                  title="Prospect Database"
                  emptyDescription="No prospects uploaded yet. Close this drawer and attach a CSV or Excel sheet in the AI chat composer."
                  onUploadClick={() => {
                    setSecondaryDrawer(null);
                    fileInputRef.current?.click();
                  }}
                  onUpdateProspect={handleUpdateProspect}
                  onBulkUpdateStatus={handleBulkUpdateStatus}
                  onBulkDelete={handleBulkDelete}
                  onSendToCrm={handleSendToCrm}
                />
              )}

              {secondaryDrawer === "integrations" && (
                <IntegrationsPanel capabilities={capabilities} />
              )}

              {secondaryDrawer === "settings" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="font-semibold text-white">
                      Outreach Safety &amp; Approval Policy
                    </div>
                    <p className="text-neutral-400 leading-relaxed">
                      Every bulk outreach campaign generated by the AI Outreach
                      Agent requires explicit human approval before execution.
                      Prospects marked as <strong>Do Not Contact</strong> or{" "}
                      <strong>Not Interested</strong> are automatically
                      suppressed.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="font-semibold text-white">
                      Spreadsheet &amp; Deduplication Limits
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>Max Rows per File</span>
                      <span className="tabular-nums">
                        {(capabilities?.maxImportRows || 2000).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>Max File Size</span>
                      <span className="tabular-nums">5 MB (.csv, .xlsx, .xls)</span>
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>CRM Lead Deduplication</span>
                      <span className="text-emerald-400">
                        Active (Email, Domain, Phone, IG, Name)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {secondaryDrawer === "usage" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    {
                      label: "Workspace Prospects",
                      value: prospects.length,
                    },
                    {
                      label: "Spreadsheet Imports",
                      value: imports.length,
                    },
                    {
                      label: "Assistant Sessions",
                      value: conversations.length,
                    },
                    {
                      label: "Synced to CRM Leads",
                      value: prospects.filter((p) => Boolean(p.crmLeadId))
                        .length,
                    },
                  ].map((u) => (
                    <div
                      key={u.label}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/10"
                    >
                      <div className="text-neutral-400">{u.label}</div>
                      <div className="text-2xl font-semibold text-[#f7e5c9] tabular-nums mt-1">
                        {u.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prospect Inspector Drawer (when clicking any prospect in conversation) */}
      <div className="dark">
        <ProspectDrawer
          prospect={inspectedProspect}
          onClose={() => setInspectedProspectId(null)}
          onSave={handleUpdateProspect}
          onSendToCrm={(id) => handleSendToCrm([id])}
        />
      </div>
    </div>
  );
}
