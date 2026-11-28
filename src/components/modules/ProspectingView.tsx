"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  bulkUpdateProspectsStatus,
  deleteProspectRecords,
  fetchProspectingState,
  sendProspectsToCrmApi,
  updateProspectRecord,
} from "@/lib/prospecting/client-api";
import {
  Prospect,
  ProspectImport,
  ProspectingCapabilities,
  ProspectingSectionTab,
  ProspectStatus,
} from "@/types/prospecting";
import { OverviewPanel } from "@/components/prospecting/OverviewPanel";
import { UploadWizard } from "@/components/prospecting/UploadWizard";
import { ProspectTable } from "@/components/prospecting/ProspectTable";
import { AutomationHistoryPanel } from "@/components/prospecting/AutomationHistoryPanel";
import { IntegrationsPanel } from "@/components/prospecting/IntegrationsPanel";
import { ComingSoonPanel } from "@/components/prospecting/ComingSoonPanel";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Database,
  History,
  LayoutDashboard,
  Mail,
  Plug,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Target,
  Upload,
} from "lucide-react";

const TABS: {
  key: ProspectingSectionTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "upload", label: "Upload Prospects", icon: Upload },
  { key: "database", label: "Prospect Database", icon: Database },
  { key: "campaigns", label: "Campaigns", icon: Target },
  { key: "research", label: "AI Research", icon: Sparkles },
  { key: "outreach", label: "Outreach", icon: Mail },
  { key: "followups", label: "Follow-ups", icon: Clock },
  { key: "interested", label: "Interested Leads", icon: Star },
  { key: "calls", label: "Booked Calls", icon: CalendarCheck },
  { key: "history", label: "Automation History", icon: History },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "settings", label: "Settings", icon: Settings },
];

export function ProspectingView() {
  const {
    db,
    applyProspectingState,
    markProspectsDeleted,
    refreshState,
    setActiveSection,
  } = useAgency();

  const [activeTab, setActiveTab] =
    useState<ProspectingSectionTab>("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [capabilities, setCapabilities] =
    useState<ProspectingCapabilities | null>(null);
  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const prospects = db.prospects || [];
  const imports = db.prospectImports || [];

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchProspectingState();
      applyProspectingState({
        prospects: data.prospects,
        prospectImports: data.imports,
      });
      setCapabilities(data.capabilities);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load AI Prospecting."
      );
    } finally {
      setLoading(false);
    }
  }, [applyProspectingState]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (text: string) => {
    setBanner({ type: "ok", text });
  };

  const showError = (text: string) => {
    setBanner({ type: "err", text });
  };

  const handleImportComplete = (payload: {
    importRecord: ProspectImport;
    prospects: Prospect[];
    imports: ProspectImport[];
  }) => {
    applyProspectingState({
      prospects: payload.prospects,
      prospectImports: payload.imports,
    });
    showSuccess(
      `Imported ${payload.importRecord.importedCount} prospect(s) from ${payload.importRecord.fileName}.`
    );
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
    try {
      const { prospect } = await updateProspectRecord(id, patch);
      const nextList = prospects.map((p) => (p.id === id ? prospect : p));
      applyProspectingState({ prospects: nextList });
      showSuccess("Prospect updated.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to update prospect."
      );
      throw err;
    }
  };

  const handleBulkUpdateStatus = async (
    ids: string[],
    status: ProspectStatus
  ) => {
    try {
      const data = await bulkUpdateProspectsStatus(ids, status);
      applyProspectingState({ prospects: data.prospects });
      showSuccess(`Updated ${ids.length} prospect(s) to "${status}".`);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to update prospect status."
      );
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const data = await deleteProspectRecords(ids);
      markProspectsDeleted(ids);
      applyProspectingState({ prospects: data.prospects });
      showSuccess(`Deleted ${data.deletedCount} prospect(s).`);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to delete prospects."
      );
    }
  };

  const handleSendToCrm = async (ids: string[]) => {
    try {
      const data = await sendProspectsToCrmApi(ids);
      applyProspectingState({ prospects: data.prospects });
      await refreshState();
      const created = data.results.filter((r) => r.outcome === "created").length;
      const linked = data.results.filter(
        (r) => r.outcome === "linked_existing"
      ).length;
      const already = data.results.filter(
        (r) => r.outcome === "already_linked"
      ).length;
      showSuccess(
        `CRM Sync complete: ${created} lead(s) created, ${linked} matched existing CRM lead(s), ${already} already synced.`
      );
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to sync prospects to CRM."
      );
    }
  };

  const tabCounts: Partial<Record<ProspectingSectionTab, number>> = {
    database: prospects.length,
    followups: prospects.filter((p) => p.status === "Follow-up Required").length,
    interested: prospects.filter((p) => p.status === "Interested").length,
    calls: prospects.filter((p) => p.status === "Call Booked").length,
    history: imports.length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            AI Prospecting
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Upload prospect lists, validate and deduplicate contacts, track qualification stages, and sync qualified leads into CRM Leads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Prospects
          </button>
        </div>
      </div>

      {/* Horizontal Sub-Navigation for all 12 AI Prospecting sections */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-1.5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            const count = tabCounts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {typeof count === "number" && (
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.2 rounded-full ${
                      active
                        ? "bg-white/20 dark:bg-neutral-900/15"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Storage Notice when running ephemeral serverless without Supabase */}
      {capabilities?.storage === "ephemeral_serverless" &&
        !capabilities.supabaseConfigured && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Prospect data is cached in this browser and on temporary server storage. Connect Supabase (Integrations) for permanent multi-device storage.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("integrations")}
              className="text-[11px] font-semibold underline shrink-0"
            >
              View Storage Status
            </button>
          </div>
        )}

      {/* Action Feedback Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs ${
            banner.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "ok" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {banner.text.includes("CRM Sync complete") && (
              <button
                type="button"
                onClick={() => setActiveSection("leads")}
                className="font-semibold underline"
              >
                Open CRM Leads →
              </button>
            )}
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-[11px] opacity-75 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Auth / Load Error Banner */}
      {loadError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {loadError.toLowerCase().includes("session")
                ? "Session expired — sign out and sign in again to load workspace prospecting data."
                : loadError}
            </span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1 rounded-md bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-800 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Initial Loading Skeleton */}
      {loading && prospects.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <OverviewPanel
              prospects={prospects}
              imports={imports}
              capabilities={capabilities}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === "upload" && (
            <UploadWizard
              capabilities={capabilities}
              onImportComplete={handleImportComplete}
              onViewDatabase={() => setActiveTab("database")}
            />
          )}

          {activeTab === "database" && (
            <ProspectTable
              prospects={prospects}
              imports={imports}
              title="Prospect Database"
              emptyDescription="No prospects in your workspace yet. Upload a CSV or Excel file to get started."
              onUploadClick={() => setActiveTab("upload")}
              onUpdateProspect={handleUpdateProspect}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkDelete={handleBulkDelete}
              onSendToCrm={handleSendToCrm}
            />
          )}

          {activeTab === "followups" && (
            <ProspectTable
              prospects={prospects}
              imports={imports}
              presetStatus="Follow-up Required"
              title="Follow-ups"
              emptyDescription="No prospects are currently marked as Follow-up Required."
              onUploadClick={() => setActiveTab("upload")}
              onUpdateProspect={handleUpdateProspect}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkDelete={handleBulkDelete}
              onSendToCrm={handleSendToCrm}
            />
          )}

          {activeTab === "interested" && (
            <ProspectTable
              prospects={prospects}
              imports={imports}
              presetStatus="Interested"
              title="Interested Leads"
              emptyDescription="No prospects are marked as Interested yet. Qualify prospects or sync interested leads to CRM Leads."
              onUploadClick={() => setActiveTab("upload")}
              onUpdateProspect={handleUpdateProspect}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkDelete={handleBulkDelete}
              onSendToCrm={handleSendToCrm}
            />
          )}

          {activeTab === "calls" && (
            <ProspectTable
              prospects={prospects}
              imports={imports}
              presetStatus="Call Booked"
              title="Booked Calls"
              emptyDescription="No prospects have Call Booked status yet. Google Calendar slot scheduling activates in Phase 10."
              onUploadClick={() => setActiveTab("upload")}
              onUpdateProspect={handleUpdateProspect}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkDelete={handleBulkDelete}
              onSendToCrm={handleSendToCrm}
            />
          )}

          {activeTab === "history" && (
            <AutomationHistoryPanel
              imports={imports}
              activityLog={db.activityLog || []}
            />
          )}

          {activeTab === "integrations" && (
            <IntegrationsPanel capabilities={capabilities} />
          )}

          {(activeTab === "campaigns" ||
            activeTab === "research" ||
            activeTab === "outreach" ||
            activeTab === "settings") && (
            <ComingSoonPanel
              section={activeTab}
              capabilities={capabilities}
              onNavigateTab={setActiveTab}
            />
          )}
        </>
      )}
    </div>
  );
}
