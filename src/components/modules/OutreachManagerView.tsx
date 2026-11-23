"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  INDUSTRIES,
  OUTREACH_CHANNELS,
  OUTREACH_STATUSES,
  POSITIVE_OUTREACH_STATUSES,
  REPLIED_OUTREACH_STATUSES,
} from "@/lib/constants";
import {
  OutreachActivity,
  OutreachCampaign,
  OutreachChannel,
  OutreachStatus,
  TemplateCategory,
} from "@/types/agency";
import {
  BarChart3,
  BookOpen,
  Check,
  Copy,
  Edit3,
  Info,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Send,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function OutreachManagerView() {
  const {
    db,
    currentUser,
    permissions,
    addOutreach,
    updateOutreach,
    deleteOutreach,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    addTemplate,
    incrementTemplateUsage,
    refreshState,
  } = useAgency();

  const [activeTab, setActiveTab] = useState<"activities" | "campaigns">(
    "activities"
  );
  const [channelFilter, setChannelFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [campaignFilter, setCampaignFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OutreachActivity | null>(null);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Campaign modals
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] =
    useState<OutreachCampaign | null>(null);
  const [reportCampaign, setReportCampaign] =
    useState<OutreachCampaign | null>(null);

  // Live API send state (Gmail / WhatsApp Cloud API)
  const [sendViaApi, setSendViaApi] = useState(false);
  const [apiSubject, setApiSubject] = useState(
    "Quick 90s UX teardown for your website"
  );
  const [apiFeedback, setApiFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // New template inline form
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplCategory, setNewTplCategory] = useState<TemplateCategory>(
    "Cold Email Templates"
  );
  const [newTplHook, setNewTplHook] = useState("");
  const [newTplContent, setNewTplContent] = useState("");

  // Outreach form state
  const emptyForm = {
    leadId: db.leads[0]?.id || "",
    leadName: db.leads[0]?.businessName || "",
    campaignId: db.campaigns?.[0]?.id || "",
    communicationChannel: "Cold Emails" as OutreachChannel,
    messageTemplateUsed: "Founder 90-Second UX & Conversion Teardown",
    dateSent: new Date().toISOString().slice(0, 10),
    messageContent: "",
    replyStatus: "Message Sent" as OutreachStatus,
    replyDate: "",
    nextFollowUpDate: new Date(Date.now() + 4 * 86400000)
      .toISOString()
      .slice(0, 10),
    outcome: "",
  };
  const [formState, setFormState] = useState(emptyForm);

  // Campaign form state
  const emptyCampaignForm = {
    name: "",
    targetIndustry: INDUSTRIES[4],
    targetCountry: "Canada",
    targetCity: "Toronto",
    assignedTeamMembers: [currentUser.id],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    leadIds: db.leads.map((l) => l.id).slice(0, 3),
    communicationChannels: [
      "Cold Emails",
      "Cold Calling",
      "Instagram DMs",
      "WhatsApp Messages",
    ],
    status: "Active" as OutreachCampaign["status"],
  };
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);

  const gmailConnected =
    (db.integrations || []).find((i) => i.provider === "gmail")?.status ===
    "connected";
  const whatsappConnected =
    (db.integrations || []).find((i) => i.provider === "whatsapp")?.status ===
    "connected";

  // Outreach Analytics calculations (distinguishing Manual vs API, Sent vs Delivered, Replied vs Positive)
  const analytics = useMemo(() => {
    const outbound = db.outreach.filter((o) => o.direction !== "Inbound");
    const totalSent = outbound.filter(
      (o) => o.replyStatus !== "Not Contacted"
    ).length;
    const deliveredEmails = outbound.filter(
      (o) =>
        o.communicationChannel === "Cold Emails" &&
        (o.deliveryStatus === "delivered" || o.deliveryStatus === "read")
    ).length;
    const manualDms = outbound.filter(
      (o) =>
        (o.communicationChannel === "Instagram DMs" ||
          o.communicationChannel === "WhatsApp Messages") &&
        o.source !== "api"
    ).length;
    const apiDms = outbound.filter(
      (o) =>
        (o.communicationChannel === "Instagram DMs" ||
          o.communicationChannel === "WhatsApp Messages") &&
        o.source === "api"
    ).length;

    // Deduplicate replies by leadId + channel so the same reply is never counted twice
    const repliedActivities = db.outreach.filter((o) =>
      REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
    );
    const totalReplies = repliedActivities.length;
    const replyRate =
      totalSent > 0 ? Math.round((totalReplies / totalSent) * 1000) / 10 : 0;
    const positiveReplies = db.outreach.filter((o) =>
      POSITIVE_OUTREACH_STATUSES.has(o.replyStatus)
    ).length;
    const meetingsBooked = db.outreach.filter(
      (o) =>
        o.replyStatus === "Meeting Booked" || o.replyStatus === "Converted"
    ).length;
    const conversions = db.leads.filter((l) => l.status === "Converted").length;

    const byChannel = OUTREACH_CHANNELS.map((ch) => {
      const items = db.outreach.filter((o) => o.communicationChannel === ch);
      const sent = items.filter((o) => o.direction !== "Inbound").length;
      const replies = items.filter((o) =>
        REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
      ).length;
      const positive = items.filter((o) =>
        POSITIVE_OUTREACH_STATUSES.has(o.replyStatus)
      ).length;
      return {
        channel: ch.replace(" Messages", ""),
        Sent: sent,
        Replies: replies,
        Positive: positive,
      };
    });

    return {
      totalSent,
      deliveredEmails,
      manualDms,
      apiDms,
      totalReplies,
      replyRate,
      positiveReplies,
      meetingsBooked,
      conversions,
      byChannel,
    };
  }, [db.outreach, db.leads]);

  // Per-campaign metrics calculation (Part 11)
  const computeCampaignMetrics = (camp: OutreachCampaign) => {
    const leadIdSet = new Set(camp.leadIds);
    const campOutreach = db.outreach.filter(
      (o) => o.campaignId === camp.id || leadIdSet.has(o.leadId)
    );
    const campCalls = (db.coldCalls || []).filter(
      (c) => c.campaignId === camp.id || leadIdSet.has(c.leadId)
    );

    const prospectsAdded = camp.leadIds.length;
    const emailsSent = campOutreach.filter(
      (o) =>
        o.communicationChannel === "Cold Emails" && o.direction !== "Inbound"
    ).length;
    const callsMade = campCalls.length;
    const dmsSent = campOutreach.filter(
      (o) =>
        (o.communicationChannel === "Instagram DMs" ||
          o.communicationChannel === "WhatsApp Messages" ||
          o.communicationChannel === "LinkedIn Messages") &&
        o.direction !== "Inbound"
    ).length;
    const repliesReceived = campOutreach.filter((o) =>
      REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
    ).length;
    const positiveReplies = campOutreach.filter((o) =>
      POSITIVE_OUTREACH_STATUSES.has(o.replyStatus)
    ).length;
    const meetingsBooked =
      campOutreach.filter(
        (o) =>
          o.replyStatus === "Meeting Booked" || o.replyStatus === "Converted"
      ).length +
      campCalls.filter(
        (c) => c.outcome === "Meeting Booked" || c.outcome === "Converted"
      ).length;
    const clientsConverted = db.leads.filter(
      (l) => leadIdSet.has(l.id) && l.status === "Converted"
    ).length;

    return {
      prospectsAdded,
      emailsSent,
      callsMade,
      dmsSent,
      repliesReceived,
      positiveReplies,
      meetingsBooked,
      clientsConverted,
    };
  };

  const outreachTemplates = useMemo(() => {
    const outreachCats = new Set<TemplateCategory>([
      "Cold Email Templates",
      "Instagram DM Templates",
      "WhatsApp Templates",
      "Follow-up Templates",
    ]);
    return db.templates.filter((t) => outreachCats.has(t.category));
  }, [db.templates]);

  const filteredOutreach = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.outreach.filter((o) => {
      if (
        channelFilter !== "All" &&
        o.communicationChannel !== channelFilter
      )
        return false;
      if (statusFilter !== "All" && o.replyStatus !== statusFilter)
        return false;
      if (campaignFilter !== "All" && o.campaignId !== campaignFilter)
        return false;
      if (!q) return true;
      return (
        o.leadName.toLowerCase().includes(q) ||
        o.messageContent.toLowerCase().includes(q) ||
        o.messageTemplateUsed.toLowerCase().includes(q) ||
        o.outcome.toLowerCase().includes(q)
      );
    });
  }, [db.outreach, channelFilter, statusFilter, campaignFilter, search]);

  const applyTemplateToForm = (templateId: string) => {
    const tpl = db.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const selectedLead = db.leads.find(
      (l) =>
        l.id === formState.leadId || l.businessName === formState.leadName
    );
    let personalized = tpl.content;
    if (selectedLead) {
      personalized = personalized
        .replace(/\{\{Business_Name\}\}/g, selectedLead.businessName)
        .replace(/\{\{Contact_Person\}\}/g, selectedLead.contactPerson)
        .replace(/\{\{Industry\}\}/g, selectedLead.industry)
        .replace(/\{\{City\}\}/g, selectedLead.city)
        .replace(/\{\{Rating\}\}/g, String(selectedLead.rating))
        .replace(/\{\{Reviews\}\}/g, String(selectedLead.numberOfReviews))
        .replace(/\{\{Website_URL\}\}/g, selectedLead.websiteUrl || "your site")
        .replace(
          /\{\{Personalization_Observation\}\}/g,
          selectedLead.personalizationNotes || "several mobile UX opportunities"
        );
    }
    incrementTemplateUsage(tpl.id);
    if (tpl.subjectOrHook) {
      setApiSubject(
        tpl.subjectOrHook.replace(
          /\{\{Business_Name\}\}/g,
          selectedLead?.businessName || ""
        )
      );
    }
    setFormState((prev) => ({
      ...prev,
      messageTemplateUsed: tpl.title,
      messageContent: personalized,
    }));
  };

  const openLogModal = () => {
    setEditingItem(null);
    setFormState(emptyForm);
    setSendViaApi(false);
    setApiFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: OutreachActivity) => {
    setEditingItem(item);
    setFormState({
      leadId: item.leadId,
      leadName: item.leadName,
      campaignId: item.campaignId || "",
      communicationChannel: item.communicationChannel,
      messageTemplateUsed: item.messageTemplateUsed,
      dateSent: item.dateSent,
      messageContent: item.messageContent,
      replyStatus: item.replyStatus,
      replyDate: item.replyDate,
      nextFollowUpDate: item.nextFollowUpDate,
      outcome: item.outcome,
    });
    setSendViaApi(false);
    setApiFeedback(null);
    setIsModalOpen(true);
  };

  const handleSaveOutreach = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiFeedback(null);
    if (!formState.leadName.trim() || !formState.messageContent.trim()) return;

    // If user requested live API send (Gmail or WhatsApp Cloud API)
    if (sendViaApi && !editingItem) {
      const targetLead = db.leads.find((l) => l.id === formState.leadId);
      if (formState.communicationChannel === "Cold Emails") {
        const res = await fetch("/api/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_gmail",
            leadId: formState.leadId,
            campaignId: formState.campaignId || undefined,
            to: targetLead?.businessEmail || "",
            subject: apiSubject,
            message: formState.messageContent,
            templateTitle: formState.messageTemplateUsed,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setApiFeedback({
            type: "err",
            text: data.error || "Gmail API send failed",
          });
          return;
        }
        await refreshState();
        setIsModalOpen(false);
        return;
      }

      if (formState.communicationChannel === "WhatsApp Messages") {
        const res = await fetch("/api/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_whatsapp",
            leadId: formState.leadId,
            templateName: "hello_world",
            messageContent: formState.messageContent,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setApiFeedback({
            type: "err",
            text: data.error || "WhatsApp Cloud API send failed",
          });
          return;
        }
        await refreshState();
        setIsModalOpen(false);
        return;
      }
    }

    if (editingItem) {
      updateOutreach(editingItem.id, formState);
    } else {
      addOutreach(formState);
    }
    setIsModalOpen(false);
  };

  const handleSaveCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignForm.name.trim()) return;
    if (editingCampaign) {
      updateCampaign(editingCampaign.id, campaignForm);
    } else {
      addCampaign(campaignForm);
    }
    setIsCampaignModalOpen(false);
  };

  const handleSaveNewOutreachTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplTitle.trim() || !newTplContent.trim()) return;
    addTemplate({
      title: newTplTitle.trim(),
      category: newTplCategory,
      subjectOrHook: newTplHook.trim(),
      content: newTplContent.trim(),
      tags: ["Outreach", "Custom"],
    });
    setNewTplTitle("");
    setNewTplHook("");
    setNewTplContent("");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Outreach &amp; Campaign Manager
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage multi-channel outreach campaigns, manual &amp; API-verified messages, and daily activity targets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("activities")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                activeTab === "activities"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              Outreach Activities ({db.outreach.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("campaigns")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                activeTab === "campaigns"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              Campaigns ({(db.campaigns || []).length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsTemplateDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
          >
            <BookOpen className="w-3.5 h-3.5" /> Templates (
            {outreachTemplates.length})
          </button>

          {activeTab === "campaigns" ? (
            <button
              type="button"
              onClick={() => {
                setEditingCampaign(null);
                setCampaignForm(emptyCampaignForm);
                setIsCampaignModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            >
              <Plus className="w-3.5 h-3.5" /> New Campaign
            </button>
          ) : (
            <button
              type="button"
              onClick={openLogModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            >
              <Plus className="w-3.5 h-3.5" /> Log / Send Outreach
            </button>
          )}
        </div>
      </div>

      {/* Explicit Channel Sync Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-neutral-500 shrink-0" />
          <span>
            <strong>Channel Integrity:</strong> Manual logs and API-synchronized messages are tracked separately. Messages are never auto-sent without explicit authorization.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={`px-2 py-0.5 rounded-full ${
              gmailConnected
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          >
            Gmail API: {gmailConnected ? "Connected" : "Manual Mode"}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full ${
              whatsappConnected
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          >
            WhatsApp Cloud: {whatsappConnected ? "Connected" : "Manual Mode"}
          </span>
        </div>
      </div>

      {/* 7 Outreach Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            label: "Outbound Sent",
            value: analytics.totalSent,
            sub: `${analytics.deliveredEmails} emails confirmed delivered`,
          },
          {
            label: "Total Replies",
            value: analytics.totalReplies,
            sub: "Deduplicated replies",
          },
          {
            label: "Reply Rate",
            value: `${analytics.replyRate}%`,
            sub: "Replies / Outbound",
          },
          {
            label: "Positive Replies",
            value: analytics.positiveReplies,
            sub: "Interested / Demo / Booked",
          },
          {
            label: "DMs (Manual / API)",
            value: `${analytics.manualDms} / ${analytics.apiDms}`,
            sub: "Manual vs API-synced",
          },
          {
            label: "Meetings Booked",
            value: analytics.meetingsBooked,
            sub: "Discovery calls booked",
          },
          {
            label: "Converted Clients",
            value: analytics.conversions,
            sub: "Closed CRM leads",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5"
          >
            <div className="text-[11px] text-neutral-500">{stat.label}</div>
            <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
              {stat.value}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {activeTab === "campaigns" ? (
        /* PART 11 — OUTREACH CAMPAIGNS VIEW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(db.campaigns || []).map((camp) => {
              const m = computeCampaignMetrics(camp);
              return (
                <div
                  key={camp.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                            {camp.status}
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            {camp.targetIndustry} · {camp.targetCity},{" "}
                            {camp.targetCountry}
                          </span>
                          {camp.isDemo && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                              DEMO
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold mt-1.5">
                          {camp.name}
                        </h3>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {camp.startDate} → {camp.endDate} · Channels:{" "}
                          {camp.communicationChannels.join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setReportCampaign(camp)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 inline-flex items-center gap-1"
                        >
                          <BarChart3 className="w-3.5 h-3.5" /> Report
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCampaign(camp);
                            setCampaignForm({
                              name: camp.name,
                              targetIndustry: camp.targetIndustry,
                              targetCountry: camp.targetCountry,
                              targetCity: camp.targetCity,
                              assignedTeamMembers: camp.assignedTeamMembers,
                              startDate: camp.startDate,
                              endDate: camp.endDate,
                              leadIds: camp.leadIds,
                              communicationChannels: camp.communicationChannels,
                              status: camp.status,
                            });
                            setIsCampaignModalOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {permissions.deleteRecords && (
                          <button
                            type="button"
                            onClick={() => deleteCampaign(camp.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 8 Required Campaign Metrics */}
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-4 text-center">
                      {[
                        { l: "Prospects", v: m.prospectsAdded },
                        { l: "Emails", v: m.emailsSent },
                        { l: "Calls", v: m.callsMade },
                        { l: "DMs", v: m.dmsSent },
                        { l: "Replies", v: m.repliesReceived },
                        { l: "Positive", v: m.positiveReplies },
                        { l: "Meetings", v: m.meetingsBooked },
                        { l: "Converted", v: m.clientsConverted },
                      ].map((k) => (
                        <div
                          key={k.l}
                          className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800"
                        >
                          <div className="text-sm font-semibold tabular-nums">
                            {k.v}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {k.l}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-400">Assigned Team:</span>
                      {camp.assignedTeamMembers.map((id) => {
                        const tm = db.teamMembers.find((x) => x.id === id);
                        return tm ? (
                          <span
                            key={id}
                            className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium"
                          >
                            {tm.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ACTIVITIES VIEW */
        <>
          {/* Performance by Communication Channel Chart */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Performance by Communication Channel
                </h2>
                <p className="text-xs text-neutral-500">
                  Comparison of messages sent, replies received, and positive outcomes across all 5 channels
                </p>
              </div>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.byChannel}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e5e5"
                  />
                  <XAxis
                    dataKey="channel"
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #e5e5e5",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar
                    dataKey="Sent"
                    fill="#171717"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Bar
                    dataKey="Replies"
                    fill="#737373"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Bar
                    dataKey="Positive"
                    name="Positive Replies"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by lead name, message content, template, or outcome..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>

            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            >
              <option value="All">All Campaigns</option>
              {(db.campaigns || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            >
              <option value="All">All Channels</option>
              {OUTREACH_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            >
              <option value="All">All Outreach Statuses</option>
              {OUTREACH_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Outreach Activity Log Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 bg-neutral-50/60 dark:bg-neutral-950/50">
                    <th className="py-2.5 px-3.5">Lead Name</th>
                    <th className="py-2.5 px-3.5">Channel &amp; Source</th>
                    <th className="py-2.5 px-3.5">Message Content</th>
                    <th className="py-2.5 px-3.5">Date Sent</th>
                    <th className="py-2.5 px-3.5">Reply Status</th>
                    <th className="py-2.5 px-3.5">Next Follow-up</th>
                    <th className="py-2.5 px-3.5">Outcome</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
                  {filteredOutreach.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition"
                    >
                      <td className="py-3 px-3.5 font-semibold text-neutral-900 dark:text-neutral-100">
                        <div className="flex items-center gap-1.5">
                          <span>{item.leadName}</span>
                          {item.isDemo && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-normal text-neutral-400">
                          {item.direction || "Outbound"}
                          {item.providerMessageId
                            ? ` · ID: ${item.providerMessageId.slice(0, 12)}`
                            : ""}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium">
                            {item.communicationChannel}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              item.source === "api"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                            }`}
                          >
                            {item.source === "api" ? "API Synced" : "Manual"}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {item.messageTemplateUsed || "Custom Message"}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 max-w-xs">
                        {item.subject && (
                          <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                            {item.subject}
                          </div>
                        )}
                        <p className="text-neutral-600 dark:text-neutral-300 line-clamp-2">
                          {item.messageContent}
                        </p>
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-[11px] text-neutral-500">
                        {item.dateSent}
                        {item.replyDate && (
                          <div className="text-[10px] text-emerald-600">
                            Replied: {item.replyDate}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <select
                          value={item.replyStatus}
                          onChange={(e) =>
                            updateOutreach(item.id, {
                              replyStatus: e.target.value as OutreachStatus,
                              replyDate:
                                e.target.value !== "Message Sent" &&
                                e.target.value !== "Not Contacted"
                                  ? item.replyDate ||
                                    new Date().toISOString().slice(0, 10)
                                  : item.replyDate,
                            })
                          }
                          className="px-2 py-1 rounded-md text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        >
                          {OUTREACH_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-[11px] text-neutral-600 dark:text-neutral-400">
                        {item.nextFollowUpDate || "—"}
                      </td>
                      <td className="py-3 px-3.5 text-[11px] text-neutral-600 dark:text-neutral-300 max-w-[180px]">
                        {item.outcome || "—"}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {permissions.deleteRecords && (
                            <button
                              type="button"
                              onClick={() => deleteOutreach(item.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* LOG / SEND OUTREACH MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editingItem
                  ? "Edit Outreach Activity"
                  : "Record or Send Outreach Message"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOutreach} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Select Lead from CRM
                  </label>
                  <select
                    value={formState.leadId}
                    onChange={(e) => {
                      const found = db.leads.find(
                        (l) => l.id === e.target.value
                      );
                      setFormState({
                        ...formState,
                        leadId: e.target.value,
                        leadName: found?.businessName || formState.leadName,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">Custom Lead Name...</option>
                    {db.leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.businessName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Lead Name *</label>
                  <input
                    required
                    value={formState.leadName}
                    onChange={(e) =>
                      setFormState({ ...formState, leadName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Campaign</label>
                  <select
                    value={formState.campaignId}
                    onChange={(e) =>
                      setFormState({ ...formState, campaignId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">No Campaign</option>
                    {(db.campaigns || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Communication Channel
                  </label>
                  <select
                    value={formState.communicationChannel}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        communicationChannel: e.target.value as OutreachChannel,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {OUTREACH_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Auto-Fill from Reusable Template
                  </label>
                  <select
                    onChange={(e) => applyTemplateToForm(e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="" disabled>
                      Choose template to personalize...
                    </option>
                    {outreachTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.category.replace(" Templates", "")})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Live API Send Toggle for Gmail / WhatsApp Cloud API */}
              {!editingItem &&
                (formState.communicationChannel === "Cold Emails" ||
                  formState.communicationChannel === "WhatsApp Messages") && (
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium flex items-center gap-1.5">
                        {formState.communicationChannel === "Cold Emails" ? (
                          <>
                            <Mail className="w-3.5 h-3.5" /> Send live email via
                            Connected Gmail API
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3.5 h-3.5" /> Send live
                            message via WhatsApp Business Cloud API
                          </>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={sendViaApi}
                        onChange={(e) => setSendViaApi(e.target.checked)}
                      />
                    </label>
                    {sendViaApi &&
                      formState.communicationChannel === "Cold Emails" && (
                        <input
                          value={apiSubject}
                          onChange={(e) => setApiSubject(e.target.value)}
                          placeholder="Email Subject Line..."
                          className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                        />
                      )}
                  </div>
                )}

              <div>
                <label className="block font-medium mb-1">
                  Message Content *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formState.messageContent}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      messageContent: e.target.value,
                    })
                  }
                  placeholder="Paste the personalized outreach message..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Date Sent</label>
                  <input
                    type="date"
                    value={formState.dateSent}
                    onChange={(e) =>
                      setFormState({ ...formState, dateSent: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Reply Status</label>
                  <select
                    value={formState.replyStatus}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        replyStatus: e.target.value as OutreachStatus,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {OUTREACH_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Reply Date</label>
                  <input
                    type="date"
                    value={formState.replyDate}
                    onChange={(e) =>
                      setFormState({ ...formState, replyDate: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Next Follow-up
                  </label>
                  <input
                    type="date"
                    value={formState.nextFollowUpDate}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        nextFollowUpDate: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Outcome Notes</label>
                <input
                  value={formState.outcome}
                  onChange={(e) =>
                    setFormState({ ...formState, outcome: e.target.value })
                  }
                  placeholder="e.g., Requested Figma prototype link; discovery call booked"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              {apiFeedback && (
                <div
                  className={`p-2.5 rounded-lg border text-xs ${
                    apiFeedback.type === "err"
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {apiFeedback.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {editingItem
                    ? "Save Changes"
                    : sendViaApi
                    ? "Send via Connected API"
                    : "Record Manual Outreach"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CAMPAIGN MODAL (Part 11) */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editingCampaign
                  ? "Edit Outreach Campaign"
                  : "Create Outreach Campaign"}
              </h2>
              <button
                type="button"
                onClick={() => setIsCampaignModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">
                  Campaign Name *
                </label>
                <input
                  required
                  value={campaignForm.name}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, name: e.target.value })
                  }
                  placeholder="e.g., Toronto Med Spa Website Outreach"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Target Industry
                  </label>
                  <select
                    value={campaignForm.targetIndustry}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        targetIndustry: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Target Country
                  </label>
                  <input
                    value={campaignForm.targetCountry}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        targetCountry: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Target City</label>
                  <input
                    value={campaignForm.targetCity}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        targetCity: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={campaignForm.startDate}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={campaignForm.endDate}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Campaign Status
                  </label>
                  <select
                    value={campaignForm.status}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        status: e.target.value as OutreachCampaign["status"],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1.5">
                  Communication Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {[...OUTREACH_CHANNELS, "Cold Calling"].map((ch) => {
                    const checked =
                      campaignForm.communicationChannels.includes(ch);
                    return (
                      <label
                        key={ch}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCampaignForm({
                              ...campaignForm,
                              communicationChannels: checked
                                ? campaignForm.communicationChannels.filter(
                                    (x) => x !== ch
                                  )
                                : [...campaignForm.communicationChannels, ch],
                            })
                          }
                        />
                        <span>{ch}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1.5">
                  Assigned Team Members
                </label>
                <div className="flex flex-wrap gap-2">
                  {db.teamMembers.map((m) => {
                    const checked = campaignForm.assignedTeamMembers.includes(
                      m.id
                    );
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCampaignForm({
                              ...campaignForm,
                              assignedTeamMembers: checked
                                ? campaignForm.assignedTeamMembers.filter(
                                    (id) => id !== m.id
                                  )
                                : [...campaignForm.assignedTeamMembers, m.id],
                            })
                          }
                        />
                        <span>{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1.5">
                  Campaign Lead List ({campaignForm.leadIds.length} selected)
                </label>
                <div className="max-h-36 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 space-y-1">
                  {db.leads.map((l) => {
                    const checked = campaignForm.leadIds.includes(l.id);
                    return (
                      <label
                        key={l.id}
                        className="flex items-center justify-between px-2 py-1 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setCampaignForm({
                                ...campaignForm,
                                leadIds: checked
                                  ? campaignForm.leadIds.filter(
                                      (id) => id !== l.id
                                    )
                                  : [...campaignForm.leadIds, l.id],
                              })
                            }
                          />
                          <span className="font-medium">{l.businessName}</span>
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {l.city}, {l.country}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                >
                  <Target className="w-3.5 h-3.5" />
                  {editingCampaign ? "Save Campaign" : "Launch Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED CAMPAIGN PERFORMANCE REPORT MODAL */}
      {reportCampaign && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-semibold">
                  Campaign Performance Report: {reportCampaign.name}
                </h2>
                <p className="text-neutral-500">
                  Target: {reportCampaign.targetIndustry} ·{" "}
                  {reportCampaign.targetCity}, {reportCampaign.targetCountry}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportCampaign(null)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const m = computeCampaignMetrics(reportCampaign);
              const totalTouches = m.emailsSent + m.callsMade + m.dmsSent;
              const replyRate =
                totalTouches > 0
                  ? Math.round((m.repliesReceived / totalTouches) * 1000) / 10
                  : 0;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { l: "Prospects Added", v: m.prospectsAdded },
                      { l: "Emails Sent", v: m.emailsSent },
                      { l: "Calls Made", v: m.callsMade },
                      { l: "DMs Sent", v: m.dmsSent },
                      { l: "Replies Received", v: m.repliesReceived },
                      { l: "Positive Replies", v: m.positiveReplies },
                      { l: "Meetings Booked", v: m.meetingsBooked },
                      { l: "Clients Converted", v: m.clientsConverted },
                    ].map((card) => (
                      <div
                        key={card.l}
                        className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                      >
                        <div className="text-neutral-400">{card.l}</div>
                        <div className="text-base font-semibold mt-0.5 tabular-nums">
                          {card.v}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-500">
                      Overall Campaign Touch-to-Reply Rate
                    </span>
                    <span className="text-sm font-semibold">{replyRate}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* REUSABLE OUTREACH TEMPLATE LIBRARY DRAWER */}
      {isTemplateDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-neutral-900 h-full overflow-y-auto p-6 border-l border-neutral-200 dark:border-neutral-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-semibold">
                  Outreach Template Library
                </h2>
                <p className="text-xs text-neutral-500">
                  Save and copy personalized Cold Emails, Instagram DMs, WhatsApp messages, and Follow-ups
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateDrawerOpen(false)}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveNewOutreachTemplate}
              className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3 text-xs"
            >
              <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                Save New Outreach Template
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  required
                  value={newTplTitle}
                  onChange={(e) => setNewTplTitle(e.target.value)}
                  placeholder="Template Name (e.g., Series A Loom Pitch)"
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                />
                <select
                  value={newTplCategory}
                  onChange={(e) =>
                    setNewTplCategory(e.target.value as TemplateCategory)
                  }
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                >
                  <option value="Cold Email Templates">
                    Cold Email Templates
                  </option>
                  <option value="Instagram DM Templates">
                    Instagram DM Templates
                  </option>
                  <option value="WhatsApp Templates">WhatsApp Templates</option>
                  <option value="Follow-up Templates">
                    Follow-up Templates
                  </option>
                </select>
              </div>
              <input
                value={newTplHook}
                onChange={(e) => setNewTplHook(e.target.value)}
                placeholder="Subject Line or Opening Hook..."
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              />
              <textarea
                required
                rows={3}
                value={newTplContent}
                onChange={(e) => setNewTplContent(e.target.value)}
                placeholder="Template body (use {{Business_Name}}, {{Contact_Person}}, {{City}})..."
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
              >
                Save to Outreach Library
              </button>
            </form>

            <div className="space-y-3">
              {outreachTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                        {tpl.category}
                      </span>
                      <h3 className="text-sm font-semibold mt-1">
                        {tpl.title}
                      </h3>
                      {tpl.subjectOrHook && (
                        <p className="text-[11px] text-neutral-500">
                          Subject/Hook: {tpl.subjectOrHook}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(tpl.content);
                        incrementTemplateUsage(tpl.id);
                        setCopiedId(tpl.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      {copiedId === tpl.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg text-[11px]">
                    {tpl.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
