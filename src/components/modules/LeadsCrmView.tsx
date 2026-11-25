"use client";

import React, { useMemo, useRef, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  AGENCY_SERVICES,
  buildLeadUnifiedTimeline,
  formatCurrency,
  INDUSTRIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PRIORITY_LEVELS,
} from "@/lib/constants";
import {
  detectLeadDuplicate,
  isValidEmail,
  isValidUrl,
} from "@/lib/validation";
import {
  buildPersonalizedOutreachMessages,
  cleanWhatsAppPhone,
  detectNewlyAddedSocialChannels,
  extractInstagramHandle,
  SocialOutreachChannel,
} from "@/lib/auto-outreach";
import { Lead, LeadSource, LeadStatus, PriorityLevel } from "@/types/agency";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  History,
  Kanban,
  LayoutList,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

const PRIORITY_RANK: Record<PriorityLevel, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const MAPPABLE_CRM_FIELDS: { key: keyof Lead; label: string }[] = [
  { key: "businessName", label: "Business Name *" },
  { key: "contactPerson", label: "Contact Person" },
  { key: "businessEmail", label: "Business Email" },
  { key: "phoneNumber", label: "WhatsApp / Phone" },
  { key: "instagramUrl", label: "Instagram (@handle / URL)" },
  { key: "websiteUrl", label: "Website URL" },
  { key: "industry", label: "Industry" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "leadSource", label: "Lead Source" },
  { key: "estimatedProjectValue", label: "Estimated Value" },
  { key: "personalizationNotes", label: "Personalization Notes" },
  { key: "potentialOpportunity", label: "Potential Opportunity" },
];

export function LeadsCrmView() {
  const {
    db,
    currentUser,
    permissions,
    addLead,
    updateLead,
    sendLeadPersonalizedOutreach,
    lastAutoOutreachResult,
    clearAutoOutreachResult,
    deleteLead,
    bulkUpdateLeads,
    bulkDeleteLeads,
    addLeadNote,
    importLeadsWithResolution,
    convertLeadToClient,
    setActiveSection,
    setSelectedClientId,
    setSelectedProjectId,
  } = useAgency();

  const defaultCurrency = db.settings.defaultCurrency;

  // View mode: table vs kanban
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("All");
  const [filterIndustry, setFilterIndustry] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy] = useState<"dateAdded" | "priority" | "value">(
    "dateAdded"
  );
  const [sortAsc, setSortAsc] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>("Contacted");
  const [bulkAssignee, setBulkAssignee] = useState<string>("");

  // Modals & Drawers
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<
    "timeline" | "details" | "history"
  >("timeline");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [convertModalLead, setConvertModalLead] = useState<Lead | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Part 6 — Interactive CSV & Google Sheets Importer Modal State
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [importSourceType, setImportSourceType] = useState<
    "CSV Upload" | "Google Sheets"
  >("CSV Upload");
  const [importSourceLabel, setImportSourceLabel] = useState("");
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [sheetRangeInput, setSheetRangeInput] = useState("Sheet1!A1:Z200");
  const [sheetError, setSheetError] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<
    "skip" | "update" | "create"
  >("skip");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamic filter options
  const countries = useMemo(() => {
    const set = new Set(db.leads.map((l) => l.country).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [db.leads]);

  const industries = useMemo(() => {
    const set = new Set([
      ...INDUSTRIES,
      ...db.leads.map((l) => l.industry).filter(Boolean),
    ]);
    return ["All", ...Array.from(set)];
  }, [db.leads]);

  // Filtered & sorted leads
  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.leads
      .filter((l) => {
        if (filterCountry !== "All" && l.country !== filterCountry)
          return false;
        if (filterIndustry !== "All" && l.industry !== filterIndustry)
          return false;
        if (filterSource !== "All" && l.leadSource !== filterSource)
          return false;
        if (filterStatus !== "All" && l.status !== filterStatus) return false;
        if (!q) return true;
        return (
          l.businessName.toLowerCase().includes(q) ||
          l.contactPerson.toLowerCase().includes(q) ||
          l.businessEmail.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q) ||
          l.industry.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === "dateAdded") {
          cmp = a.dateAdded.localeCompare(b.dateAdded);
        } else if (sortBy === "priority") {
          cmp =
            PRIORITY_RANK[a.leadPriority] - PRIORITY_RANK[b.leadPriority];
        } else {
          cmp = a.estimatedProjectValue - b.estimatedProjectValue;
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [
    db.leads,
    search,
    filterCountry,
    filterIndustry,
    filterSource,
    filterStatus,
    sortBy,
    sortAsc,
  ]);

  const activeLead = useMemo(
    () => db.leads.find((l) => l.id === activeLeadId) || null,
    [db.leads, activeLeadId]
  );

  // Unified Communication Timeline for the active lead (Part 10)
  const unifiedTimeline = useMemo(() => {
    if (!activeLead) return [];
    return buildLeadUnifiedTimeline(
      activeLead,
      db.outreach,
      db.coldCalls || [],
      db.teamMembers
    );
  }, [activeLead, db.outreach, db.coldCalls, db.teamMembers]);

  // Form State for Add / Edit Lead (all 26 fields + WhatsApp Opt-In)
  const emptyForm = {
    businessName: "",
    contactPerson: "",
    industry: INDUSTRIES[0],
    country: "United States",
    city: "San Francisco",
    businessEmail: "",
    phoneNumber: "",
    websiteUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    googleMapsUrl: "",
    leadSource: "Google Maps" as LeadSource,
    businessDescription: "",
    websiteStatus: "Outdated Website" as Lead["websiteStatus"],
    rating: 4.8,
    numberOfReviews: 45,
    personalizationNotes: "",
    potentialOpportunity: "",
    estimatedProjectValue: 20000,
    leadPriority: "High" as PriorityLevel,
    status: "New" as LeadStatus,
    assignedTeamMemberId: currentUser.id,
    dateAdded: new Date().toISOString().slice(0, 10),
    lastContacted: "",
    nextFollowUpDate: new Date(Date.now() + 3 * 86400000)
      .toISOString()
      .slice(0, 10),
    whatsappOptIn: false,
  };

  const [formState, setFormState] = useState(emptyForm);

  // Auto-Personalized DM on Add / Social Update state
  const [autoDmOnSave, setAutoDmOnSave] = useState(true);
  const [selectedAutoChannels, setSelectedAutoChannels] = useState<
    Record<SocialOutreachChannel, boolean>
  >({
    instagram: true,
    email: true,
    whatsapp: true,
  });
  const [previewChannelTab, setPreviewChannelTab] =
    useState<SocialOutreachChannel>("instagram");
  const [customIgMsg, setCustomIgMsg] = useState("");
  const [customEmailSubj, setCustomEmailSubj] = useState("");
  const [customEmailBody, setCustomEmailBody] = useState("");
  const [customWaMsg, setCustomWaMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick Add Socials & Auto-DM Modal state
  const [quickSocialLead, setQuickSocialLead] = useState<Lead | null>(null);
  const [quickIgInput, setQuickIgInput] = useState("");
  const [quickEmailInput, setQuickEmailInput] = useState("");
  const [quickPhoneInput, setQuickPhoneInput] = useState("");
  const [quickSending, setQuickSending] = useState(false);

  const generatedFormPreview = useMemo(
    () =>
      buildPersonalizedOutreachMessages(
        formState,
        db.templates,
        currentUser.name,
        db.settings.agencyName
      ),
    [formState, db.templates, currentUser.name, db.settings.agencyName]
  );

  const detectedModalChannels = useMemo(
    () => detectNewlyAddedSocialChannels(editingLead, formState),
    [editingLead, formState]
  );

  const activePreviewChannel: SocialOutreachChannel =
    detectedModalChannels.includes(previewChannelTab)
      ? previewChannelTab
      : detectedModalChannels[0] || "instagram";

  const resetAutoDmCustomizations = () => {
    setAutoDmOnSave(true);
    setSelectedAutoChannels({ instagram: true, email: true, whatsapp: true });
    setCustomIgMsg("");
    setCustomEmailSubj("");
    setCustomEmailBody("");
    setCustomWaMsg("");
  };

  const copyTextWithFeedback = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2500);
    } catch {
      // clipboard fallback ignored
    }
  };

  const openQuickSocialModal = (lead: Lead) => {
    setQuickSocialLead(lead);
    const handle = extractInstagramHandle(
      lead.instagramUrl || lead.instagramHandle
    );
    setQuickIgInput(handle ? `@${handle}` : lead.instagramUrl || "");
    setQuickEmailInput(lead.businessEmail || "");
    setQuickPhoneInput(lead.phoneNumber || "");
  };

  const handleSaveQuickSocials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSocialLead) return;
    setQuickSending(true);
    try {
      const updates: Partial<Lead> = {
        instagramUrl: quickIgInput.trim(),
        businessEmail: quickEmailInput.trim(),
        phoneNumber: quickPhoneInput.trim(),
        whatsappOptIn:
          cleanWhatsAppPhone(quickPhoneInput).length >= 7
            ? true
            : quickSocialLead.whatsappOptIn,
      };
      const newlyAdded = detectNewlyAddedSocialChannels(
        quickSocialLead,
        updates
      );
      // If user clicked Send DM when socials were already present, send to all available channels
      const fallbackAllChannels: SocialOutreachChannel[] = [];
      if (extractInstagramHandle(updates.instagramUrl))
        fallbackAllChannels.push("instagram");
      if (updates.businessEmail && isValidEmail(updates.businessEmail))
        fallbackAllChannels.push("email");
      if (cleanWhatsAppPhone(updates.phoneNumber).length >= 7)
        fallbackAllChannels.push("whatsapp");

      const targetChannels =
        newlyAdded.length > 0 ? newlyAdded : fallbackAllChannels;

      updateLead(quickSocialLead.id, updates, {
        enabled: targetChannels.length > 0,
        channels: targetChannels,
      });
      setQuickSocialLead(null);
    } finally {
      setQuickSending(false);
    }
  };

  const openAddModal = () => {
    setEditingLead(null);
    setFormState({ ...emptyForm, whatsappOptIn: true });
    resetAutoDmCustomizations();
    setIsFormOpen(true);
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    resetAutoDmCustomizations();
    setFormState({
      businessName: lead.businessName,
      contactPerson: lead.contactPerson,
      industry: lead.industry,
      country: lead.country,
      city: lead.city,
      businessEmail: lead.businessEmail,
      phoneNumber: lead.phoneNumber,
      websiteUrl: lead.websiteUrl,
      instagramUrl: lead.instagramUrl,
      facebookUrl: lead.facebookUrl,
      linkedinUrl: lead.linkedinUrl,
      googleMapsUrl: lead.googleMapsUrl,
      leadSource: lead.leadSource,
      businessDescription: lead.businessDescription,
      websiteStatus: lead.websiteStatus,
      rating: lead.rating,
      numberOfReviews: lead.numberOfReviews,
      personalizationNotes: lead.personalizationNotes,
      potentialOpportunity: lead.potentialOpportunity,
      estimatedProjectValue: lead.estimatedProjectValue,
      leadPriority: lead.leadPriority,
      status: lead.status,
      assignedTeamMemberId: lead.assignedTeamMemberId,
      dateAdded: lead.dateAdded,
      lastContacted: lead.lastContacted,
      nextFollowUpDate: lead.nextFollowUpDate,
      whatsappOptIn: Boolean(lead.whatsappOptIn),
    });
    setIsFormOpen(true);
  };

  const handleSaveLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.businessName.trim()) return;
    const normalizedPayload = {
      ...formState,
      contactPerson: formState.contactPerson.trim() || "Founder",
      whatsappOptIn:
        formState.whatsappOptIn ||
        cleanWhatsAppPhone(formState.phoneNumber).length >= 7,
    };
    const activeChannels = detectedModalChannels.filter(
      (ch) => selectedAutoChannels[ch]
    );
    const autoOpts = {
      enabled: autoDmOnSave && activeChannels.length > 0,
      channels: activeChannels,
      customMessages: {
        instagramMessage: customIgMsg.trim() || undefined,
        emailSubject: customEmailSubj.trim() || undefined,
        emailBody: customEmailBody.trim() || undefined,
        whatsappMessage: customWaMsg.trim() || undefined,
      },
    };

    if (editingLead) {
      updateLead(editingLead.id, normalizedPayload, autoOpts);
      if (
        normalizedPayload.status === "Converted" &&
        !editingLead.convertedClientId
      ) {
        setConvertModalLead({ ...editingLead, ...normalizedPayload });
      }
    } else {
      const created = addLead(normalizedPayload, autoOpts);
      if (normalizedPayload.status === "Converted") {
        setConvertModalLead(created);
      }
    }
    setIsFormOpen(false);
  };

  // Convert Lead Modal State
  const [convServices, setConvServices] = useState<string[]>([
    "Custom Website Design (UI/UX)",
    "Next.js Full-Stack Development",
  ]);
  const [convCreateProject, setConvCreateProject] = useState(true);
  const [convProjectName, setConvProjectName] = useState("");
  const [convProjectBudget, setConvProjectBudget] = useState(25000);
  const [convProjectDeadline, setConvProjectDeadline] = useState(
    new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)
  );

  const openConvertLeadModal = (lead: Lead) => {
    setConvertModalLead(lead);
    setConvProjectName(`${lead.businessName} — Web Platform`);
    setConvProjectBudget(lead.estimatedProjectValue || 24000);
  };

  const handleConfirmConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertModalLead) return;
    const result = await convertLeadToClient({
      leadId: convertModalLead.id,
      servicesPurchased: convServices,
      createProject: convCreateProject,
      projectName: convProjectName,
      projectType: convServices[0] || "Next.js Full-Stack Development",
      projectBudget: Number(convProjectBudget) || 20000,
      projectDeadline: convProjectDeadline,
    });
    setConvertModalLead(null);
    if (result?.project) {
      setSelectedProjectId(result.project.id);
      setActiveSection("projects");
    } else if (result?.client) {
      setSelectedClientId(result.client.id);
      setActiveSection("clients");
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Business Name",
      "Contact Person",
      "Industry",
      "Country",
      "City",
      "Business Email",
      "Phone Number",
      "Website URL",
      "Instagram URL",
      "Facebook URL",
      "LinkedIn URL",
      "Google Maps URL",
      "Lead Source",
      "Website Status",
      "Rating",
      "Number of Reviews",
      "Estimated Project Value",
      "Lead Priority",
      "Status",
      "Date Added",
      "Last Contacted",
      "Next Follow-up Date",
      "Personalization Notes",
      "Potential Opportunity",
    ];
    const rows = filteredLeads.map((l) => [
      l.businessName,
      l.contactPerson,
      l.industry,
      l.country,
      l.city,
      l.businessEmail,
      l.phoneNumber,
      l.websiteUrl,
      l.instagramUrl,
      l.facebookUrl,
      l.linkedinUrl,
      l.googleMapsUrl,
      l.leadSource,
      l.websiteStatus,
      String(l.rating),
      String(l.numberOfReviews),
      String(l.estimatedProjectValue),
      l.leadPriority,
      l.status,
      l.dateAdded,
      l.lastContacted,
      l.nextFollowUpDate,
      l.personalizationNotes,
      l.potentialOpportunity,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `twofold-studio-leads-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Part 6 — CSV & Google Sheets Parser + Auto Column Mapper
  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const autoGuessMapping = (headers: string[]) => {
    const guessed: Record<string, number> = {};
    const matchHeader = (patterns: string[]) =>
      headers.findIndex((h) =>
        patterns.some((p) => h.toLowerCase().includes(p))
      );

    guessed.businessName = matchHeader(["business", "company", "organization", "name"]);
    guessed.contactPerson = matchHeader(["contact", "person", "founder", "owner"]);
    guessed.businessEmail = matchHeader(["email", "e-mail", "mail"]);
    guessed.phoneNumber = matchHeader(["phone", "tel", "mobile", "whatsapp"]);
    guessed.instagramUrl = matchHeader(["instagram", "insta", "ig_handle"]);
    guessed.websiteUrl = matchHeader(["website", "url", "domain", "site"]);
    guessed.industry = matchHeader(["industry", "category", "niche", "sector"]);
    guessed.country = matchHeader(["country", "nation"]);
    guessed.city = matchHeader(["city", "town", "location"]);
    guessed.leadSource = matchHeader(["source", "channel"]);
    guessed.estimatedProjectValue = matchHeader(["value", "budget", "deal"]);
    guessed.personalizationNotes = matchHeader(["note", "personalization", "hook"]);
    guessed.potentialOpportunity = matchHeader(["opportunity", "scope"]);
    return guessed;
  };

  const handleFileChosenForImporter = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map(parseCsvLine);
    setImportSourceType("CSV Upload");
    setImportSourceLabel(file.name);
    setRawHeaders(headers);
    setRawRows(rows);
    setColumnMap(autoGuessMapping(headers));
    setIsImporterOpen(true);
    e.target.value = "";
  };

  const handleFetchGoogleSheet = async () => {
    setSheetError("");
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "fetch_google_sheet",
        spreadsheetId: sheetUrlInput,
        worksheet: sheetRangeInput,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setSheetError(
        data.error || "Unable to fetch Google Sheet. Check integration status."
      );
      return;
    }
    const headers = (data.headers || []) as string[];
    const rows = (data.rows || []) as string[][];
    setImportSourceType("Google Sheets");
    setImportSourceLabel(`Google Sheet (${sheetRangeInput})`);
    setRawHeaders(headers);
    setRawRows(rows);
    setColumnMap(autoGuessMapping(headers));
  };

  // Preview mapped rows with live validation & 4-field duplicate detection
  const mappedPreviewRows = useMemo(() => {
    return rawRows.map((cols, idx) => {
      const getVal = (field: string) => {
        const colIdx = columnMap[field];
        return colIdx != null && colIdx >= 0 ? cols[colIdx] || "" : "";
      };

      const candidate: Partial<Lead> = {
        businessName: getVal("businessName"),
        contactPerson: getVal("contactPerson") || "Founder",
        businessEmail: getVal("businessEmail"),
        phoneNumber: getVal("phoneNumber"),
        instagramUrl: getVal("instagramUrl"),
        websiteUrl: getVal("websiteUrl"),
        industry: getVal("industry") || "SaaS & Technology",
        country: getVal("country") || "United States",
        city: getVal("city") || "",
        leadSource: (LEAD_SOURCES.includes(getVal("leadSource") as LeadSource)
          ? getVal("leadSource")
          : "Other") as LeadSource,
        estimatedProjectValue: Number(getVal("estimatedProjectValue")) || 18000,
        personalizationNotes: getVal("personalizationNotes"),
        potentialOpportunity: getVal("potentialOpportunity"),
      };

      const rowErrors: string[] = [];
      if (!candidate.businessName?.trim()) {
        rowErrors.push("Missing Business Name");
      }
      if (candidate.businessEmail && !isValidEmail(candidate.businessEmail)) {
        rowErrors.push(`Invalid email (${candidate.businessEmail})`);
      }
      if (candidate.websiteUrl && !isValidUrl(candidate.websiteUrl)) {
        rowErrors.push(`Invalid URL (${candidate.websiteUrl})`);
      }

      const duplicate = detectLeadDuplicate(candidate, db.leads);

      return {
        rowNumber: idx + 1,
        candidate,
        rowErrors,
        duplicate,
      };
    });
  }, [rawRows, columnMap, db.leads]);

  const handleConfirmMappedImport = async () => {
    const job = await importLeadsWithResolution({
      rows: mappedPreviewRows.map((r) => r.candidate),
      duplicateStrategy,
      source: importSourceType,
      sourceLabel: importSourceLabel || importSourceType,
    });
    setIsImporterOpen(false);
    setRawHeaders([]);
    setRawRows([]);
    if (job) {
      setImportFeedback(
        `${job.source} Complete: ${job.createdCount} created, ${job.updatedCount} updated, ${job.skippedCount} duplicates skipped, ${job.errorCount} validation errors.`
      );
      setTimeout(() => setImportFeedback(null), 6000);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Leads &amp; Agency CRM
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {filteredLeads.length} prospects in pipeline · Total Pipeline Value:{" "}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {formatCurrency(
                filteredLeads.reduce((s, l) => s + l.estimatedProjectValue, 0),
                defaultCurrency
              )}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                viewMode === "table"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                viewMode === "kanban"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChosenForImporter}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              setRawHeaders([]);
              setRawRows([]);
              setIsImporterOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Import CSV / Google Sheets
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>
        </div>
      </div>

      {importFeedback && (
        <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{importFeedback}</span>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            className="text-emerald-800 dark:text-emerald-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AUTO-PERSONALIZED DM & OUTREACH DISPATCH BANNER */}
      {lastAutoOutreachResult && lastAutoOutreachResult.results.length > 0 && (
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border-2 border-emerald-500/50 dark:border-emerald-500/40 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Send className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Personalized Outreach Generated for{" "}
                  {lastAutoOutreachResult.businessName}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Logged to Unified Timeline &amp; CRM status updated to{" "}
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    Contacted
                  </span>
                  . Connected APIs send automatically; use 1-click buttons below
                  to launch direct app threads.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearAutoOutreachResult}
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {lastAutoOutreachResult.results.map((item) => (
              <div
                key={item.outreachId}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between gap-2.5 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.label} ·{" "}
                      <span className="font-normal text-neutral-500">
                        {item.target}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        item.sentViaApi
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}
                    >
                      {item.sentViaApi ? "Sent via API" : "Ready · Logged"}
                    </span>
                  </div>
                  {item.subject && (
                    <div className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 truncate">
                      Subject: {item.subject}
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-500 line-clamp-3 whitespace-pre-line">
                    {item.messagePreview}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-200/60 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() =>
                      copyTextWithFeedback(item.outreachId, item.messagePreview)
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium"
                  >
                    {copiedKey === item.outreachId ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Copied DM
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy DM
                      </>
                    )}
                  </button>

                  {item.launchUrl && (
                    <a
                      href={item.launchUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (item.channel === "instagram") {
                          navigator.clipboard
                            ?.writeText(item.messagePreview)
                            .catch(() => {});
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 text-[11px] font-medium"
                    >
                      {item.channel === "instagram"
                        ? "Copy & Open IG DM"
                        : item.channel === "whatsapp"
                        ? "Send on WhatsApp"
                        : "Open in Gmail"}{" "}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filters & Sorting Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, contact, email, city..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          {countries.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All Countries" : c}
            </option>
          ))}
        </select>

        <select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind === "All" ? "All Industries" : ind}
            </option>
          ))}
        </select>

        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Statuses</option>
          {LEAD_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "dateAdded" | "priority" | "value")
            }
            className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          >
            <option value="dateAdded">Sort: Date Added</option>
            <option value="priority">Sort: Priority</option>
            <option value="value">Sort: Est. Value</option>
          </select>
          <button
            type="button"
            onClick={() => setSortAsc((p) => !p)}
            title="Toggle sort direction"
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CheckSquare className="w-4 h-4" />
            <span>{selectedIds.length} leads selected</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as LeadStatus)}
              className="px-2.5 py-1 text-xs rounded bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 border border-neutral-700"
            >
              {LEAD_STATUSES.map((st) => (
                <option key={st} value={st}>
                  Set Status: {st}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                bulkUpdateLeads(selectedIds, { status: bulkStatus });
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded text-xs font-medium bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white"
            >
              Apply Status
            </button>

            <select
              value={bulkAssignee}
              onChange={(e) => setBulkAssignee(e.target.value)}
              className="px-2.5 py-1 text-xs rounded bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 border border-neutral-700"
            >
              <option value="">Assign Member...</option>
              {db.teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {bulkAssignee && (
              <button
                type="button"
                onClick={() => {
                  bulkUpdateLeads(selectedIds, {
                    assignedTeamMemberId: bulkAssignee,
                  });
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 rounded text-xs font-medium bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white"
              >
                Assign
              </button>
            )}

            {permissions.deleteRecords && (
              <button
                type="button"
                onClick={() => {
                  bulkDeleteLeads(selectedIds);
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-500"
              >
                Delete Selected
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs underline ml-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === "table" ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 bg-neutral-50/60 dark:bg-neutral-950/50">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredLeads.length > 0 &&
                        selectedIds.length === filteredLeads.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-neutral-300"
                    />
                  </th>
                  <th className="py-2.5 px-3">Business &amp; Contact</th>
                  <th className="py-2.5 px-3">Industry &amp; Location</th>
                  <th className="py-2.5 px-3">Source &amp; Site Audit</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Est. Value</th>
                  <th className="py-2.5 px-3">Next Follow-up</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-10 text-center text-neutral-400"
                    >
                      No leads match your current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const assignee = db.teamMembers.find(
                      (m) => m.id === lead.assignedTeamMemberId
                    );
                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition"
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(lead.id)}
                            onChange={() => toggleSelectOne(lead.id)}
                            className="rounded border-neutral-300"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveLeadId(lead.id);
                                setInspectorTab("timeline");
                              }}
                              className="font-semibold text-neutral-900 dark:text-neutral-100 hover:underline text-left"
                            >
                              {lead.businessName}
                            </button>
                            {lead.isDemo && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-semibold">
                                DEMO
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {lead.contactPerson}
                            {lead.businessEmail ? ` · ${lead.businessEmail}` : ""}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {extractInstagramHandle(
                              lead.instagramUrl || lead.instagramHandle
                            ) && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 text-[10px] font-medium">
                                @
                                {extractInstagramHandle(
                                  lead.instagramUrl || lead.instagramHandle
                                )}
                              </span>
                            )}
                            {cleanWhatsAppPhone(lead.phoneNumber).length >= 7 && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px] font-medium">
                                WA: {lead.phoneNumber}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openQuickSocialModal(lead)}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-white text-[10px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition"
                              title="Add Instagram, Email, or WhatsApp & auto-send personalized DM"
                            >
                              <Plus className="w-2.5 h-2.5" /> Socials / Auto-DM
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-neutral-800 dark:text-neutral-200 font-medium">
                            {lead.industry}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {lead.city}, {lead.country}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium">
                              {lead.leadSource}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {lead.rating} ({lead.numberOfReviews})
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {lead.websiteStatus}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={lead.status}
                            onChange={(e) => {
                              const nextSt = e.target.value as LeadStatus;
                              updateLead(lead.id, { status: nextSt });
                              if (
                                nextSt === "Converted" &&
                                !lead.convertedClientId
                              ) {
                                openConvertLeadModal(lead);
                              }
                            }}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                              lead.status === "Converted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                : lead.status === "Proposal Sent" ||
                                  lead.status === "Meeting Scheduled"
                                ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900"
                                : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                            }`}
                          >
                            {LEAD_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              lead.leadPriority === "Urgent"
                                ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                : lead.leadPriority === "High"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                            }`}
                          >
                            {lead.leadPriority}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(
                            lead.estimatedProjectValue,
                            defaultCurrency
                          )}
                          <div className="text-[10px] font-normal text-neutral-400">
                            {assignee?.name || "Unassigned"}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[11px] tabular-nums text-neutral-600 dark:text-neutral-400">
                          {lead.nextFollowUpDate || "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const hasAnySocial =
                                  Boolean(
                                    extractInstagramHandle(
                                      lead.instagramUrl || lead.instagramHandle
                                    )
                                  ) ||
                                  Boolean(
                                    lead.businessEmail &&
                                      isValidEmail(lead.businessEmail)
                                  ) ||
                                  cleanWhatsAppPhone(lead.phoneNumber).length >=
                                    7;
                                if (!hasAnySocial) {
                                  openQuickSocialModal(lead);
                                  return;
                                }
                                sendLeadPersonalizedOutreach({
                                  leadId: lead.id,
                                  lead,
                                });
                              }}
                              title="Send Personalized DM / Email across socials"
                              className="px-2 py-1 rounded text-[11px] font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 inline-flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> Auto-DM
                            </button>
                            {!lead.convertedClientId && (
                              <button
                                type="button"
                                onClick={() => openConvertLeadModal(lead)}
                                title="Convert Lead to Client & Project"
                                className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 inline-flex items-center gap-1"
                              >
                                <UserPlus className="w-3 h-3" /> Convert
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveLeadId(lead.id);
                                setInspectorTab("timeline");
                              }}
                              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                              title="Open Unified Communication Timeline"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(lead)}
                              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                              title="Edit Lead"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {permissions.deleteRecords && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(lead.id)}
                                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/50 text-neutral-400 hover:text-red-600"
                                title="Delete Lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN VIEW */
        <div className="flex gap-3.5 overflow-x-auto pb-4">
          {LEAD_STATUSES.map((statusCol) => {
            const colLeads = filteredLeads.filter(
              (l) => l.status === statusCol
            );
            const colTotal = colLeads.reduce(
              (s, l) => s + l.estimatedProjectValue,
              0
            );
            return (
              <div
                key={statusCol}
                className="w-72 shrink-0 bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 rounded-xl p-3 flex flex-col max-h-[680px]"
              >
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {statusCol}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                      {colLeads.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-neutral-500 tabular-nums">
                    {formatCurrency(colTotal, defaultCurrency, true)}
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
                  {colLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-lg p-3 shadow-2xs hover:border-neutral-400 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLeadId(lead.id);
                            setInspectorTab("timeline");
                          }}
                          className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:underline text-left"
                        >
                          {lead.businessName}
                        </button>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          {lead.leadPriority}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {lead.contactPerson} · {lead.city}, {lead.country}
                      </p>
                      <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1.5">
                        {lead.personalizationNotes || lead.potentialOpportunity}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(
                            lead.estimatedProjectValue,
                            defaultCurrency
                          )}
                        </span>
                        <select
                          value={lead.status}
                          onChange={(e) => {
                            const nextSt = e.target.value as LeadStatus;
                            updateLead(lead.id, { status: nextSt });
                            if (
                              nextSt === "Converted" &&
                              !lead.convertedClientId
                            ) {
                              openConvertLeadModal(lead);
                            }
                          }}
                          className="text-[10px] border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 bg-neutral-50 dark:bg-neutral-800"
                        >
                          {LEAD_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEAD INSPECTOR SLIDE-OVER DRAWER WITH PART 10 UNIFIED COMMUNICATION TIMELINE */}
      {activeLead && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 h-full overflow-y-auto p-6 border-l border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                      {activeLead.status}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {activeLead.leadSource}
                    </span>
                    {activeLead.isDemo && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                        DEMO RECORD
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mt-1">
                    {activeLead.businessName}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {activeLead.contactPerson} · {activeLead.businessEmail} ·{" "}
                    {activeLead.phoneNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeLead.phoneNumber && (
                    <a
                      href={`tel:${activeLead.phoneNumber}`}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 inline-flex items-center gap-1 hover:bg-neutral-50"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
                    </a>
                  )}
                  {!activeLead.convertedClientId && (
                    <button
                      type="button"
                      onClick={() => openConvertLeadModal(activeLead)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Convert to Client
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveLeadId(null)}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inspector Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 text-xs">
                <button
                  type="button"
                  onClick={() => setInspectorTab("timeline")}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                    inspectorTab === "timeline"
                      ? "bg-white dark:bg-neutral-800 shadow-2xs"
                      : "text-neutral-500"
                  }`}
                >
                  Unified Communication Timeline ({unifiedTimeline.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("details")}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                    inspectorTab === "details"
                      ? "bg-white dark:bg-neutral-800 shadow-2xs"
                      : "text-neutral-500"
                  }`}
                >
                  Profile, Notes &amp; Opt-In
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("history")}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                    inspectorTab === "history"
                      ? "bg-white dark:bg-neutral-800 shadow-2xs"
                      : "text-neutral-500"
                  }`}
                >
                  CRM Audit Trail ({activeLead.history.length})
                </button>
              </div>

              {inspectorTab === "timeline" && (
                /* PART 10 — UNIFIED COMMUNICATION TIMELINE */
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">
                      Chronological feed of emails, replies, Instagram DMs, WhatsApp messages, LinkedIn outreach, cold calls, and notes (deduplicated by provider ID).
                    </span>
                  </div>

                  {/* Quick Personalized DM & Socials Trigger inside Drawer */}
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-neutral-600 dark:text-neutral-300 font-medium">
                      Send Personalized DM:
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {extractInstagramHandle(
                        activeLead.instagramUrl || activeLead.instagramHandle
                      ) && (
                        <button
                          type="button"
                          onClick={() =>
                            sendLeadPersonalizedOutreach({
                              leadId: activeLead.id,
                              lead: activeLead,
                              channels: ["instagram"],
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-pink-600 text-white hover:bg-pink-500 font-medium inline-flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Insta DM (@
                          {extractInstagramHandle(
                            activeLead.instagramUrl || activeLead.instagramHandle
                          )}
                          )
                        </button>
                      )}
                      {cleanWhatsAppPhone(activeLead.phoneNumber).length >= 7 && (
                        <button
                          type="button"
                          onClick={() =>
                            sendLeadPersonalizedOutreach({
                              leadId: activeLead.id,
                              lead: activeLead,
                              channels: ["whatsapp"],
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-medium inline-flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> WhatsApp DM
                        </button>
                      )}
                      {activeLead.businessEmail &&
                        isValidEmail(activeLead.businessEmail) && (
                          <button
                            type="button"
                            onClick={() =>
                              sendLeadPersonalizedOutreach({
                                leadId: activeLead.id,
                                lead: activeLead,
                                channels: ["email"],
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-medium inline-flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" /> Personalized Email
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => openQuickSocialModal(activeLead)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add / Edit Socials
                      </button>
                    </div>
                  </div>

                  {/* Quick Add Internal Note to Timeline */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Add internal discovery note to unified timeline..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addLeadNote(activeLead.id, noteInput);
                        setNoteInput("");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    >
                      Add Note
                    </button>
                  </div>

                  {unifiedTimeline.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                      No communications or calls logged for{" "}
                      {activeLead.businessName} yet.
                    </div>
                  ) : (
                    <div className="space-y-3 border-l-2 border-neutral-200 dark:border-neutral-800 pl-4 ml-2">
                      {unifiedTimeline.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-xs space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[11px] ${
                                  ev.direction === "Inbound"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                    : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                                }`}
                              >
                                {ev.direction === "Inbound" ? (
                                  <ArrowDownLeft className="w-3 h-3" />
                                ) : (
                                  <ArrowUpRight className="w-3 h-3" />
                                )}
                                {ev.direction} · {ev.channel}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-[10px] font-medium">
                                {ev.status}
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                ({ev.source === "api" ? "API Synced" : "Manual"})
                              </span>
                            </div>
                            <span className="text-[11px] tabular-nums text-neutral-400">
                              {ev.timestamp}
                            </span>
                          </div>

                          <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed">
                            {ev.summary}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-neutral-400">
                            <span>Actor: {ev.teamMemberName}</span>
                            {ev.providerMessageId && (
                              <span className="font-mono text-[10px]">
                                Msg ID: {ev.providerMessageId}
                              </span>
                            )}
                          </div>
                          {ev.notes && (
                            <div className="text-[11px] text-neutral-500 pt-1 border-t border-neutral-200/50 dark:border-neutral-800">
                              Outcome / Notes: {ev.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === "details" && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800">
                      <div className="text-neutral-400">Est. Project Value</div>
                      <div className="text-sm font-semibold mt-0.5">
                        {formatCurrency(
                          activeLead.estimatedProjectValue,
                          defaultCurrency
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800">
                      <div className="text-neutral-400">Website Audit</div>
                      <div className="text-sm font-semibold mt-0.5">
                        {activeLead.websiteStatus}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800">
                      <div className="text-neutral-400">Reputation</div>
                      <div className="text-sm font-semibold mt-0.5">
                        {activeLead.rating}★ ({activeLead.numberOfReviews}{" "}
                        reviews)
                      </div>
                    </div>
                  </div>

                  {/* Schedule Follow-up Date & WhatsApp Opt-in inline */}
                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-500" />
                        <span className="font-medium">
                          Next Follow-up Scheduled:
                        </span>
                      </div>
                      <input
                        type="date"
                        value={activeLead.nextFollowUpDate}
                        onChange={(e) =>
                          updateLead(activeLead.id, {
                            nextFollowUpDate: e.target.value,
                          })
                        }
                        className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                      />
                    </div>

                    <label className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-800 cursor-pointer">
                      <span>
                        <strong>WhatsApp Business Opt-In Consent:</strong>{" "}
                        Prospect has opted in to receive WhatsApp Cloud API messages
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(activeLead.whatsappOptIn)}
                        onChange={(e) =>
                          updateLead(activeLead.id, {
                            whatsappOptIn: e.target.checked,
                            whatsappOptInAt: e.target.checked
                              ? new Date().toISOString().slice(0, 10)
                              : undefined,
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">
                      Business &amp; Digital Presence
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {activeLead.businessDescription}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeLead.websiteUrl && (
                        <a
                          href={activeLead.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800"
                        >
                          Website <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {activeLead.instagramUrl && (
                        <a
                          href={activeLead.instagramUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800"
                        >
                          Instagram <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {activeLead.linkedinUrl && (
                        <a
                          href={activeLead.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800"
                        >
                          LinkedIn <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {activeLead.googleMapsUrl && (
                        <a
                          href={activeLead.googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800"
                        >
                          Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === "history" && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Complete Lead History
                  </h3>
                  <div className="space-y-2 border-l-2 border-neutral-200 dark:border-neutral-800 pl-3 ml-1">
                    {activeLead.history.map((h) => (
                      <div key={h.id} className="text-xs">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200">
                          {h.action}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {h.actorName} · {h.timestamp}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PART 6 — GOOGLE SHEETS & CSV COLUMN-MAPPING + DUPLICATE RESOLUTION IMPORTER MODAL */}
      {isImporterOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-semibold">
                  Lead Importer — CSV &amp; Google Sheets with Duplicate Detection
                </h2>
                <p className="text-neutral-500">
                  Map columns, validate email &amp; website URLs, inspect 4-field duplicates (Name, Email, Domain, Phone), and review import history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImporterOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Choose Source (CSV Upload or Google Sheets OAuth) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <Upload className="w-4 h-4" /> Option A: Upload CSV File
                </div>
                <p className="text-neutral-500">
                  Upload any prospect spreadsheet exported from Google Maps, Apollo, Clay, or Excel.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Choose CSV File
                </button>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" /> Option B: Connect Google Sheets
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="Spreadsheet URL or ID..."
                    className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                  <input
                    value={sheetRangeInput}
                    onChange={(e) => setSheetRangeInput(e.target.value)}
                    placeholder="Sheet1!A1:Z200"
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchGoogleSheet}
                  className="px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 font-medium"
                >
                  Fetch Worksheet Rows
                </button>
                {sheetError && (
                  <p className="text-red-600 text-[11px]">{sheetError}</p>
                )}
              </div>
            </div>

            {/* Step 2: Column Mapping & Duplicate Resolution Strategy */}
            {rawHeaders.length > 0 && (
              <div className="space-y-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Map Spreadsheet Columns ({rawRows.length} rows detected in{" "}
                      {importSourceLabel})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-600 dark:text-neutral-300">
                      When Duplicate Detected:
                    </span>
                    <select
                      value={duplicateStrategy}
                      onChange={(e) =>
                        setDuplicateStrategy(
                          e.target.value as "skip" | "update" | "create"
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-medium"
                    >
                      <option value="skip">
                        Skip Duplicate (Preserve Existing Lead)
                      </option>
                      <option value="update">
                        Update Existing Lead with New Fields
                      </option>
                      <option value="create">
                        Import Anyway as Separate Lead
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {MAPPABLE_CRM_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-[11px] text-neutral-500 mb-1">
                        {field.label}
                      </label>
                      <select
                        value={columnMap[field.key] ?? -1}
                        onChange={(e) =>
                          setColumnMap({
                            ...columnMap,
                            [field.key]: Number(e.target.value),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                      >
                        <option value={-1}>— Not Mapped —</option>
                        {rawHeaders.map((h, i) => (
                          <option key={`${h}-${i}`} value={i}>
                            Col {i + 1}: {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Step 3: Preview Imported Records with Validation & Duplicate Badges */}
                <div>
                  <h4 className="font-semibold mb-2">
                    Import Preview &amp; Validation ({mappedPreviewRows.length}{" "}
                    rows)
                  </h4>
                  <div className="max-h-56 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-[11px] text-neutral-500">
                          <th className="py-2 px-3">Row</th>
                          <th className="py-2 px-3">Business Name</th>
                          <th className="py-2 px-3">Email</th>
                          <th className="py-2 px-3">Website</th>
                          <th className="py-2 px-3">Phone</th>
                          <th className="py-2 px-3">Validation / Duplicate Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {mappedPreviewRows.slice(0, 30).map((r) => (
                          <tr key={r.rowNumber}>
                            <td className="py-2 px-3 font-mono">
                              #{r.rowNumber}
                            </td>
                            <td className="py-2 px-3 font-medium">
                              {r.candidate.businessName || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {r.candidate.businessEmail || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {r.candidate.websiteUrl || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {r.candidate.phoneNumber || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {r.rowErrors.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {r.rowErrors.join(", ")}
                                </span>
                              ) : r.duplicate ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Duplicate of {r.duplicate.existingBusinessName}{" "}
                                  (matched: {r.duplicate.matchedOn.join(", ")})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImporterOpen(false)}
                    className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMappedImport}
                    className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                  >
                    Confirm &amp; Execute Import ({mappedPreviewRows.length} rows)
                  </button>
                </div>
              </div>
            )}

            {/* Import History Log */}
            {(db.importHistory || []).length > 0 && (
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold mb-2">Previous Import History</h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(db.importHistory || []).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800"
                    >
                      <div>
                        <span className="font-semibold">{job.sourceLabel}</span>{" "}
                        <span className="text-neutral-400">
                          ({job.source} by {job.createdByName})
                        </span>
                      </div>
                      <div className="text-[11px] tabular-nums">
                        <span className="text-emerald-600 font-medium">
                          +{job.createdCount} created
                        </span>{" "}
                        · <span>{job.updatedCount} updated</span> ·{" "}
                        <span className="text-amber-600">
                          {job.skippedCount} skipped
                        </span>{" "}
                        ·{" "}
                        <span className="text-red-600">
                          {job.errorCount} errors
                        </span>{" "}
                        · <span className="text-neutral-400">{job.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT LEAD MODAL (All 26 Fields + WhatsApp Opt-In) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editingLead ? "Edit Lead Profile" : "Add New Prospect to CRM"}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Business Name *
                  </label>
                  <input
                    required
                    value={formState.businessName}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        businessName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Contact Person
                  </label>
                  <input
                    value={formState.contactPerson}
                    placeholder="Founder or Owner name"
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        contactPerson: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Industry</label>
                  <select
                    value={formState.industry}
                    onChange={(e) =>
                      setFormState({ ...formState, industry: e.target.value })
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Country</label>
                  <input
                    value={formState.country}
                    onChange={(e) =>
                      setFormState({ ...formState, country: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">City</label>
                  <input
                    value={formState.city}
                    onChange={(e) =>
                      setFormState({ ...formState, city: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={formState.businessEmail}
                    placeholder="founder@brand.com"
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        businessEmail: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    WhatsApp / Phone Number
                  </label>
                  <input
                    value={formState.phoneNumber}
                    placeholder="+1 415 555 0199"
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        phoneNumber: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              {/* URLs */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-medium mb-1">Website URL</label>
                  <input
                    value={formState.websiteUrl}
                    onChange={(e) =>
                      setFormState({ ...formState, websiteUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Instagram (@handle or URL)
                  </label>
                  <input
                    value={formState.instagramUrl}
                    placeholder="@brand or instagram.com/brand"
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        instagramUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Facebook URL</label>
                  <input
                    value={formState.facebookUrl}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        facebookUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">LinkedIn URL</label>
                  <input
                    value={formState.linkedinUrl}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        linkedinUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Google Maps URL
                  </label>
                  <input
                    value={formState.googleMapsUrl}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        googleMapsUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              {/* Pipeline & Ratings */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-medium mb-1">Lead Source</label>
                  <select
                    value={formState.leadSource}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        leadSource: e.target.value as LeadSource,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Website Status
                  </label>
                  <select
                    value={formState.websiteStatus}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        websiteStatus: e.target.value as Lead["websiteStatus"],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="No Website">No Website</option>
                    <option value="Outdated Website">Outdated Website</option>
                    <option value="Slow / Poor UX">Slow / Poor UX</option>
                    <option value="Needs Redesign">Needs Redesign</option>
                    <option value="Modern Website">Modern Website</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Rating (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formState.rating}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rating: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1"># of Reviews</label>
                  <input
                    type="number"
                    value={formState.numberOfReviews}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        numberOfReviews: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Est. Project Value
                  </label>
                  <input
                    type="number"
                    value={formState.estimatedProjectValue}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        estimatedProjectValue: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        status: e.target.value as LeadStatus,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {LEAD_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Priority</label>
                  <select
                    value={formState.leadPriority}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        leadPriority: e.target.value as PriorityLevel,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {PRIORITY_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Assigned To</label>
                  <select
                    value={formState.assignedTeamMemberId}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        assignedTeamMemberId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {db.teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Last Contacted
                  </label>
                  <input
                    type="date"
                    value={formState.lastContacted}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        lastContacted: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
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
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Business Description
                  </label>
                  <textarea
                    rows={2}
                    value={formState.businessDescription}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        businessDescription: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Personalization Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formState.personalizationNotes}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        personalizationNotes: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Potential Opportunity
                  </label>
                  <textarea
                    rows={2}
                    value={formState.potentialOpportunity}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        potentialOpportunity: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              {/* AUTO-SEND PERSONALIZED DM ON ADDING SOCIALS */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDmOnSave}
                      onChange={(e) => setAutoDmOnSave(e.target.checked)}
                    />
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-send personalized DM &amp; Email when socials are added
                  </label>

                  {detectedModalChannels.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {detectedModalChannels.map((ch) => (
                        <label
                          key={ch}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-[11px] font-medium cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAutoChannels[ch]}
                            onChange={(e) =>
                              setSelectedAutoChannels((prev) => ({
                                ...prev,
                                [ch]: e.target.checked,
                              }))
                            }
                          />
                          {ch === "instagram"
                            ? `Instagram (@${generatedFormPreview.instagramHandle})`
                            : ch === "whatsapp"
                            ? `WhatsApp (+${generatedFormPreview.whatsappPhone})`
                            : `Email (${generatedFormPreview.emailAddress})`}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-400">
                      Enter Instagram @handle, Email, or WhatsApp number above to trigger Auto-DM
                    </span>
                  )}
                </div>

                {autoDmOnSave && detectedModalChannels.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-neutral-200/70 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {(["instagram", "whatsapp", "email"] as const)
                          .filter((ch) => detectedModalChannels.includes(ch))
                          .map((ch) => (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => setPreviewChannelTab(ch)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                                activePreviewChannel === ch
                                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                                  : "text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                              }`}
                            >
                              {ch === "instagram"
                                ? "Instagram DM Preview"
                                : ch === "whatsapp"
                                ? "WhatsApp DM Preview"
                                : "Email Preview"}
                            </button>
                          ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomIgMsg("");
                          setCustomEmailSubj("");
                          setCustomEmailBody("");
                          setCustomWaMsg("");
                        }}
                        className="text-[11px] text-neutral-500 hover:underline"
                      >
                        Reset to Auto-Personalized
                      </button>
                    </div>

                    {activePreviewChannel === "instagram" &&
                      detectedModalChannels.includes("instagram") && (
                        <textarea
                          rows={3}
                          value={
                            customIgMsg || generatedFormPreview.instagramMessage
                          }
                          onChange={(e) => setCustomIgMsg(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
                        />
                      )}

                    {activePreviewChannel === "whatsapp" &&
                      detectedModalChannels.includes("whatsapp") && (
                        <textarea
                          rows={3}
                          value={
                            customWaMsg || generatedFormPreview.whatsappMessage
                          }
                          onChange={(e) => setCustomWaMsg(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
                        />
                      )}

                    {activePreviewChannel === "email" &&
                      detectedModalChannels.includes("email") && (
                        <div className="space-y-1.5">
                          <input
                            value={
                              customEmailSubj ||
                              generatedFormPreview.emailSubject
                            }
                            onChange={(e) =>
                              setCustomEmailSubj(e.target.value)
                            }
                            placeholder="Email Subject"
                            className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium"
                          />
                          <textarea
                            rows={4}
                            value={
                              customEmailBody || generatedFormPreview.emailBody
                            }
                            onChange={(e) =>
                              setCustomEmailBody(e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
                          />
                        </div>
                      )}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={formState.whatsappOptIn}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      whatsappOptIn: e.target.checked,
                    })
                  }
                />
                Prospect has granted WhatsApp Business messaging opt-in
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                >
                  {autoDmOnSave &&
                    detectedModalChannels.some(
                      (ch) => selectedAutoChannels[ch]
                    ) && <Send className="w-3.5 h-3.5" />}
                  {editingLead
                    ? autoDmOnSave &&
                      detectedModalChannels.some(
                        (ch) => selectedAutoChannels[ch]
                      )
                      ? "Save & Auto-Send Personalized DM"
                      : "Save Changes"
                    : autoDmOnSave &&
                      detectedModalChannels.some(
                        (ch) => selectedAutoChannels[ch]
                      )
                    ? "Create Lead & Send Personalized DM"
                    : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD SOCIALS & AUTO-SEND PERSONALIZED DM MODAL */}
      {quickSocialLead && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-semibold">
                  Add Socials &amp; Send Personalized DM
                </h2>
                <p className="text-neutral-500">
                  {quickSocialLead.businessName} (
                  {quickSocialLead.contactPerson})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickSocialLead(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickSocials} className="space-y-3.5">
              <div>
                <label className="block font-medium mb-1">
                  Instagram Handle or URL
                </label>
                <input
                  value={quickIgInput}
                  onChange={(e) => setQuickIgInput(e.target.value)}
                  placeholder="@brandname or https://instagram.com/brandname"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">
                  Business Email
                </label>
                <input
                  type="email"
                  value={quickEmailInput}
                  onChange={(e) => setQuickEmailInput(e.target.value)}
                  placeholder="founder@brand.com"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">
                  WhatsApp Phone Number
                </label>
                <input
                  value={quickPhoneInput}
                  onChange={(e) => setQuickPhoneInput(e.target.value)}
                  placeholder="+1 415 555 0199 or +91 98765 43210"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Auto-Personalized DM Preview:
                </div>
                <p className="text-[11px] text-neutral-500 whitespace-pre-line line-clamp-4">
                  {
                    buildPersonalizedOutreachMessages(
                      {
                        ...quickSocialLead,
                        instagramUrl: quickIgInput,
                        businessEmail: quickEmailInput,
                        phoneNumber: quickPhoneInput,
                      },
                      db.templates,
                      currentUser.name,
                      db.settings.agencyName
                    ).instagramMessage
                  }
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setQuickSocialLead(null)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickSending}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {quickSending
                    ? "Sending..."
                    : "Save Socials & Send Personalized DM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERT LEAD TO CLIENT + PROJECT MODAL */}
      {convertModalLead && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <div>
                <h2 className="text-base font-semibold">
                  Convert Lead into Client &amp; Launch Project
                </h2>
                <p className="text-xs text-neutral-500">
                  {convertModalLead.businessName} (
                  {convertModalLead.contactPerson})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConvertModalLead(null)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmConversion}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-medium mb-1.5">
                  Services Purchased by Client
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {AGENCY_SERVICES.map((srv) => {
                    const checked = convServices.includes(srv);
                    return (
                      <label
                        key={srv}
                        className="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setConvServices((prev) =>
                              checked
                                ? prev.filter((s) => s !== srv)
                                : [...prev, srv]
                            )
                          }
                        />
                        <span className="truncate">{srv}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 font-medium pt-1">
                <input
                  type="checkbox"
                  checked={convCreateProject}
                  onChange={(e) => setConvCreateProject(e.target.checked)}
                />
                Automatically create project &amp; 14-point agency checklist
              </label>

              {convCreateProject && (
                <div className="space-y-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <div>
                    <label className="block font-medium mb-1">
                      Project Name
                    </label>
                    <input
                      required
                      value={convProjectName}
                      onChange={(e) => setConvProjectName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium mb-1">
                        Project Budget ({defaultCurrency})
                      </label>
                      <input
                        type="number"
                        required
                        value={convProjectBudget}
                        onChange={(e) =>
                          setConvProjectBudget(Number(e.target.value))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">
                        Target Deadline
                      </label>
                      <input
                        type="date"
                        required
                        value={convProjectDeadline}
                        onChange={(e) => setConvProjectDeadline(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setConvertModalLead(null)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  Confirm Conversion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-xs">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Delete Lead Permanently?
            </h3>
            <p className="text-neutral-500 mt-1">
              This will remove the lead and its history from Twofold Studio CRM.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteLead(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium"
              >
                Delete Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
