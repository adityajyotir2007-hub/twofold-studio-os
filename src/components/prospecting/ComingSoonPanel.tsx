"use client";

import React from "react";
import {
  ProspectingCapabilities,
  ProspectingSectionTab,
} from "@/types/prospecting";
import {
  DEFAULT_MAX_ROWS_NOTE,
} from "./panel-helpers";
import { Lock, Settings2 } from "lucide-react";

interface ComingSoonPanelProps {
  section: "campaigns" | "research" | "outreach" | "settings";
  capabilities: ProspectingCapabilities | null;
  onNavigateTab: (tab: ProspectingSectionTab) => void;
}

export function ComingSoonPanel({
  section,
  capabilities,
  onNavigateTab,
}: ComingSoonPanelProps) {
  if (section === "settings") {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
            <Settings2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Prospecting Engine Configuration &amp; Safeguards
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Read-only view of active validation limits, duplicate matching rules, and environment safeguards.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <div className="font-semibold text-neutral-800 dark:text-neutral-200">
              Spreadsheet Import Limits
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Maximum File Size</span>
              <span className="font-medium tabular-nums">
                {Math.round(
                  (capabilities?.maxFileBytes || 5 * 1024 * 1024) / (1024 * 1024)
                )}{" "}
                MB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Maximum Rows / Import</span>
              <span className="font-medium tabular-nums">
                {(capabilities?.maxImportRows || 2000).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Supported Formats</span>
              <span className="font-medium">.csv, .xlsx, .xls</span>
            </div>
            <p className="text-[11px] text-neutral-400 pt-1">
              {DEFAULT_MAX_ROWS_NOTE}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <div className="font-semibold text-neutral-800 dark:text-neutral-200">
              Workspace Duplicate Detection Keys
            </div>
            <ul className="list-disc list-inside space-y-1 text-neutral-600 dark:text-neutral-400">
              <li>Normalized Email (lowercased, trimmed)</li>
              <li>
                Website Domain (excludes social/free webmail domains like{" "}
                <code className="text-[11px]">instagram.com</code>,{" "}
                <code className="text-[11px]">gmail.com</code>)
              </li>
              <li>Phone Number (last 10 digits, min 7 digits)</li>
              <li>Instagram Handle (lowercased, without @)</li>
              <li>Business Name + Country (alphanumeric, min 3 chars)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const meta = {
    campaigns: {
      title: "Prospecting Campaigns — Scheduled for Phases 6–8",
      description:
        "Multi-step prospecting sequences, sending schedules, suppression lists, and per-campaign conversion tracking will activate once AI draft approval and sending integrations are configured.",
      requires:
        "Requires Gmail OAuth / provider integration (Settings → Integrations) and Phase 6/8 sequence execution.",
    },
    research: {
      title: "AI Research & Enrichment — Scheduled for Phase 5",
      description:
        "Automated website analysis, industry classification, opportunity identification, and personalized prospect summaries will run server-side through Gemini without fabricating unverified contact details.",
      requires: capabilities?.gemini
        ? "GEMINI_API_KEY is detected on the server. Phase 5 workflow endpoint will connect it to Prospect Database records."
        : "Requires server-side GEMINI_API_KEY and optional enrichment provider API keys (currently none configured).",
    },
    outreach: {
      title: "AI Outreach & Approval Queue — Scheduled for Phases 6 & 8",
      description:
        "Personalized draft generation, human-in-the-loop preview & approval before sending, unsubscribe/suppression checks, and reply classification will live here. Emails are never sent automatically without approval.",
      requires: capabilities?.gmail
        ? "Gmail API is connected. Phase 6 draft/approval queue and Phase 8 dispatch workflows are next."
        : "Requires draft/approval workflow (Phase 6) and a connected Gmail OAuth account.",
    },
  }[section];

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-8">
      <div className="max-w-xl space-y-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          <Lock className="w-3 h-3" /> Not available yet
        </div>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {meta.title}
        </h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
          {meta.description}
        </p>
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
          <strong className="text-neutral-700 dark:text-neutral-200">
            Status:
          </strong>{" "}
          {meta.requires}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => onNavigateTab("database")}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            View Prospect Database
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab("integrations")}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Check Integration Readiness
          </button>
        </div>
      </div>
    </div>
  );
}
