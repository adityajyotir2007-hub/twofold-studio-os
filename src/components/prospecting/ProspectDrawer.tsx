"use client";

import React, { useEffect, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  PROSPECT_STATUSES,
  Prospect,
  ProspectStatus,
} from "@/types/prospecting";
import { ExternalLink, Loader2, Save, UserPlus, X } from "lucide-react";

interface ProspectDrawerProps {
  prospect: Prospect | null;
  onClose: () => void;
  onSave: (
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
  onSendToCrm: (id: string) => Promise<void>;
}

export function ProspectDrawer({
  prospect,
  onClose,
  onSave,
  onSendToCrm,
}: ProspectDrawerProps) {
  const { setActiveSection } = useAgency();

  const [form, setForm] = useState({
    businessName: "",
    contactPerson: "",
    website: "",
    email: "",
    phone: "",
    instagram: "",
    linkedinUrl: "",
    category: "",
    location: "",
    country: "",
    notes: "",
    source: "",
    status: "Imported" as ProspectStatus,
  });
  const [saving, setSaving] = useState(false);
  const [sendingCrm, setSendingCrm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!prospect) return;
    setForm({
      businessName: prospect.businessName || "",
      contactPerson: prospect.contactPerson || "",
      website: prospect.website || "",
      email: prospect.email || "",
      phone: prospect.phone || "",
      instagram: prospect.instagram || "",
      linkedinUrl: prospect.linkedinUrl || "",
      category: prospect.category || "",
      location: prospect.location || "",
      country: prospect.country || "",
      notes: prospect.notes || "",
      source: prospect.source || "",
      status: prospect.status,
    });
    setErr(null);
  }, [prospect]);

  if (!prospect) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await onSave(prospect.id, form);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleCrmClick = async () => {
    setSendingCrm(true);
    setErr(null);
    try {
      await onSendToCrm(prospect.id);
    } catch (error) {
      setErr(
        error instanceof Error ? error.message : "Failed to sync lead to CRM."
      );
    } finally {
      setSendingCrm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 w-full max-w-lg h-full flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate text-neutral-900 dark:text-neutral-100">
              {prospect.businessName ||
                prospect.contactPerson ||
                prospect.email ||
                "Prospect Details"}
            </h2>
            <p className="text-[11px] text-neutral-400 truncate">
              Source: {prospect.source || "Imported"} · Added{" "}
              {new Date(prospect.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4 text-xs"
        >
          {/* Pipeline Status Badges */}
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-neutral-500">
                Pipeline &amp; System Readiness
              </span>
              {prospect.crmLeadId ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setActiveSection("leads");
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium text-[11px]"
                >
                  In CRM <ExternalLink className="w-3 h-3" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={sendingCrm}
                  onClick={handleCrmClick}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-[11px] disabled:opacity-50"
                >
                  {sendingCrm ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserPlus className="w-3 h-3" />
                  )}
                  Add to CRM
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                Enrichment: {prospect.enrichmentStatus.replace(/_/g, " ")}
              </span>
              <span className="px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                Research: {prospect.researchStatus.replace(/_/g, " ")}
              </span>
              <span className="px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                Outreach: {prospect.outreachStatus.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {prospect.validationWarnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-semibold">Validation Notes</div>
              {prospect.validationWarnings.map((w, idx) => (
                <div key={idx}>• {w}</div>
              ))}
            </div>
          )}

          {err && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {err}
            </div>
          )}

          <div>
            <label className="block font-medium mb-1">Lead Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ProspectStatus })
              }
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Business Name</label>
              <input
                value={form.businessName}
                onChange={(e) =>
                  setForm({ ...form, businessName: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={(e) =>
                  setForm({ ...form, contactPerson: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@company.com"
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Phone Number</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 415 555 0199"
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Website</label>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Instagram (handle or URL)
              </label>
              <input
                value={form.instagram}
                onChange={(e) =>
                  setForm({ ...form, instagram: e.target.value })
                }
                placeholder="@handle"
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">LinkedIn URL</label>
              <input
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm({ ...form, linkedinUrl: e.target.value })
                }
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Source</label>
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
            />
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-neutral-400">
            <span>Updated: {new Date(prospect.updatedAt).toLocaleString()}</span>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Prospect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
