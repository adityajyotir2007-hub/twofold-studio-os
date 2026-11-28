"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  autoMapColumns,
  EMPTY_PROSPECT_INPUT,
  PROSPECT_IMPORT_FIELDS,
} from "@/lib/prospecting/fields";
import { ParsedSpreadsheet, parseSpreadsheetFile } from "@/lib/prospecting/parse";
import {
  checkProspectDuplicates,
  importProspectsBatch,
} from "@/lib/prospecting/client-api";
import {
  PROSPECTING_DEFAULT_MAX_ROWS,
  RowValidationStatus,
  validateProspectRow,
  ValidatedProspectRow,
} from "@/lib/prospecting/validate";
import {
  DuplicateCheckResultItem,
  Prospect,
  ProspectImport,
  ProspectInput,
  ProspectingCapabilities,
} from "@/types/prospecting";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

interface UploadWizardProps {
  capabilities: ProspectingCapabilities | null;
  onImportComplete: (payload: {
    importRecord: ProspectImport;
    prospects: Prospect[];
    imports: ProspectImport[];
  }) => void;
  onViewDatabase: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ReviewRowItem {
  rowNumber: number; // 1-based data row (matches spreadsheet row offset)
  data: ProspectInput;
  validated: ValidatedProspectRow;
  duplicate: DuplicateCheckResultItem["duplicateOf"];
  included: boolean;
}

const REVIEW_PAGE_SIZE = 50;

export function UploadWizard({
  capabilities,
  onImportComplete,
  onViewDatabase,
}: UploadWizardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [fileMeta, setFileMeta] = useState<{
    name: string;
    size: number;
    type: "csv" | "xlsx" | "xls";
  } | null>(null);
  const [parsedSheet, setParsedSheet] = useState<ParsedSpreadsheet | null>(null);
  const [columnMap, setColumnMap] = useState<Record<keyof ProspectInput, number>>(
    () => autoMapColumns([])
  );
  const [autoMappedKeys, setAutoMappedKeys] = useState<Set<string>>(new Set());

  // Step 3 Review state
  const [reviewRows, setReviewRows] = useState<ReviewRowItem[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<
    "all" | RowValidationStatus | "duplicate"
  >("all");
  const [reviewPage, setReviewPage] = useState(1);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">(
    "skip"
  );
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Step 4 / 5 progress & results
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ProspectImport | null>(null);

  const maxRows = capabilities?.maxImportRows || PROSPECTING_DEFAULT_MAX_ROWS;
  const maxFileMb = Math.round(
    (capabilities?.maxFileBytes || 5 * 1024 * 1024) / (1024 * 1024)
  );

  const resetWizard = () => {
    setStep(1);
    setParseError(null);
    setFileMeta(null);
    setParsedSheet(null);
    setColumnMap(autoMapColumns([]));
    setAutoMappedKeys(new Set());
    setReviewRows([]);
    setReviewFilter("all");
    setReviewPage(1);
    setDuplicateStrategy("skip");
    setIdempotencyKey("");
    setSubmitError(null);
    setImportResult(null);
  };

  const handleFileChosen = async (file: File) => {
    setParseError(null);
    setParsing(true);
    try {
      const sheet = await parseSpreadsheetFile(file, maxRows);
      const initialMap = autoMapColumns(sheet.headers);
      const mappedSet = new Set<string>();
      for (const [k, idx] of Object.entries(initialMap)) {
        if (idx >= 0) mappedSet.add(k);
      }

      setFileMeta({
        name: file.name,
        size: file.size,
        type: sheet.fileType,
      });
      setParsedSheet(sheet);
      setColumnMap(initialMap);
      setAutoMappedKeys(mappedSet);
      setIdempotencyKey(crypto.randomUUID());
      setStep(2);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Unable to read spreadsheet."
      );
    } finally {
      setParsing(false);
    }
  };

  const hasAtLeastOneIdentifierMapping =
    columnMap.businessName >= 0 ||
    columnMap.contactPerson >= 0 ||
    columnMap.website >= 0 ||
    columnMap.email >= 0 ||
    columnMap.instagram >= 0 ||
    columnMap.linkedinUrl >= 0;

  const handleProceedToReview = async () => {
    if (!parsedSheet || !hasAtLeastOneIdentifierMapping) return;
    setCheckingDuplicates(true);
    setParseError(null);

    try {
      const mappedInputs: ProspectInput[] = parsedSheet.rows.map((cells) => {
        const obj: ProspectInput = { ...EMPTY_PROSPECT_INPUT };
        for (const f of PROSPECT_IMPORT_FIELDS) {
          const colIdx = columnMap[f.key];
          if (colIdx >= 0 && colIdx < cells.length) {
            obj[f.key] = cells[colIdx] || "";
          }
        }
        return obj;
      });

      const dupResults = await checkProspectDuplicates(mappedInputs);
      const dupByIdx = new Map(
        dupResults.map((d) => [d.rowIndex, d.duplicateOf])
      );

      const assembled: ReviewRowItem[] = mappedInputs.map((raw, idx) => {
        const validated = validateProspectRow(raw);
        const dup = dupByIdx.get(idx) || null;
        const included =
          validated.status !== "invalid" &&
          (!dup || dup.type === "crm_lead" || duplicateStrategy === "update");

        return {
          rowNumber: idx + 1,
          data: validated.clean,
          validated,
          duplicate: dup,
          included,
        };
      });

      setReviewRows(assembled);
      setReviewFilter("all");
      setReviewPage(1);
      setStep(3);
    } catch (err) {
      setParseError(
        err instanceof Error
          ? err.message
          : "Failed to check duplicates against workspace records."
      );
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleDuplicateStrategyChange = (nextStrategy: "skip" | "update") => {
    setDuplicateStrategy(nextStrategy);
    setReviewRows((prev) =>
      prev.map((row) => {
        if (row.validated.status === "invalid") {
          return { ...row, included: false };
        }
        if (row.duplicate && row.duplicate.type === "prospect") {
          return { ...row, included: nextStrategy === "update" };
        }
        return row;
      })
    );
  };

  const summary = useMemo(() => {
    let ready = 0;
    let incomplete = 0;
    let duplicate = 0;
    let invalid = 0;
    let included = 0;

    for (const r of reviewRows) {
      if (r.validated.status === "invalid") invalid++;
      else if (r.validated.status === "incomplete") incomplete++;
      else ready++;
      if (r.duplicate) duplicate++;
      if (r.included) included++;
    }
    return { ready, incomplete, duplicate, invalid, included };
  }, [reviewRows]);

  const filteredReviewRows = useMemo(() => {
    return reviewRows.filter((r) => {
      if (reviewFilter === "all") return true;
      if (reviewFilter === "duplicate") return Boolean(r.duplicate);
      return r.validated.status === reviewFilter;
    });
  }, [reviewRows, reviewFilter]);

  const reviewTotalPages = Math.max(
    1,
    Math.ceil(filteredReviewRows.length / REVIEW_PAGE_SIZE)
  );
  const safeReviewPage = Math.min(reviewPage, reviewTotalPages);
  const visibleReviewRows = filteredReviewRows.slice(
    (safeReviewPage - 1) * REVIEW_PAGE_SIZE,
    safeReviewPage * REVIEW_PAGE_SIZE
  );

  const handleConfirmImport = async () => {
    if (!fileMeta || !parsedSheet || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setStep(4);

    try {
      const mappingLabels: Record<string, string> = {};
      for (const f of PROSPECT_IMPORT_FIELDS) {
        const idx = columnMap[f.key];
        if (idx >= 0 && parsedSheet.headers[idx]) {
          mappingLabels[f.key] = parsedSheet.headers[idx];
        }
      }

      const result = await importProspectsBatch({
        idempotencyKey: idempotencyKey || crypto.randomUUID(),
        fileName: fileMeta.name,
        fileType: fileMeta.type,
        fileSize: fileMeta.size,
        duplicateStrategy,
        columnMapping: mappingLabels,
        rows: reviewRows.map((r) => ({
          rowNumber: r.rowNumber,
          included: r.included,
          data: r.data,
        })),
      });

      setImportResult(result.importRecord);
      onImportComplete(result);
      setStep(5);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to import prospects."
      );
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReportCsv = () => {
    if (!importResult) return;
    const rows = [
      ["Row Number", "Outcome", "Details", "Prospect ID"],
      ...importResult.rowResults.map((r) => [
        String(r.rowNumber),
        r.outcome,
        r.reason || "",
        r.prospectId || "",
      ]),
    ];
    const csv = rows
      .map((line) =>
        line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospect-import-report-${importResult.fileName.replace(
      /\.[^.]+$/,
      ""
    )}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Stepper Header */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { num: 1, label: "1. Select File" },
            { num: 2, label: "2. Map Columns" },
            { num: 3, label: "3. Validate & Review" },
            { num: 4, label: "4. Import" },
            { num: 5, label: "5. Results" },
          ].map((s) => (
            <span
              key={s.num}
              className={`px-2.5 py-1 rounded-full font-medium ${
                step === s.num
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : step > s.num
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>
        {fileMeta && (
          <span className="text-[11px] text-neutral-400 truncate max-w-[260px]">
            {fileMeta.name} ({parsedSheet?.rows.length || 0} rows)
          </span>
        )}
      </div>

      {/* STEP 1: Select or Drop File */}
      {step === 1 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileChosen(f);
            }}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition ${
              dragActive
                ? "border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-800/50"
                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileChosen(f);
                e.target.value = "";
              }}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 mx-auto flex items-center justify-center mb-3">
              {parsing ? (
                <Loader2 className="w-6 h-6 animate-spin text-neutral-600 dark:text-neutral-300" />
              ) : (
                <FileSpreadsheet className="w-6 h-6 text-neutral-600 dark:text-neutral-300" />
              )}
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Drag &amp; drop a CSV or Excel prospect spreadsheet
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Supports <code className="text-[11px]">.csv</code>,{" "}
              <code className="text-[11px]">.xlsx</code>, and{" "}
              <code className="text-[11px]">.xls</code> · Max {maxFileMb} MB · Up
              to {maxRows.toLocaleString()} rows per import
            </p>
            <button
              type="button"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" /> Choose Spreadsheet File
            </button>
          </div>

          {parseError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Column Mapping */}
      {step === 2 && parsedSheet && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Map Spreadsheet Columns
              </h2>
              <p className="text-neutral-500">
                Incomplete records are supported — map at least one identifying field (Business Name, Contact Person, Website, Email, Instagram, or LinkedIn).
              </p>
            </div>
            <button
              type="button"
              onClick={resetWizard}
              className="text-xs text-neutral-500 hover:underline self-start"
            >
              Choose a different file
            </button>
          </div>

          <div className="overflow-x-auto border border-neutral-200/80 dark:border-neutral-800 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-[11px] font-medium text-neutral-500">
                  <th className="py-2.5 px-3.5">Prospect Field</th>
                  <th className="py-2.5 px-3.5">Spreadsheet Column</th>
                  <th className="py-2.5 px-3.5">Sample Values (First 3 Rows)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {PROSPECT_IMPORT_FIELDS.map((field) => {
                  const colIdx = columnMap[field.key];
                  const samples =
                    colIdx >= 0
                      ? parsedSheet.rows
                          .slice(0, 3)
                          .map((r) => r[colIdx] || "")
                          .filter(Boolean)
                      : [];
                  return (
                    <tr key={field.key}>
                      <td className="py-2.5 px-3.5 font-medium text-neutral-800 dark:text-neutral-200">
                        <div className="flex items-center gap-1.5">
                          <span>{field.label}</span>
                          {autoMappedKeys.has(field.key) && colIdx >= 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-medium">
                              Auto-mapped
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <select
                          value={colIdx}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setColumnMap((prev) => ({
                              ...prev,
                              [field.key]: val,
                            }));
                            setAutoMappedKeys((prev) => {
                              const next = new Set(prev);
                              next.delete(field.key);
                              return next;
                            });
                          }}
                          className="w-full max-w-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                        >
                          <option
                            value={-1}
                            className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                          >
                            — Not mapped —
                          </option>
                          {parsedSheet.headers.map((h, i) => (
                            <option
                              key={`${h}-${i}`}
                              value={i}
                              className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3.5 text-neutral-500 max-w-xs truncate">
                        {samples.length > 0 ? samples.join(" · ") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!hasAtLeastOneIdentifierMapping && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
              Map at least one identifying column (Business Name, Contact Person, Website, Email, Instagram, or LinkedIn) to continue.
            </div>
          )}

          {parseError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {parseError}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={resetWizard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={!hasAtLeastOneIdentifierMapping || checkingDuplicates}
              onClick={handleProceedToReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium disabled:opacity-50"
            >
              {checkingDuplicates ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking
                  Duplicates...
                </>
              ) : (
                <>
                  Validate &amp; Review <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Duplicate Resolution */}
      {step === 3 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Review Records Before Importing
              </h2>
              <p className="text-neutral-500">
                {summary.included} of {reviewRows.length} rows selected for import.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-neutral-500">When a duplicate exists:</span>
              <select
                value={duplicateStrategy}
                onChange={(e) =>
                  handleDuplicateStrategyChange(
                    e.target.value as "skip" | "update"
                  )
                }
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option
                  value="skip"
                  className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  Skip duplicates
                </option>
                <option
                  value="update"
                  className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  Update existing prospects
                </option>
              </select>
            </div>
          </div>

          {/* Summary Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all" as const, label: `All (${reviewRows.length})` },
              { key: "ready" as const, label: `Ready (${summary.ready})` },
              {
                key: "incomplete" as const,
                label: `Incomplete (${summary.incomplete})`,
              },
              {
                key: "duplicate" as const,
                label: `Duplicates (${summary.duplicate})`,
              },
              { key: "invalid" as const, label: `Invalid (${summary.invalid})` },
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  setReviewFilter(chip.key);
                  setReviewPage(1);
                }}
                className={`px-3 py-1 rounded-full font-medium border transition ${
                  reviewFilter === chip.key
                    ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                    : "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-950 dark:text-neutral-300 dark:border-neutral-800"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {submitError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          {/* Review Table */}
          <div className="overflow-x-auto border border-neutral-200/80 dark:border-neutral-800 rounded-xl max-h-[420px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] font-medium text-neutral-500">
                <tr>
                  <th className="py-2 px-3">Include</th>
                  <th className="py-2 px-3">Row</th>
                  <th className="py-2 px-3">Business / Contact</th>
                  <th className="py-2 px-3">Email / Phone</th>
                  <th className="py-2 px-3">Website / Social</th>
                  <th className="py-2 px-3">Validation &amp; Dedupe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {visibleReviewRows.map((row) => {
                  const isInvalid = row.validated.status === "invalid";
                  return (
                    <tr key={row.rowNumber}>
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          disabled={isInvalid}
                          checked={row.included}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setReviewRows((prev) =>
                              prev.map((item) =>
                                item.rowNumber === row.rowNumber
                                  ? { ...item, included: checked }
                                  : item
                              )
                            );
                          }}
                        />
                      </td>
                      <td className="py-2 px-3 tabular-nums text-neutral-400">
                        #{row.rowNumber}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {row.data.businessName || "—"}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {row.data.contactPerson || "—"}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div>{row.data.email || "—"}</div>
                        <div className="text-neutral-400">
                          {row.data.phone || "—"}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div className="truncate max-w-[160px]">
                          {row.validated.websiteDomain || "—"}
                        </div>
                        <div className="text-neutral-400">
                          {row.data.instagram ? `@${row.data.instagram}` : "—"}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              row.validated.status === "ready"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : row.validated.status === "incomplete"
                                ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            }`}
                          >
                            {row.validated.status}
                          </span>
                          {row.duplicate && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              Duplicate ({row.duplicate.type}):{" "}
                              {row.duplicate.label}
                            </span>
                          )}
                          {(row.validated.warnings.length > 0 ||
                            row.validated.reason) && (
                            <span
                              title={
                                row.validated.reason ||
                                row.validated.warnings.join(" | ")
                              }
                              className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {row.validated.reason ||
                                row.validated.warnings[0]}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredReviewRows.length > REVIEW_PAGE_SIZE && (
            <div className="flex items-center justify-between text-[11px] text-neutral-500">
              <span>
                Page {safeReviewPage} of {reviewTotalPages} (
                {filteredReviewRows.length} rows)
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={safeReviewPage <= 1}
                  onClick={() => setReviewPage((n) => Math.max(1, n - 1))}
                  className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safeReviewPage >= reviewTotalPages}
                  onClick={() =>
                    setReviewPage((n) => Math.min(reviewTotalPages, n + 1))
                  }
                  className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Mapping
            </button>
            <button
              type="button"
              disabled={submitting || reviewRows.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium disabled:opacity-50"
            >
              Import {summary.included} Selected Row
              {summary.included === 1 ? "" : "s"}{" "}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Real Processing Stage List (No fake progress %) */}
      {step === 4 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-8 max-w-md mx-auto space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Importing Prospects into Workspace…
          </h2>
          <div className="space-y-2 text-neutral-600 dark:text-neutral-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Parsed spreadsheet rows</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Validated contact fields</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Checked workspace &amp; CRM duplicates</span>
            </div>
            <div className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving prospects &amp; creating import audit log…</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Import Results Summary */}
      {step === 5 && importResult && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Import Completed: {importResult.fileName}
                </h2>
                <p className="text-neutral-500">
                  Status: {importResult.status.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadReportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium self-start"
            >
              <Download className="w-3.5 h-3.5" /> Download Error / Row Report
              (CSV)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Imported", value: importResult.importedCount },
              { label: "Updated", value: importResult.updatedCount },
              { label: "Skipped", value: importResult.skippedCount },
              { label: "Failed", value: importResult.failedCount },
            ].map((card) => (
              <div
                key={card.label}
                className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800"
              >
                <div className="text-[11px] text-neutral-500">{card.label}</div>
                <div className="text-xl font-semibold tabular-nums mt-0.5">
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {importResult.rowResults.some(
            (r) =>
              r.outcome === "failed" ||
              r.outcome === "skipped_duplicate" ||
              r.outcome === "skipped_excluded"
          ) && (
            <div className="border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 border-b border-neutral-200/80 dark:border-neutral-800">
                  <tr>
                    <th className="py-2 px-3">Row #</th>
                    <th className="py-2 px-3">Outcome</th>
                    <th className="py-2 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {importResult.rowResults
                    .filter((r) => r.outcome !== "imported" && r.outcome !== "updated")
                    .slice(0, 150)
                    .map((r, idx) => (
                      <tr key={`${r.rowNumber}-${idx}`}>
                        <td className="py-1.5 px-3 tabular-nums">
                          #{r.rowNumber}
                        </td>
                        <td className="py-1.5 px-3 font-medium">
                          {r.outcome.replace(/_/g, " ")}
                        </td>
                        <td className="py-1.5 px-3 text-neutral-500">
                          {r.reason || "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onViewDatabase}
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
            >
              View Prospect Database
            </button>
            <button
              type="button"
              onClick={resetWizard}
              className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 font-medium"
            >
              Upload another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
