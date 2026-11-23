"use client";

import React, { useMemo, useRef, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { AgencyDocument, DocumentCategory } from "@/types/agency";
import {
  Download,
  Eye,
  FileText,
  Folder,
  Loader2,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PREVIEWABLE = (mime: string) =>
  mime.startsWith("image/") ||
  mime.startsWith("text/") ||
  mime === "application/json" ||
  mime === "application/pdf";

export function DocumentsView() {
  const { db, permissions, uploadDocumentFile, deleteDocument } = useAgency();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [folderFilter, setFolderFilter] = useState<string>("All");
  const [clientFilter, setClientFilter] = useState<string>("All");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<AgencyDocument | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<AgencyDocument | null>(null);

  // Upload form
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Proposals");
  const [folder, setFolder] = useState("General");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const folders = useMemo(
    () => ["All", ...Array.from(new Set(db.documents.map((d) => d.folder)))],
    [db.documents]
  );

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.documents.filter((d) => {
      if (categoryFilter !== "All" && d.category !== categoryFilter) return false;
      if (folderFilter !== "All" && d.folder !== folderFilter) return false;
      if (clientFilter !== "All" && d.clientId !== clientFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.folder.toLowerCase().includes(q)
      );
    });
  }, [db.documents, search, categoryFilter, folderFilter, clientFilter]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    db.documents.forEach((d) => {
      map[d.category] = (map[d.category] || 0) + 1;
    });
    return map;
  }, [db.documents]);

  const openPreview = async (doc: AgencyDocument) => {
    setPreviewDoc(doc);
    setPreviewText("");
    if (
      doc.mimeType.startsWith("text/") ||
      doc.mimeType === "application/json"
    ) {
      try {
        const res = await fetch(
          `/api/transactions?__mode=documents&fileId=${encodeURIComponent(
            doc.id
          )}`
        );
        setPreviewText(await res.text());
      } catch {
        setPreviewText("Unable to load preview.");
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    if (!file) {
      setUploadError("Please choose a file to upload.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("Maximum file size is 25 MB.");
      return;
    }
    setUploading(true);
    const result = await uploadDocumentFile({
      file,
      title,
      category,
      folder,
      clientId,
      projectId,
    });
    setUploading(false);
    if (!result) {
      setUploadError("Upload failed. Please try again.");
      return;
    }
    setFile(null);
    setTitle("");
    setIsUploadOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Documents &amp; File Storage
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {db.documents.length} files · Stored in file storage (local disk or Supabase Storage); only metadata lives in the database.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
        >
          <UploadCloud className="w-3.5 h-3.5" /> Upload File
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Category sidebar */}
        <div className="lg:col-span-3 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3 space-y-0.5 text-xs h-fit">
          <button
            type="button"
            onClick={() => setCategoryFilter("All")}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg ${
              categoryFilter === "All"
                ? "bg-neutral-100 dark:bg-neutral-800 font-semibold"
                : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5" /> All Documents
            </span>
            <span className="text-neutral-400">{db.documents.length}</span>
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg ${
                categoryFilter === cat
                  ? "bg-neutral-100 dark:bg-neutral-800 font-semibold"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Folder className="w-3.5 h-3.5 text-neutral-400" /> {cat}
              </span>
              <span className="text-neutral-400">{categoryCounts[cat] || 0}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents by title, file name, folder..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
            </div>
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            >
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f === "All" ? "All Folders" : f}
                </option>
              ))}
            </select>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            >
              <option value="All">All Clients</option>
              {db.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
            {filteredDocs.length === 0 ? (
              <div className="py-14 text-center text-xs text-neutral-400">
                <FileText className="w-6 h-6 mx-auto mb-2 text-neutral-300" />
                No documents found. Upload a file to get started.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {filteredDocs.map((doc) => {
                  const client = db.clients.find((c) => c.id === doc.clientId);
                  const project = db.projects.find((p) => p.id === doc.projectId);
                  const uploader = db.teamMembers.find((m) => m.id === doc.uploadedById);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-neutral-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{doc.title}</div>
                          <div className="text-[11px] text-neutral-400 truncate">
                            {doc.fileName} · {formatBytes(doc.fileSize)} · {doc.category} / {doc.folder}
                          </div>
                          <div className="text-[11px] text-neutral-400 truncate">
                            {client?.businessName || "No client"}
                            {project ? ` · ${project.projectName}` : ""} · {uploader?.name || "—"} · {doc.createdAt}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {PREVIEWABLE(doc.mimeType) && (
                          <button
                            type="button"
                            onClick={() => openPreview(doc)}
                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <a
                          href={`/api/transactions?__mode=documents&fileId=${encodeURIComponent(
                            doc.id
                          )}&download=1`}
                          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {permissions.deleteRecords && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(doc)}
                            className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">Upload Document</h2>
              <button type="button" onClick={() => setIsUploadOpen(false)} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-3.5 text-xs">
              <div
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-6 text-center hover:border-neutral-400"
              >
                <UploadCloud className="w-6 h-6 mx-auto text-neutral-400 mb-2" />
                {file ? (
                  <div className="font-medium">
                    {file.name} ({formatBytes(file.size)})
                  </div>
                ) : (
                  <div className="text-neutral-500">Click to choose a file (max 25 MB)</div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                  }}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Folder</label>
                  <input
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    list="folder-options"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                  <datalist id="folder-options">
                    {folders.filter((f) => f !== "All").map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Client</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">None</option>
                    {db.clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.businessName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Project</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">None</option>
                    {db.projects
                      .filter((p) => !clientId || p.clientId === clientId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.projectName}</option>
                      ))}
                  </select>
                </div>
              </div>
              {uploadError && (
                <div className="text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                  {uploadError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button type="button" onClick={() => setIsUploadOpen(false)} className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold truncate">{previewDoc.title}</h2>
                <p className="text-[11px] text-neutral-400">{previewDoc.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/api/transactions?__mode=documents&fileId=${encodeURIComponent(previewDoc.id)}&download=1`} className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button type="button" onClick={() => setPreviewDoc(null)} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5 bg-neutral-50 dark:bg-neutral-950">
              {previewDoc.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/transactions?__mode=documents&fileId=${encodeURIComponent(previewDoc.id)}`} alt={previewDoc.title} className="max-w-full mx-auto rounded-lg" />
              ) : previewDoc.mimeType === "application/pdf" ? (
                <iframe src={`/api/transactions?__mode=documents&fileId=${encodeURIComponent(previewDoc.id)}`} className="w-full h-[70vh] rounded-lg" title={previewDoc.title} />
              ) : (
                <pre className="whitespace-pre-wrap text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  {previewText || "Loading preview..."}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-xs">
            <h3 className="text-sm font-semibold">Delete document?</h3>
            <p className="text-neutral-500 mt-1">
              &ldquo;{deleteConfirm.title}&rdquo; and its stored file will be permanently removed.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteDocument(deleteConfirm.id);
                  setDeleteConfirm(null);
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
