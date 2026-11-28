"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  PROSPECT_STATUSES,
  Prospect,
  ProspectImport,
  ProspectStatus,
} from "@/types/prospecting";
import { ProspectDrawer } from "./ProspectDrawer";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

interface ProspectTableProps {
  prospects: Prospect[];
  imports: ProspectImport[];
  presetStatus?: ProspectStatus;
  title?: string;
  emptyDescription?: string;
  onUploadClick: () => void;
  onUpdateProspect: (
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
  ) => Promise<void>;
  onBulkUpdateStatus: (ids: string[], status: ProspectStatus) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onSendToCrm: (ids: string[]) => Promise<void>;
}

const PAGE_SIZE = 50;

export function ProspectTable({
  prospects,
  imports,
  presetStatus,
  title = "Prospect Database",
  emptyDescription = "No prospects match your filters yet.",
  onUploadClick,
  onUpdateProspect,
  onBulkUpdateStatus,
  onBulkDelete,
  onSendToCrm,
}: ProspectTableProps) {
  const { permissions, setActiveSection } = useAgency();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [importFilter, setImportFilter] = useState<string>("All");
  const [channelFilter, setChannelFilter] = useState<
    "all" | "has_email" | "has_phone" | "in_crm"
  >("all");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProspectStatus>("Ready for Outreach");
  const [drawerProspectId, setDrawerProspectId] = useState<string | null>(null);
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const scopedProspects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      if (presetStatus && p.status !== presetStatus) return false;
      if (!presetStatus && statusFilter !== "All" && p.status !== statusFilter) {
        return false;
      }
      if (importFilter !== "All" && p.importId !== importFilter) return false;
      if (channelFilter === "has_email" && !p.email) return false;
      if (channelFilter === "has_phone" && !p.phone) return false;
      if (channelFilter === "in_crm" && !p.crmLeadId) return false;
      if (!q) return true;
      return (
        p.businessName.toLowerCase().includes(q) ||
        p.contactPerson.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.website.toLowerCase().includes(q) ||
        p.instagram.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
      );
    });
  }, [
    prospects,
    presetStatus,
    statusFilter,
    importFilter,
    channelFilter,
    search,
  ]);

  const totalPages = Math.max(1, Math.ceil(scopedProspects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = scopedProspects.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const drawerProspect = useMemo(
    () => prospects.find((p) => p.id === drawerProspectId) || null,
    [prospects, drawerProspectId]
  );

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((p) => selectedIds.includes(p.id));

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      const pageSet = new Set(pageItems.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...pageItems.map((p) => p.id)]))
      );
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkStatus = async () => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      await onBulkUpdateStatus(selectedIds, bulkStatus);
      setSelectedIds([]);
    } finally {
      setBusy(false);
    }
  };

  const handleBulkCrm = async () => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      await onSendToCrm(selectedIds);
      setSelectedIds([]);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmIds || deleteConfirmIds.length === 0) return;
    setBusy(true);
    try {
      await onBulkDelete(deleteConfirmIds);
      const delSet = new Set(deleteConfirmIds);
      setSelectedIds((prev) => prev.filter((id) => !delSet.has(id)));
      if (drawerProspectId && delSet.has(drawerProspectId)) {
        setDrawerProspectId(null);
      }
      setDeleteConfirmIds(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Toolbar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={`Search ${title.toLowerCase()} by name, email, website, category, or city...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
            />
          </div>

          {!presetStatus && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            >
              <option
                value="All"
                className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
              >
                All Statuses ({prospects.length})
              </option>
              {PROSPECT_STATUSES.map((st) => (
                <option
                  key={st}
                  value={st}
                  className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {st}
                </option>
              ))}
            </select>
          )}

          {imports.length > 0 && (
            <select
              value={importFilter}
              onChange={(e) => {
                setImportFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 max-w-[180px]"
            >
              <option
                value="All"
                className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
              >
                All Import Files
              </option>
              {imports.map((imp) => (
                <option
                  key={imp.id}
                  value={imp.id}
                  className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {imp.fileName}
                </option>
              ))}
            </select>
          )}

          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(
                e.target.value as "all" | "has_email" | "has_phone" | "in_crm"
              );
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
          >
            <option
              value="all"
              className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            >
              All Records
            </option>
            <option
              value="has_email"
              className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            >
              Has Email
            </option>
            <option
              value="has_phone"
              className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            >
              Has Phone
            </option>
            <option
              value="in_crm"
              className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            >
              Synced to CRM
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={onUploadClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Spreadsheet
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-medium">
            {selectedIds.length} prospect{selectedIds.length === 1 ? "" : "s"}{" "}
            selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ProspectStatus)}
              className="px-2.5 py-1 rounded-md text-xs bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700"
            >
              {PROSPECT_STATUSES.map((st) => (
                <option
                  key={st}
                  value={st}
                  className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {st}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={handleBulkStatus}
              className="px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 dark:bg-neutral-900/10 dark:hover:bg-neutral-900/20 font-medium inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Apply Status
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleBulkCrm}
              className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1 disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add to CRM
            </button>
            {permissions.deleteRecords && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteConfirmIds(selectedIds)}
                className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white font-medium inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1 opacity-75 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 bg-neutral-50/60 dark:bg-neutral-950/50">
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                  />
                </th>
                <th className="py-2.5 px-3">Business &amp; Contact</th>
                <th className="py-2.5 px-3">Channels</th>
                <th className="py-2.5 px-3">Category &amp; Location</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">CRM Sync</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
              {pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 px-4 text-center text-neutral-500 dark:text-neutral-400"
                  >
                    <p className="font-medium text-neutral-700 dark:text-neutral-300">
                      {emptyDescription}
                    </p>
                    {prospects.length === 0 && (
                      <button
                        type="button"
                        onClick={onUploadClick}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Prospects
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((p) => {
                  const checked = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setDrawerProspectId(p.id)}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 cursor-pointer transition"
                    >
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(p.id)}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                          <span>
                            {p.businessName ||
                              p.contactPerson ||
                              p.websiteDomain ||
                              p.email ||
                              "Unnamed Prospect"}
                          </span>
                          {p.validationWarnings.length > 0 && (
                            <span
                              title={p.validationWarnings.join(" | ")}
                              className="text-amber-500"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {p.contactPerson || p.source || "—"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-neutral-600 dark:text-neutral-300 space-y-0.5">
                        {p.email && <div className="truncate max-w-[200px]">{p.email}</div>}
                        {p.phone && <div className="tabular-nums">{p.phone}</div>}
                        {p.websiteDomain && (
                          <div className="text-neutral-400 truncate max-w-[180px]">
                            {p.websiteDomain}
                          </div>
                        )}
                        {p.instagram && (
                          <div className="text-neutral-400">@{p.instagram}</div>
                        )}
                        {!p.email && !p.phone && !p.websiteDomain && !p.instagram && (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-neutral-600 dark:text-neutral-300">
                        <div>{p.category || "—"}</div>
                        <div className="text-neutral-400">
                          {[p.location, p.country].filter(Boolean).join(", ") || "—"}
                        </div>
                      </td>
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={p.status}
                          onChange={(e) =>
                            onUpdateProspect(p.id, {
                              status: e.target.value as ProspectStatus,
                            })
                          }
                          className="px-2 py-1 rounded-md text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                        >
                          {PROSPECT_STATUSES.map((st) => (
                            <option
                              key={st}
                              value={st}
                              className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.crmLeadId ? (
                          <button
                            type="button"
                            onClick={() => setActiveSection("leads")}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-medium"
                          >
                            In CRM <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSendToCrm([p.id])}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium"
                          >
                            <UserPlus className="w-3 h-3" /> Add to CRM
                          </button>
                        )}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {permissions.deleteRecords && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmIds([p.id])}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-neutral-400 hover:text-red-600"
                            title="Delete prospect"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {scopedProspects.length > PAGE_SIZE && (
          <div className="px-4 py-2.5 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, scopedProspects.length)} of{" "}
              {scopedProspects.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                className="p-1 rounded border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="tabular-nums px-1">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                className="p-1 rounded border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prospect Inspector Drawer */}
      <ProspectDrawer
        prospect={drawerProspect}
        onClose={() => setDrawerProspectId(null)}
        onSave={onUpdateProspect}
        onSendToCrm={(id) => onSendToCrm([id])}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmIds && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Delete {deleteConfirmIds.length} prospect
              {deleteConfirmIds.length === 1 ? "" : "s"}?
            </h3>
            <p className="text-neutral-500">
              This removes the selected prospect record
              {deleteConfirmIds.length === 1 ? "" : "s"} from the prospecting
              database. Linked leads already saved inside CRM Leads will not be
              deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteConfirmIds(null)}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
