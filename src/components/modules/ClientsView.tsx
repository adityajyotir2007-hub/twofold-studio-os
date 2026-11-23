"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  AGENCY_SERVICES,
  formatCurrency,
  INDUSTRIES,
} from "@/lib/constants";
import { Client } from "@/types/agency";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

export function ClientsView() {
  const {
    db,
    currentUser,
    permissions,
    selectedClientId,
    setSelectedClientId,
    setSelectedProjectId,
    setActiveSection,
    addClient,
    updateClient,
    deleteClient,
    addClientCommunication,
    addClientMeeting,
    updateTask,
  } = useAgency();

  const defaultCurrency = db.settings.defaultCurrency;
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Client Detail sub-forms
  const [commChannel, setCommChannel] = useState("Slack Connect");
  const [commSummary, setCommSummary] = useState("");
  const [meetTitle, setMeetTitle] = useState("");
  const [meetDate, setMeetDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [meetAttendees, setMeetAttendees] = useState("");
  const [meetNotes, setMeetNotes] = useState("");

  const emptyForm = {
    clientName: "",
    businessName: "",
    industry: INDUSTRIES[0],
    contactPerson: "",
    email: "",
    phone: "",
    country: "United States",
    city: "San Francisco",
    website: "",
    socialMediaLinks: {
      linkedin: "",
      instagram: "",
      twitter: "",
      facebook: "",
    },
    clientSince: new Date().toISOString().slice(0, 10),
    servicesPurchased: [
      "Custom Website Design (UI/UX)",
      "Next.js Full-Stack Development",
    ],
    totalProjectValue: 30000,
    paymentStatus: "Paid" as Client["paymentStatus"],
    assignedAccountManagerId: currentUser.id,
    internalNotes: "",
  };

  const [formState, setFormState] = useState(emptyForm);

  const selectedClient = useMemo(
    () => db.clients.find((c) => c.id === selectedClientId) || null,
    [db.clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.clients.filter((c) => {
      if (industryFilter !== "All" && c.industry !== industryFilter)
        return false;
      if (paymentFilter !== "All" && c.paymentStatus !== paymentFilter)
        return false;
      if (!q) return true;
      return (
        c.businessName.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      );
    });
  }, [db.clients, search, industryFilter, paymentFilter]);

  const openAddModal = () => {
    setEditingClient(null);
    setFormState(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormState({
      clientName: client.clientName,
      businessName: client.businessName,
      industry: client.industry,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      country: client.country,
      city: client.city,
      website: client.website,
      socialMediaLinks: {
        linkedin: client.socialMediaLinks.linkedin || "",
        instagram: client.socialMediaLinks.instagram || "",
        twitter: client.socialMediaLinks.twitter || "",
        facebook: client.socialMediaLinks.facebook || "",
      },
      clientSince: client.clientSince,
      servicesPurchased: client.servicesPurchased,
      totalProjectValue: client.totalProjectValue,
      paymentStatus: client.paymentStatus,
      assignedAccountManagerId: client.assignedAccountManagerId,
      internalNotes: client.internalNotes,
    });
    setIsModalOpen(true);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.businessName.trim() || !formState.contactPerson.trim())
      return;
    if (editingClient) {
      updateClient(editingClient.id, formState);
    } else {
      addClient(formState);
    }
    setIsModalOpen(false);
  };

  // DEDICATED CLIENT PROFILE PAGE
  if (selectedClient) {
    const accountManager = db.teamMembers.find(
      (m) => m.id === selectedClient.assignedAccountManagerId
    );
    const clientProjects = db.projects.filter(
      (p) => p.clientId === selectedClient.id
    );
    const clientFinance = db.finance.filter(
      (f) => f.clientId === selectedClient.id
    );
    const clientDocs = db.documents.filter(
      (d) => d.clientId === selectedClient.id
    );
    const clientTasks = db.tasks.filter(
      (t) => t.relatedClientId === selectedClient.id
    );

    return (
      <div className="space-y-6">
        {/* Back navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedClientId(null)}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {selectedClient.businessName}
                </h1>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    selectedClient.paymentStatus === "Paid"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : selectedClient.paymentStatus === "Overdue"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {selectedClient.paymentStatus}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {selectedClient.industry} · Client Since{" "}
                {selectedClient.clientSince} · Account Manager:{" "}
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {accountManager?.name || "Elena Vance"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEditModal(selectedClient)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Client Profile
            </button>
          </div>
        </div>

        {/* Client Info Grid + Services + Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 4 cols: Client Information & Important Notes */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-4 text-xs">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Client Information
              </h2>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Contact Person</span>
                  <span className="font-medium">
                    {selectedClient.contactPerson}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </span>
                  <a
                    href={`mailto:${selectedClient.email}`}
                    className="font-medium hover:underline"
                  >
                    {selectedClient.email}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </span>
                  <span className="font-medium">
                    {selectedClient.phone || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </span>
                  <span className="font-medium">
                    {selectedClient.city}, {selectedClient.country}
                  </span>
                </div>
                {selectedClient.website && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" /> Website
                    </span>
                    <a
                      href={selectedClient.website}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium inline-flex items-center gap-1 hover:underline"
                    >
                      {selectedClient.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {permissions.finance && (
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <span className="text-neutral-500">Total Account Value</span>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(
                        selectedClient.totalProjectValue,
                        defaultCurrency
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Services Purchased */}
              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <div className="text-neutral-400 font-medium mb-2">
                  Services Purchased
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedClient.servicesPurchased.map((srv) => (
                    <span
                      key={srv}
                      className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-300"
                    >
                      {srv}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Important Account Notes
              </h2>
              <textarea
                rows={4}
                value={selectedClient.internalNotes}
                onChange={(e) =>
                  updateClient(selectedClient.id, {
                    internalNotes: e.target.value,
                  })
                }
                placeholder="Record strategic account notes, compliance requirements, or stakeholder preferences..."
                className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>

            {/* Uploaded Documents */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Uploaded Documents ({clientDocs.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveSection("documents")}
                  className="text-neutral-500 hover:underline"
                >
                  Manage Files →
                </button>
              </div>
              {clientDocs.length === 0 ? (
                <p className="text-neutral-400 py-2">
                  No documents linked to this client yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {clientDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {doc.category} · {doc.createdAt}
                          </div>
                        </div>
                      </div>
                      <a
                        href={`/api/documents/${doc.id}/file?download=1`}
                        className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        title="Download File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 8 cols: Associated Projects, Payment History, Tasks, Communication & Meeting History */}
          <div className="lg:col-span-8 space-y-5">
            {/* Associated Projects */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-neutral-500" />
                  Associated Projects ({clientProjects.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveSection("projects")}
                  className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:underline"
                >
                  Open Projects Hub →
                </button>
              </div>
              {clientProjects.length === 0 ? (
                <p className="text-xs text-neutral-400 py-3">
                  No projects created for this client yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {clientProjects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setActiveSection("projects");
                      }}
                      className="cursor-pointer p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {proj.projectStatus}
                        </span>
                        <span className="text-xs font-semibold">
                          {proj.progressPercentage}%
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold mt-2">
                        {proj.projectName}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {proj.projectDescription}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400">
                        <span>Deadline: {proj.deadline}</span>
                        {permissions.finance && (
                          <span>
                            {formatCurrency(
                              proj.projectBudget,
                              defaultCurrency
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment History */}
            {permissions.finance && (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Payment &amp; Invoice History ({clientFinance.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection("finance")}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Open Finance →
                  </button>
                </div>
                {clientFinance.length === 0 ? (
                  <p className="text-xs text-neutral-400">
                    No invoices recorded for this client yet.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {clientFinance.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-neutral-200/70 dark:border-neutral-800"
                      >
                        <div>
                          <div className="font-semibold">
                            {inv.invoiceNumber} — {inv.notes}
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            Due: {inv.dueDate} · Method: {inv.paymentMethod}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">
                            {inv.currency} {inv.paidAmount.toLocaleString()} /{" "}
                            {inv.amount.toLocaleString()}
                          </div>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              inv.paymentStatus === "Paid"
                                ? "bg-emerald-50 text-emerald-700"
                                : inv.paymentStatus === "Overdue"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {inv.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Client Tasks */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-neutral-500" />
                Client Tasks ({clientTasks.length})
              </h2>
              {clientTasks.length === 0 ? (
                <p className="text-xs text-neutral-400">
                  No tasks currently linked to this client.
                </p>
              ) : (
                <div className="space-y-2 text-xs">
                  {clientTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={t.status === "Completed"}
                          onChange={() =>
                            updateTask(t.id, {
                              status:
                                t.status === "Completed"
                                  ? "To Do"
                                  : "Completed",
                            })
                          }
                        />
                        <span
                          className={
                            t.status === "Completed"
                              ? "line-through text-neutral-400"
                              : "font-medium"
                          }
                        >
                          {t.taskTitle}
                        </span>
                      </label>
                      <span className="text-[11px] text-neutral-400">
                        Due {t.dueDate} · {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Communication History & Meeting History */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Communication Log */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3 text-xs">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-neutral-500" />
                  Communication History
                </h2>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={commChannel}
                      onChange={(e) => setCommChannel(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    >
                      <option value="Slack Connect">Slack Connect</option>
                      <option value="Email">Email</option>
                      <option value="Phone / WhatsApp">
                        Phone / WhatsApp
                      </option>
                      <option value="Figma Comment">Figma Comment</option>
                    </select>
                    <input
                      value={commSummary}
                      onChange={(e) => setCommSummary(e.target.value)}
                      placeholder="Log client update..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addClientCommunication(
                          selectedClient.id,
                          commChannel,
                          commSummary
                        );
                        setCommSummary("");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                    >
                      Log
                    </button>
                  </div>
                  <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
                    {selectedClient.communicationHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800"
                      >
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-0.5">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">
                            {item.channel} · {item.authorName}
                          </span>
                          <span>{item.date}</span>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-300">
                          {item.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Meeting History */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3 text-xs">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-neutral-500" />
                  Meeting History
                </h2>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={meetTitle}
                      onChange={(e) => setMeetTitle(e.target.value)}
                      placeholder="Meeting Title..."
                      className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                    <input
                      type="date"
                      value={meetDate}
                      onChange={(e) => setMeetDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={meetNotes}
                      onChange={(e) => setMeetNotes(e.target.value)}
                      placeholder="Key decisions & action items..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addClientMeeting(
                          selectedClient.id,
                          meetTitle,
                          meetDate,
                          meetAttendees || selectedClient.contactPerson,
                          meetNotes
                        );
                        setMeetTitle("");
                        setMeetNotes("");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
                    {selectedClient.meetingHistory.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span>{m.title}</span>
                          <span className="text-[11px] text-neutral-400">
                            {m.date}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          {m.notes}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CLIENT DIRECTORY VIEW
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Client Directory &amp; Accounts
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {db.clients.length} active studio accounts · Click any client card to open their dedicated profile page.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Client
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or business name, email, city..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
          />
        </div>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Industries</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Payment Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const manager = db.teamMembers.find(
            (m) => m.id === client.assignedAccountManagerId
          );
          const projCount = db.projects.filter(
            (p) => p.clientId === client.id
          ).length;

          return (
            <div
              key={client.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 hover:border-neutral-400 dark:hover:border-neutral-700 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-neutral-400">
                      {client.industry}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className="block text-base font-semibold text-neutral-900 dark:text-neutral-100 hover:underline text-left mt-0.5"
                    >
                      {client.businessName}
                    </button>
                    <p className="text-xs text-neutral-500">
                      {client.contactPerson} · {client.city}, {client.country}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                      client.paymentStatus === "Paid"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : client.paymentStatus === "Overdue"
                        ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                    }`}
                  >
                    {client.paymentStatus}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3.5">
                  {client.servicesPurchased.slice(0, 3).map((srv) => (
                    <span
                      key={srv}
                      className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium text-neutral-600 dark:text-neutral-300"
                    >
                      {srv}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[11px] text-neutral-400">
                    {projCount} Project{projCount === 1 ? "" : "s"} · Mgr:{" "}
                    {manager?.name.split(" ")[0] || "Elena"}
                  </div>
                  {permissions.finance && (
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {formatCurrency(client.totalProjectValue, defaultCurrency)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-medium"
                  >
                    Open Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(client)}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {permissions.deleteRecords && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(client.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD / EDIT CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editingClient ? "Edit Client Profile" : "Onboard New Client"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
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
                    Contact Person / Client Name *
                  </label>
                  <input
                    required
                    value={formState.contactPerson}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        contactPerson: e.target.value,
                        clientName: e.target.value,
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) =>
                      setFormState({ ...formState, email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Phone</label>
                  <input
                    value={formState.phone}
                    onChange={(e) =>
                      setFormState({ ...formState, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Website</label>
                  <input
                    value={formState.website}
                    onChange={(e) =>
                      setFormState({ ...formState, website: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Total Project Value
                  </label>
                  <input
                    type="number"
                    value={formState.totalProjectValue}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        totalProjectValue: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Payment Status
                  </label>
                  <select
                    value={formState.paymentStatus}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        paymentStatus: e.target.value as Client["paymentStatus"],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Account Manager
                  </label>
                  <select
                    value={formState.assignedAccountManagerId}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        assignedAccountManagerId: e.target.value,
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
              </div>

              <div>
                <label className="block font-medium mb-1.5">
                  Services Purchased
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {AGENCY_SERVICES.map((srv) => {
                    const checked = formState.servicesPurchased.includes(srv);
                    return (
                      <label
                        key={srv}
                        className="flex items-center gap-1.5 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setFormState({
                              ...formState,
                              servicesPurchased: checked
                                ? formState.servicesPurchased.filter(
                                    (s) => s !== srv
                                  )
                                : [...formState.servicesPurchased, srv],
                            })
                          }
                        />
                        <span className="truncate">{srv}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={formState.internalNotes}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      internalNotes: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

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
                  <UserCheck className="w-3.5 h-3.5" />
                  {editingClient ? "Save Changes" : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CLIENT CONFIRMATION */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-xs">
            <h3 className="text-sm font-semibold">Delete Client Profile?</h3>
            <p className="text-neutral-500 mt-1">
              This will permanently remove the client from Twofold Studio.
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
                  deleteClient(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium"
              >
                Delete Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
