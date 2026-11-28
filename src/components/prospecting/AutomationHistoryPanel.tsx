"use client";

import React, { useState } from "react";
import { ActivityLogItem } from "@/types/agency";
import { ProspectImport } from "@/types/prospecting";
import { ChevronDown, ChevronRight, FileSpreadsheet, Workflow } from "lucide-react";

interface AutomationHistoryPanelProps {
  imports: ProspectImport[];
  activityLog: ActivityLogItem[];
}

export function AutomationHistoryPanel({
  imports,
  activityLog,
}: AutomationHistoryPanelProps) {
  const [expandedImportId, setExpandedImportId] = useState<string | null>(null);

  const prospectEvents = activityLog.filter((item) =>
    item.entityType.startsWith("Prospect")
  );

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 flex items-start gap-3 text-xs">
        <Workflow className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-neutral-800 dark:text-neutral-200">
            Automation Runs: None executed yet
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">
            Automated background runs (n8n research, enrichment, outreach dispatch) will appear here once Phase 5–8 workflows are configured. All spreadsheet import jobs and CRM audit events are logged below.
          </p>
        </div>
      </div>

      {/* Spreadsheet Import History */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Spreadsheet Import History ({imports.length})
            </h2>
            <p className="text-xs text-neutral-500">
              Audit trail of uploaded files, deduplication outcomes, and row-level results
            </p>
          </div>
        </div>

        {imports.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 text-neutral-400" />
            No spreadsheet imports recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {imports.map((imp) => {
              const isOpen = expandedImportId === imp.id;
              return (
                <div key={imp.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedImportId(isOpen ? null : imp.id)
                      }
                      className="flex items-center gap-2 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {imp.fileName}{" "}
                          <span className="text-[10px] uppercase font-normal px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 ml-1">
                            {imp.fileType}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {new Date(imp.createdAt).toLocaleString()} · By{" "}
                          {imp.createdByName} · Duplicate mode:{" "}
                          {imp.duplicateStrategy}
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          imp.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : imp.status === "completed_with_errors"
                            ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : imp.status === "failed"
                            ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                        }`}
                      >
                        {imp.status.replace(/_/g, " ")}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 tabular-nums">
                        +{imp.importedCount} imported
                      </span>
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 tabular-nums">
                        {imp.updatedCount} updated
                      </span>
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 tabular-nums">
                        {imp.skippedCount} skipped
                      </span>
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 tabular-nums">
                        {imp.failedCount} failed
                      </span>
                    </div>
                  </div>

                  {imp.error && (
                    <div className="mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[11px]">
                      {imp.error}
                    </div>
                  )}

                  {isOpen && imp.rowResults.length > 0 && (
                    <div className="mt-3 max-h-64 overflow-y-auto border border-neutral-200/80 dark:border-neutral-800 rounded-lg">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 border-b border-neutral-200/80 dark:border-neutral-800">
                          <tr>
                            <th className="py-1.5 px-3">Row #</th>
                            <th className="py-1.5 px-3">Outcome</th>
                            <th className="py-1.5 px-3">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                          {imp.rowResults.slice(0, 200).map((rr, idx) => (
                            <tr key={`${rr.rowNumber}-${idx}`}>
                              <td className="py-1.5 px-3 tabular-nums">
                                #{rr.rowNumber}
                              </td>
                              <td className="py-1.5 px-3 font-medium">
                                {rr.outcome.replace(/_/g, " ")}
                              </td>
                              <td className="py-1.5 px-3 text-neutral-500">
                                {rr.reason || rr.prospectId || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {imp.rowResults.length > 200 && (
                        <div className="p-2 text-center text-[11px] text-neutral-400">
                          Showing first 200 of {imp.rowResults.length} row logs.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prospect Audit Events */}
      {prospectEvents.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 space-y-2.5">
          <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            Recent Prospecting Audit Activity
          </h3>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {prospectEvents.slice(0, 20).map((ev) => (
              <div
                key={ev.id}
                className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <div>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {ev.actorName}
                  </span>{" "}
                  <span className="text-neutral-500">{ev.details}</span>
                </div>
                <span className="text-[11px] text-neutral-400 tabular-nums shrink-0">
                  {ev.createdAt}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
