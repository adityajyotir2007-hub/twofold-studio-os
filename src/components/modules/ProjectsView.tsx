"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  AGENCY_SERVICES,
  formatCurrency,
  PRIORITY_LEVELS,
  PROJECT_STAGES,
} from "@/lib/constants";
import { PriorityLevel, Project, ProjectStage } from "@/types/agency";
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Globe,
  Kanban,
  LayoutGrid,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

export function ProjectsView() {
  const {
    db,
    currentUser,
    permissions,
    selectedProjectId,
    setSelectedProjectId,
    setSelectedClientId,
    setActiveSection,
    addProject,
    updateProject,
    deleteProject,
    toggleProjectChecklist,
    addProjectChecklistItem,
    addTask,
    updateTask,
  } = useAgency();

  const defaultCurrency = db.settings.defaultCurrency;
  const [viewMode, setViewMode] = useState<"grid" | "pipeline">("grid");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Project Detail sub-inputs
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [newChecklistAssignee, setNewChecklistAssignee] = useState(
    currentUser.id
  );
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState(currentUser.id);
  const [newTaskPriority, setNewTaskPriority] =
    useState<PriorityLevel>("High");
  const [newTaskDue, setNewTaskDue] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );

  const emptyForm = {
    projectName: "",
    clientId: db.clients[0]?.id || "",
    projectType: AGENCY_SERVICES[2],
    projectDescription: "",
    projectBudget: 32000,
    startDate: new Date().toISOString().slice(0, 10),
    deadline: new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10),
    projectStatus: "Proposal Sent" as ProjectStage,
    progressPercentage: 10,
    assignedTeamMembers: [currentUser.id, "tm-3", "tm-4"],
    websiteDemoUrl: "https://staging.twofold.studio",
    liveWebsiteUrl: "",
    referenceWebsites: ["https://linear.app", "https://stripe.com"],
    internalNotes: "",
  };

  const [formState, setFormState] = useState(emptyForm);
  const [refSiteInput, setRefSiteInput] = useState(
    "https://linear.app, https://stripe.com"
  );

  const selectedProject = useMemo(
    () => db.projects.find((p) => p.id === selectedProjectId) || null,
    [db.projects, selectedProjectId]
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.projects.filter((p) => {
      if (stageFilter !== "All" && p.projectStatus !== stageFilter)
        return false;
      if (!q) return true;
      const client = db.clients.find((c) => c.id === p.clientId);
      return (
        p.projectName.toLowerCase().includes(q) ||
        p.projectType.toLowerCase().includes(q) ||
        (client?.businessName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [db.projects, db.clients, search, stageFilter]);

  const openAddModal = () => {
    setEditingProject(null);
    setFormState(emptyForm);
    setRefSiteInput("https://linear.app, https://stripe.com");
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormState({
      projectName: project.projectName,
      clientId: project.clientId,
      projectType: project.projectType,
      projectDescription: project.projectDescription,
      projectBudget: project.projectBudget,
      startDate: project.startDate,
      deadline: project.deadline,
      projectStatus: project.projectStatus,
      progressPercentage: project.progressPercentage,
      assignedTeamMembers: project.assignedTeamMembers,
      websiteDemoUrl: project.websiteDemoUrl,
      liveWebsiteUrl: project.liveWebsiteUrl,
      referenceWebsites: project.referenceWebsites,
      internalNotes: project.internalNotes,
    });
    setRefSiteInput(project.referenceWebsites.join(", "));
    setIsModalOpen(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.projectName.trim()) return;
    const refs = refSiteInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (editingProject) {
      updateProject(editingProject.id, {
        ...formState,
        referenceWebsites: refs,
      });
    } else {
      addProject({
        ...formState,
        referenceWebsites: refs,
      });
    }
    setIsModalOpen(false);
  };

  // DEDICATED PROJECT DETAIL PAGE
  if (selectedProject) {
    const client = db.clients.find((c) => c.id === selectedProject.clientId);
    const currentStageIndex = PROJECT_STAGES.indexOf(
      selectedProject.projectStatus
    );
    const projectTasks = db.tasks.filter(
      (t) => t.relatedProjectId === selectedProject.id
    );

    return (
      <div className="space-y-6">
        {/* Back & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {selectedProject.projectName}
                </h1>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                  {selectedProject.projectStatus}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Client:{" "}
                <button
                  type="button"
                  onClick={() => {
                    if (client) {
                      setSelectedClientId(client.id);
                      setActiveSection("clients");
                    }
                  }}
                  className="font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
                >
                  {client?.businessName || "Internal"}
                </button>{" "}
                · {selectedProject.projectType} · Start:{" "}
                {selectedProject.startDate} · Deadline:{" "}
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {selectedProject.deadline}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedProject.projectStatus}
              onChange={(e) => {
                const nextStage = e.target.value as ProjectStage;
                const idx = PROJECT_STAGES.indexOf(nextStage);
                const suggestedPct = Math.round(
                  ((idx + 1) / PROJECT_STAGES.length) * 100
                );
                updateProject(selectedProject.id, {
                  projectStatus: nextStage,
                  progressPercentage: suggestedPct,
                });
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            >
              {PROJECT_STAGES.map((st) => (
                <option key={st} value={st}>
                  Stage: {st}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => openEditModal(selectedProject)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Project
            </button>
          </div>
        </div>

        {/* Visual 12-Stage Agency Progress Tracker */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">
                12-Stage Website Engineering Pipeline
              </h2>
              <p className="text-xs text-neutral-500">
                Click any stage below to transition project status and notify stakeholders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500">
                Overall Progress:
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={selectedProject.progressPercentage}
                onChange={(e) =>
                  updateProject(selectedProject.id, {
                    progressPercentage: Number(e.target.value),
                  })
                }
                className="w-28 accent-neutral-900 dark:accent-white"
              />
              <span className="text-sm font-semibold tabular-nums">
                {selectedProject.progressPercentage}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-1.5 mt-4">
            {PROJECT_STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() =>
                    updateProject(selectedProject.id, {
                      projectStatus: stage,
                      progressPercentage: Math.round(
                        ((idx + 1) / PROJECT_STAGES.length) * 100
                      ),
                    })
                  }
                  className={`p-2 rounded-lg border text-left transition flex flex-col justify-between min-h-[64px] ${
                    isCurrent
                      ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900"
                      : isPast
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300"
                      : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200/70 dark:border-neutral-800 text-neutral-500"
                  }`}
                >
                  <div className="text-[10px] font-mono opacity-75">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="text-[11px] font-medium leading-tight mt-1">
                    {stage}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Grid: 14-Point Quality Checklist + Project Tasks + Metadata & URLs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 cols: 14-Point Project Delivery Checklist */}
          <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  Agency Delivery Checklist
                </h2>
                <p className="text-xs text-neutral-500">
                  {selectedProject.checklist.filter((c) => c.completed).length}{" "}
                  of {selectedProject.checklist.length} milestones verified
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                {Math.round(
                  (selectedProject.checklist.filter((c) => c.completed).length /
                    Math.max(1, selectedProject.checklist.length)) *
                    100
                )}
                %
              </span>
            </div>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {selectedProject.checklist.map((item) => {
                const assignee = db.teamMembers.find(
                  (m) => m.id === item.assignedToId
                );
                return (
                  <label
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200/60 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() =>
                          toggleProjectChecklist(selectedProject.id, item.id)
                        }
                        className="rounded border-neutral-300"
                      />
                      <span
                        className={
                          item.completed
                            ? "line-through text-neutral-400"
                            : "font-medium text-neutral-800 dark:text-neutral-200"
                        }
                      >
                        {item.label}
                      </span>
                    </div>
                    {assignee && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {assignee.avatarInitials}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Add Custom Checklist Milestone */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex gap-2 text-xs">
              <input
                value={newChecklistLabel}
                onChange={(e) => setNewChecklistLabel(e.target.value)}
                placeholder="Add custom checklist item..."
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
              <select
                value={newChecklistAssignee}
                onChange={(e) => setNewChecklistAssignee(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              >
                {db.teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name.split(" ")[0]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  addProjectChecklistItem(
                    selectedProject.id,
                    newChecklistLabel,
                    newChecklistAssignee
                  );
                  setNewChecklistLabel("");
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
              >
                Add
              </button>
            </div>
          </div>

          {/* Right 7 cols: Project Tasks + Demo/Live URLs + Assigned Team & Notes */}
          <div className="lg:col-span-7 space-y-5">
            {/* Project Tasks Section */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-neutral-500" />
                  Assigned Project Tasks ({projectTasks.length})
                </h2>
              </div>

              {/* Add Project Task inline */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Assign a new task for this project..."
                  className="sm:col-span-5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="sm:col-span-3 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                >
                  {db.teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newTaskPriority}
                  onChange={(e) =>
                    setNewTaskPriority(e.target.value as PriorityLevel)
                  }
                  className="sm:col-span-2 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                >
                  {PRIORITY_LEVELS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!newTaskTitle.trim()) return;
                    addTask({
                      taskTitle: newTaskTitle.trim(),
                      description: `Project deliverable for ${selectedProject.projectName}`,
                      relatedClientId: selectedProject.clientId,
                      relatedProjectId: selectedProject.id,
                      assignedPersonId: newTaskAssignee,
                      priority: newTaskPriority,
                      startDate: new Date().toISOString().slice(0, 10),
                      dueDate: newTaskDue,
                      status: "To Do",
                      isRecurring: false,
                    });
                    setNewTaskTitle("");
                  }}
                  className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                >
                  Assign Task
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {projectTasks.length === 0 ? (
                  <p className="text-neutral-400 py-2">
                    No tasks created for this project yet.
                  </p>
                ) : (
                  projectTasks.map((t) => {
                    const member = db.teamMembers.find(
                      (m) => m.id === t.assignedPersonId
                    );
                    return (
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
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500">
                            {member?.name || "Unassigned"} · Due {t.dueDate}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                            {t.priority}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Project Environments, Reference Websites & Team */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-4 text-xs">
              <h2 className="text-sm font-semibold">
                Environments, References &amp; Assigned Squad
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                  <div className="text-neutral-400 mb-1">
                    Staging / Demo Website URL
                  </div>
                  {selectedProject.websiteDemoUrl ? (
                    <a
                      href={selectedProject.websiteDemoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium inline-flex items-center gap-1 hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {selectedProject.websiteDemoUrl}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-neutral-400">Not provisioned</span>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                  <div className="text-neutral-400 mb-1">
                    Production Live Website URL
                  </div>
                  {selectedProject.liveWebsiteUrl ? (
                    <a
                      href={selectedProject.liveWebsiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium inline-flex items-center gap-1 text-emerald-600 hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {selectedProject.liveWebsiteUrl}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-neutral-400">
                      Pending launch cutover
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-neutral-400 mb-1.5">
                  Reference Websites &amp; Inspiration
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.referenceWebsites.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 inline-flex items-center gap-1"
                    >
                      {url.replace(/^https?:\/\//, "")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-neutral-400 mb-1.5">
                  Assigned Team Members
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.assignedTeamMembers.map((id) => {
                    const m = db.teamMembers.find((tm) => tm.id === id);
                    if (!m) return null;
                    return (
                      <div
                        key={id}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800"
                      >
                        <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-[10px] font-semibold">
                          {m.avatarInitials}
                        </span>
                        <span className="font-medium">{m.name}</span>
                        <span className="text-neutral-400">({m.title})</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-neutral-400 mb-1">
                  Internal Engineering &amp; Delivery Notes
                </div>
                <textarea
                  rows={3}
                  value={selectedProject.internalNotes}
                  onChange={(e) =>
                    updateProject(selectedProject.id, {
                      internalNotes: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PROJECTS LIST / PIPELINE VIEW
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Website Projects &amp; Delivery
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            12-stage web development pipeline · Click any project to open its visual tracker and 14-point checklist.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === "grid"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pipeline")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === "pipeline"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> 12-Stage Board
            </button>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
          >
            <Plus className="w-3.5 h-3.5" /> New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by title, client, or project type..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All 12 Stages</option>
          {PROJECT_STAGES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const client = db.clients.find((c) => c.id === project.clientId);
            const completedChecks = project.checklist.filter(
              (c) => c.completed
            ).length;
            return (
              <div
                key={project.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 hover:border-neutral-400 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                      {project.projectStatus}
                    </span>
                    <span className="text-xs font-semibold tabular-nums">
                      {project.progressPercentage}% Complete
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="text-base font-semibold text-neutral-900 dark:text-neutral-100 hover:underline text-left block"
                  >
                    {project.projectName}
                  </button>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {client?.businessName || "Internal"} · {project.projectType}
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-2">
                    {project.projectDescription}
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-900 dark:bg-white rounded-full transition-all"
                      style={{ width: `${project.progressPercentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="text-neutral-500">
                      <span>Due {project.deadline}</span>
                      <span className="mx-1.5">·</span>
                      <span>
                        {completedChecks}/{project.checklist.length} checklist
                      </span>
                      {permissions.finance && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(
                              project.projectBudget,
                              defaultCurrency
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(project.id)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                      >
                        Tracker &amp; Checklist
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(project)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {permissions.deleteRecords && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(project.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 12-STAGE KANBAN PIPELINE */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PROJECT_STAGES.map((stage, idx) => {
            const stageProjects = filteredProjects.filter(
              (p) => p.projectStatus === stage
            );
            return (
              <div
                key={stage}
                className="w-64 shrink-0 bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 rounded-xl p-3 flex flex-col"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold">
                    {idx + 1}. {stage}
                  </span>
                  <span className="text-[11px] px-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    {stageProjects.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {stageProjects.map((project) => {
                    const client = db.clients.find(
                      (c) => c.id === project.clientId
                    );
                    return (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className="cursor-pointer bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 hover:border-neutral-400 transition"
                      >
                        <div className="text-xs font-semibold">
                          {project.projectName}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {client?.businessName}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400">
                            Due {project.deadline}
                          </span>
                          <span className="font-semibold">
                            {project.progressPercentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT PROJECT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editingProject ? "Edit Project" : "Create New Website Project"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Project Name *
                  </label>
                  <input
                    required
                    value={formState.projectName}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        projectName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Client</label>
                  <select
                    value={formState.clientId}
                    onChange={(e) =>
                      setFormState({ ...formState, clientId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {db.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Project Type</label>
                  <select
                    value={formState.projectType}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        projectType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {AGENCY_SERVICES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Project Budget
                  </label>
                  <input
                    type="number"
                    value={formState.projectBudget}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        projectBudget: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formState.startDate}
                    onChange={(e) =>
                      setFormState({ ...formState, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Deadline</label>
                  <input
                    type="date"
                    value={formState.deadline}
                    onChange={(e) =>
                      setFormState({ ...formState, deadline: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Project Stage (1-12)
                  </label>
                  <select
                    value={formState.projectStatus}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        projectStatus: e.target.value as ProjectStage,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {PROJECT_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Progress Percentage ({formState.progressPercentage}%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formState.progressPercentage}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        progressPercentage: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Website Demo URL
                  </label>
                  <input
                    value={formState.websiteDemoUrl}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        websiteDemoUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Live Website URL
                  </label>
                  <input
                    value={formState.liveWebsiteUrl}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        liveWebsiteUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Reference Websites (comma-separated)
                  </label>
                  <input
                    value={refSiteInput}
                    onChange={(e) => setRefSiteInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1.5">
                  Assigned Squad Members
                </label>
                <div className="flex flex-wrap gap-2">
                  {db.teamMembers.map((m) => {
                    const checked = formState.assignedTeamMembers.includes(
                      m.id
                    );
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setFormState({
                              ...formState,
                              assignedTeamMembers: checked
                                ? formState.assignedTeamMembers.filter(
                                    (id) => id !== m.id
                                  )
                                : [...formState.assignedTeamMembers, m.id],
                            })
                          }
                        />
                        <span>{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Project Description
                  </label>
                  <textarea
                    rows={2}
                    value={formState.projectDescription}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        projectDescription: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Internal Notes
                  </label>
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
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                >
                  {editingProject ? "Save Project" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PROJECT CONFIRMATION */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-xs">
            <h3 className="text-sm font-semibold">Delete Project?</h3>
            <p className="text-neutral-500 mt-1">
              This will permanently remove the project and its checklist.
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
                  deleteProject(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
