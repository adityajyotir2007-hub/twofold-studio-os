"use client";

import React from "react";
import {
  Prospect,
  ProspectImport,
  ProspectingCapabilities,
  ProspectingSectionTab,
  PROSPECT_STATUSES,
} from "@/types/prospecting";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Sparkles,
  Upload,
  UserPlus,
} from "lucide-react";

interface OverviewPanelProps {
  prospects: Prospect[];
  imports: ProspectImport[];
  capabilities: ProspectingCapabilities | null;
  onNavigateTab: (tab: ProspectingSectionTab) => void;
}

export function OverviewPanel({
  prospects,
  imports,
  capabilities,
  onNavigateTab,
}: OverviewPanelProps) {
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const st of PROSPECT_STATUSES) counts[st] = 0;
    for (const p of prospects) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [prospects]);

  const crmLinkedCount = prospects.filter((p) => Boolean(p.crmLeadId)).length;
  const interestedCount = prospects.filter(
    (p) => p.status === "Interested" || p.status === "Call Booked"
  ).length;
  const lastImport = imports[0] || null;

  const checklist = [
    {
      label: "Spreadsheet Import Engine (.csv, .xlsx, .xls)",
      ready: true,
      detail: `Ready (up to ${
        capabilities?.maxImportRows.toLocaleString() || "2,000"
      } rows per file)`,
    },
    {
      label: "CRM Lead Sync & Duplicate Prevention",
      ready: true,
      detail: "Connected to existing CRM leads",
    },
    {
      label: "Persistent Multi-Tenant Database (Supabase)",
      ready: Boolean(capabilities?.supabaseConfigured),
      detail: capabilities?.supabaseConfigured
        ? "Connected"
        : "Not provisioned — using browser + temporary server storage",
    },
    {
      label: "AI Research & Personalization (Gemini API)",
      ready: Boolean(capabilities?.gemini),
      detail: capabilities?.gemini
        ? "Configured"
        : "Missing GEMINI_API_KEY on server",
    },
    {
      label: "Workflow Automation Engine (n8n)",
      ready: Boolean(capabilities?.n8n),
      detail: capabilities?.n8n
        ? "Configured"
        : "Missing N8N_WEBHOOK_BASE_URL & N8N_WEBHOOK_SECRET",
    },
    {
      label: "Outreach Sending (Gmail OAuth)",
      ready: Boolean(capabilities?.gmail),
      detail: capabilities?.gmail
        ? "Connected"
        : "Not connected in Settings → Integrations",
    },
    {
      label: "Call Booking Calendar (Google Calendar)",
      ready: Boolean(capabilities?.googleCalendar),
      detail: capabilities?.googleCalendar
        ? "Connected"
        : "Not connected in Settings → Integrations",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Total Prospects</span>
            <Database className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">
            {prospects.length.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            Scoped to current workspace
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Spreadsheet Imports</span>
            <FileSpreadsheet className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">
            {imports.length.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
            {lastImport
              ? `Last: ${lastImport.fileName}`
              : "No spreadsheets uploaded yet"}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Interested / Call Booked</span>
            <Sparkles className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">
            {interestedCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            Ready for sales review
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Linked in CRM Leads</span>
            <UserPlus className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">
            {crmLinkedCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            Synchronized without duplicates
          </div>
        </div>
      </div>

      {prospects.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-8 text-center">
          <div className="w-11 h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 mx-auto flex items-center justify-center mb-3">
            <Upload className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
          </div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Start by uploading your first prospect spreadsheet
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
            Upload a CSV or Excel file (.xlsx / .xls), review column mapping, validate emails, phones, and websites, detect duplicates, and import directly into your workspace prospect database.
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab("upload")}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition"
          >
            <Upload className="w-3.5 h-3.5" /> Upload your first spreadsheet
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Pipeline Status Breakdown
              </h2>
              <p className="text-xs text-neutral-500">
                Live counts across every prospect lifecycle stage
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("database")}
              className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:underline"
            >
              Open Prospect Database →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROSPECT_STATUSES.map((st) => (
              <div
                key={st}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950 text-xs"
              >
                <span className="text-neutral-600 dark:text-neutral-300">
                  {st}
                </span>
                <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {statusCounts[st] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Honest System & Setup Checklist */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Platform Setup Checklist
            </h2>
            <p className="text-xs text-neutral-500">
              Verified backend &amp; provider readiness for AI Prospecting
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("integrations")}
            className="text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:underline self-start sm:self-auto"
          >
            Inspect Integrations →
          </button>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 text-xs">
          {checklist.map((item) => (
            <div
              key={item.label}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
            >
              <div className="flex items-center gap-2">
                {item.ready ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {item.label}
                </span>
              </div>
              <span
                className={`text-[11px] sm:text-right ${
                  item.ready
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
