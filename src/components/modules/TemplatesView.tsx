"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { TEMPLATE_CATEGORIES } from "@/lib/constants";
import { AgencyTemplate, TemplateCategory } from "@/types/agency";
import { Check, Copy, CopyPlus, Edit3, Plus, Search, Trash2, X } from "lucide-react";

export function TemplatesView() {
  const {
    db,
    permissions,
    addTemplate,
    updateTemplate,
    duplicateTemplate,
    deleteTemplate,
    incrementTemplateUsage,
  } = useAgency();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const emptyForm = {
    title: "",
    category: "Cold Email Templates" as TemplateCategory,
    subjectOrHook: "",
    content: "",
    tags: "",
  };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.templates.filter((t) => {
      if (category !== "All" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [db.templates, search, category]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setIsOpen(true);
  };

  const openEdit = (t: AgencyTemplate) => {
    setEditing(t);
    setForm({
      title: t.title,
      category: t.category,
      subjectOrHook: t.subjectOrHook,
      content: t.content,
      tags: t.tags.join(", "),
    });
    setError("");
    setIsOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      category: form.category,
      subjectOrHook: form.subjectOrHook.trim(),
      content: form.content,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (editing) updateTemplate(editing.id, payload);
    else addTemplate(payload);
    setIsOpen(false);
  };

  const handleCopy = async (t: AgencyTemplate) => {
    try {
      await navigator.clipboard.writeText(t.content);
      incrementTemplateUsage(t.id);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Templates &amp; Resources</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {db.templates.length} reusable templates for outreach, proposals, agreements, onboarding and launch checklists.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
        >
          <Plus className="w-3.5 h-3.5" /> New Template
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by title, content, or tag..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["All", ...TEMPLATE_CATEGORIES].map((c) => {
          const count = c === "All" ? db.templates.length : db.templates.filter((t) => t.category === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                category === c
                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
              }`}
            >
              {c} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl py-14 text-center text-xs text-neutral-400">
          No templates match. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {t.category}
                  </span>
                  <span className="text-[10px] text-neutral-400">Used {t.usageCount}×</span>
                </div>
                <h3 className="text-sm font-semibold mt-2">{t.title}</h3>
                {t.subjectOrHook && (
                  <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{t.subjectOrHook}</p>
                )}
                <pre className="whitespace-pre-wrap font-sans text-[11px] text-neutral-600 dark:text-neutral-400 mt-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-lg p-2.5 max-h-40 overflow-hidden">
                  {t.content}
                </pre>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {t.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-neutral-500">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <span className="text-[10px] text-neutral-400">Updated {t.updatedAt}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(t)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  >
                    {copiedId === t.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedId === t.id ? "Copied" : "Copy"}
                  </button>
                  <button type="button" onClick={() => duplicateTemplate(t.id)} title="Duplicate" className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500">
                    <CopyPlus className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => openEdit(t)} title="Edit" className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {permissions.deleteRecords && (
                    <button type="button" onClick={() => setDeleteId(t.id)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">{editing ? "Edit Template" : "New Template"}</h2>
              <button type="button" onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Subject / Hook</label>
                <input
                  value={form.subjectOrHook}
                  onChange={(e) => setForm({ ...form, subjectOrHook: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Content * <span className="font-normal text-neutral-400">— supports {"{{Business_Name}}"}, {"{{Contact_Person}}"}, {"{{City}}"}…</span>
                </label>
                <textarea
                  rows={12}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Tags (comma-separated)</label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              {error && <div className="text-red-600">{error}</div>}
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium">
                  {editing ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-xs">
            <h3 className="text-sm font-semibold">Delete template?</h3>
            <p className="text-neutral-500 mt-1">This action cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setDeleteId(null)} className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTemplate(deleteId);
                  setDeleteId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium"
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
