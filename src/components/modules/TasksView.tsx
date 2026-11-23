"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  formatCurrency,
  PRIORITY_LEVELS,
  TASK_STATUSES,
} from "@/lib/constants";
import { AgencyTask, PriorityLevel, TaskStatus } from "@/types/agency";
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  Edit3,
  Kanban,
  LayoutList,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
} from "lucide-react";

export function TasksView() {
  const {
    db,
    currentUser,
    permissions,
    addTask,
    updateTask,
    deleteTask,
    setActiveSection,
  } = useAgency();

  const defaultCurrency = db.settings.defaultCurrency;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [viewMode, setViewMode] = useState<"list" | "kanban" | "daily">("list");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);

  const emptyForm = {
    taskTitle: "",
    description: "",
    relatedClientId: db.clients[0]?.id || "",
    relatedProjectId: db.projects[0]?.id || "",
    assignedPersonId: currentUser.id,
    priority: "High" as PriorityLevel,
    startDate: todayStr,
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    status: "To Do" as TaskStatus,
    isRecurring: false,
    recurrencePattern: "Weekly" as "Daily" | "Weekly" | "Monthly",
  };
  const [formState, setFormState] = useState(emptyForm);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.tasks.filter((t) => {
      if (priorityFilter !== "All" && t.priority !== priorityFilter)
        return false;
      if (assigneeFilter !== "All" && t.assignedPersonId !== assigneeFilter)
        return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.taskTitle.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [db.tasks, search, priorityFilter, assigneeFilter, statusFilter]);

  const overdueCount = useMemo(
    () =>
      db.tasks.filter((t) => t.status !== "Completed" && t.dueDate < todayStr)
        .length,
    [db.tasks, todayStr]
  );

  // Reminders Strip: Project deadlines, Client follow-ups, Pending payments, Scheduled meetings
  const reminders = useMemo(() => {
    const deadlineProjects = db.projects
      .filter((p) => p.projectStatus !== "Completed")
      .slice(0, 2);
    const dueFollowUps = db.leads
      .filter(
        (l) =>
          l.status !== "Converted" &&
          l.nextFollowUpDate &&
          l.nextFollowUpDate <= todayStr
      )
      .slice(0, 2);
    const pendingInvoices = db.finance
      .filter(
        (f) =>
          f.transactionType !== "Expense" &&
          (f.paymentStatus === "Overdue" ||
            f.paymentStatus === "Partially Paid" ||
            f.paymentStatus === "Unpaid")
      )
      .slice(0, 2);
    const scheduledMeetings = db.leads
      .filter((l) => l.status === "Meeting Scheduled")
      .slice(0, 2);

    return {
      deadlineProjects,
      dueFollowUps,
      pendingInvoices,
      scheduledMeetings,
    };
  }, [db.projects, db.leads, db.finance, todayStr]);

  const openAddModal = () => {
    setEditingTask(null);
    setFormState(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (task: AgencyTask) => {
    setEditingTask(task);
    setFormState({
      taskTitle: task.taskTitle,
      description: task.description,
      relatedClientId: task.relatedClientId,
      relatedProjectId: task.relatedProjectId,
      assignedPersonId: task.assignedPersonId,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      status: task.status,
      isRecurring: task.isRecurring,
      recurrencePattern: task.recurrencePattern || "Weekly",
    });
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.taskTitle.trim()) return;
    if (editingTask) {
      updateTask(editingTask.id, formState);
    } else {
      addTask(formState);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Task Management &amp; Execution
            </h1>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5" /> {overdueCount} Overdue
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Centralized task board across all clients, projects, and recurring studio rituals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === "list"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === "kanban"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === "daily"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Daily Focus
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("calendar")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* Automated Smart Reminders Strip (Deadlines, Follow-ups, Payments, Meetings) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div
          onClick={() => setActiveSection("projects")}
          className="cursor-pointer bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 hover:border-neutral-400 transition"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="font-medium">Upcoming Project Deadlines</span>
            <Bell className="w-3.5 h-3.5" />
          </div>
          {reminders.deadlineProjects.map((p) => (
            <div key={p.id} className="truncate font-medium mt-1">
              • {p.projectName} ({p.deadline})
            </div>
          ))}
        </div>

        <div
          onClick={() => setActiveSection("leads")}
          className="cursor-pointer bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 hover:border-neutral-400 transition"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="font-medium">Client &amp; Lead Follow-ups</span>
            <Bell className="w-3.5 h-3.5 text-amber-500" />
          </div>
          {reminders.dueFollowUps.map((l) => (
            <div key={l.id} className="truncate font-medium mt-1">
              • {l.businessName} (Due {l.nextFollowUpDate})
            </div>
          ))}
        </div>

        <div
          onClick={() => permissions.finance && setActiveSection("finance")}
          className="cursor-pointer bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 hover:border-neutral-400 transition"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="font-medium">Pending Payments</span>
            <Bell className="w-3.5 h-3.5 text-red-500" />
          </div>
          {permissions.finance ? (
            reminders.pendingInvoices.map((inv) => (
              <div key={inv.id} className="truncate font-medium mt-1">
                • {inv.invoiceNumber}:{" "}
                {formatCurrency(inv.amount - inv.paidAmount, inv.currency)} (
                {inv.paymentStatus})
              </div>
            ))
          ) : (
            <div className="text-neutral-400 mt-1">Restricted to Managers</div>
          )}
        </div>

        <div
          onClick={() => setActiveSection("calendar")}
          className="cursor-pointer bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 hover:border-neutral-400 transition"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="font-medium">Scheduled Meetings</span>
            <Calendar className="w-3.5 h-3.5" />
          </div>
          {reminders.scheduledMeetings.map((m) => (
            <div key={m.id} className="truncate font-medium mt-1">
              • {m.businessName} ({m.contactPerson})
            </div>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or description..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
          />
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Priorities</option>
          {PRIORITY_LEVELS.map((p) => (
            <option key={p} value={p}>
              {p} Priority
            </option>
          ))}
        </select>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Team Members</option>
          {db.teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Statuses</option>
          {TASK_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* VIEW MODES */}
      {viewMode === "list" && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 bg-neutral-50/60 dark:bg-neutral-950/50">
                  <th className="py-2.5 px-3.5 w-8">Done</th>
                  <th className="py-2.5 px-3.5">Task &amp; Description</th>
                  <th className="py-2.5 px-3.5">Client / Project</th>
                  <th className="py-2.5 px-3.5">Assigned To</th>
                  <th className="py-2.5 px-3.5">Priority</th>
                  <th className="py-2.5 px-3.5">Due Date</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
                {filteredTasks.map((task) => {
                  const client = db.clients.find(
                    (c) => c.id === task.relatedClientId
                  );
                  const project = db.projects.find(
                    (p) => p.id === task.relatedProjectId
                  );
                  const member = db.teamMembers.find(
                    (m) => m.id === task.assignedPersonId
                  );
                  const isOverdue =
                    task.status !== "Completed" && task.dueDate < todayStr;
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition"
                    >
                      <td className="py-3 px-3.5">
                        <input
                          type="checkbox"
                          checked={task.status === "Completed"}
                          onChange={() =>
                            updateTask(task.id, {
                              status:
                                task.status === "Completed"
                                  ? "To Do"
                                  : "Completed",
                            })
                          }
                          className="rounded border-neutral-300"
                        />
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-semibold ${
                              task.status === "Completed"
                                ? "line-through text-neutral-400"
                                : "text-neutral-900 dark:text-neutral-100"
                            }`}
                          >
                            {task.taskTitle}
                          </span>
                          {task.isRecurring && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500">
                              <Repeat className="w-2.5 h-2.5" />{" "}
                              {task.recurrencePattern}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {task.description}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-medium">
                          {project?.projectName || "Studio Internal"}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {client?.businessName || "Twofold Studio"}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        {member?.name || "Unassigned"}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            task.priority === "Urgent"
                              ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                              : task.priority === "High"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 tabular-nums">
                        <span
                          className={
                            isOverdue
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : "text-neutral-600 dark:text-neutral-400"
                          }
                        >
                          {task.dueDate} {isOverdue ? "(Overdue)" : ""}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            updateTask(task.id, {
                              status: e.target.value as TaskStatus,
                            })
                          }
                          className="px-2 py-1 rounded-md text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        >
                          {TASK_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(task)}
                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {permissions.deleteRecords && (
                            <button
                              type="button"
                              onClick={() => deleteTask(task.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_STATUSES.map((statusCol) => {
            const colTasks = filteredTasks.filter(
              (t) => t.status === statusCol
            );
            return (
              <div
                key={statusCol}
                className="bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 rounded-xl p-3 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold">{statusCol}</span>
                  <span className="text-[11px] px-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {colTasks.map((task) => {
                    const member = db.teamMembers.find(
                      (m) => m.id === task.assignedPersonId
                    );
                    const isOverdue =
                      task.status !== "Completed" && task.dueDate < todayStr;
                    return (
                      <div
                        key={task.id}
                        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">
                            {task.taskTitle}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          {task.description}
                        </p>
                        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
                          <span
                            className={
                              isOverdue
                                ? "text-red-600 font-medium"
                                : "text-neutral-400"
                            }
                          >
                            {isOverdue ? `Overdue ${task.dueDate}` : task.dueDate}
                          </span>
                          <select
                            value={task.status}
                            onChange={(e) =>
                              updateTask(task.id, {
                                status: e.target.value as TaskStatus,
                              })
                            }
                            className="text-[10px] border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 bg-neutral-50 dark:bg-neutral-800"
                          >
                            {TASK_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          Assigned: {member?.name || "Unassigned"}
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

      {viewMode === "daily" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Overdue & Due Today",
              items: filteredTasks.filter(
                (t) => t.status !== "Completed" && t.dueDate <= todayStr
              ),
            },
            {
              title: "Upcoming This Week",
              items: filteredTasks.filter(
                (t) => t.status !== "Completed" && t.dueDate > todayStr
              ),
            },
            {
              title: "Completed Recently",
              items: filteredTasks.filter((t) => t.status === "Completed"),
            },
          ].map((col) => (
            <div
              key={col.title}
              className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 space-y-3"
            >
              <h2 className="text-sm font-semibold">
                {col.title} ({col.items.length})
              </h2>
              <div className="space-y-2 text-xs">
                {col.items.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg border border-neutral-200/70 dark:border-neutral-800 flex items-start justify-between gap-2"
                  >
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={t.status === "Completed"}
                        onChange={() =>
                          updateTask(t.id, {
                            status:
                              t.status === "Completed" ? "To Do" : "Completed",
                          })
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-medium">{t.taskTitle}</div>
                        <div className="text-[11px] text-neutral-400">
                          Due {t.dueDate} · {t.priority}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editingTask ? "Edit Task" : "Create & Assign Task"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">Task Title *</label>
                <input
                  required
                  value={formState.taskTitle}
                  onChange={(e) =>
                    setFormState({ ...formState, taskTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={(e) =>
                    setFormState({ ...formState, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Related Client
                  </label>
                  <select
                    value={formState.relatedClientId}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        relatedClientId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">Internal Studio Task</option>
                    {db.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Related Project
                  </label>
                  <select
                    value={formState.relatedProjectId}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        relatedProjectId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">General Operations</option>
                    {db.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Assigned To</label>
                  <select
                    value={formState.assignedPersonId}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        assignedPersonId: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {db.teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Priority</label>
                  <select
                    value={formState.priority}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        priority: e.target.value as PriorityLevel,
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {PRIORITY_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        status: e.target.value as TaskStatus,
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {TASK_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(e) =>
                      setFormState({ ...formState, dueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={formState.isRecurring}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isRecurring: e.target.checked,
                      })
                    }
                  />
                  Recurring Studio Task
                </label>
                {formState.isRecurring && (
                  <select
                    value={formState.recurrencePattern}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        recurrencePattern: e.target.value as
                          | "Daily"
                          | "Weekly"
                          | "Monthly",
                      })
                    }
                    className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                )}
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
                  {editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
