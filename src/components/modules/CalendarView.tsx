"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

interface CalendarEventItem {
  id: string;
  date: string;
  title: string;
  category: "Task" | "Project Deadline" | "Follow-up" | "Invoice Due";
  badgeClass: string;
}

export function CalendarView() {
  const {
    db,
    currentUser,
    addTask,
    setActiveSection,
    setSelectedProjectId,
  } = useAgency();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [quickTaskTitle, setQuickTaskTitle] = useState("");

  // Aggregate all events from Tasks, Project Deadlines, Lead Follow-ups, and Invoices
  const allEvents = useMemo<CalendarEventItem[]>(() => {
    const list: CalendarEventItem[] = [];

    db.tasks.forEach((t) => {
      list.push({
        id: `t-${t.id}`,
        date: t.dueDate,
        title: `Task: ${t.taskTitle}`,
        category: "Task",
        badgeClass:
          "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
      });
    });

    db.projects.forEach((p) => {
      list.push({
        id: `p-${p.id}`,
        date: p.deadline,
        title: `Deadline: ${p.projectName}`,
        category: "Project Deadline",
        badgeClass:
          "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
      });
    });

    db.leads.forEach((l) => {
      if (l.nextFollowUpDate && l.status !== "Converted") {
        list.push({
          id: `l-${l.id}`,
          date: l.nextFollowUpDate,
          title: `Follow-up: ${l.businessName}`,
          category: "Follow-up",
          badgeClass:
            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        });
      }
    });

    db.finance.forEach((f) => {
      if (f.transactionType !== "Expense" && f.paymentStatus !== "Paid") {
        list.push({
          id: `f-${f.id}`,
          date: f.dueDate,
          title: `Invoice Due: ${f.invoiceNumber}`,
          category: "Invoice Due",
          badgeClass:
            "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300",
        });
      }
    });

    return list;
  }, [db.tasks, db.projects, db.leads, db.finance]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { dateStr: string; dayNumber: number; inMonth: boolean }[] =
      [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ dateStr: "", dayNumber: 0, inMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      cells.push({ dateStr, dayNumber: d, inMonth: true });
    }

    return cells;
  }, [currentMonth]);

  const selectedDateEvents = useMemo(
    () => allEvents.filter((e) => e.date === selectedDateStr),
    [allEvents, selectedDateStr]
  );

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleQuickAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim() || !selectedDateStr) return;
    addTask({
      taskTitle: quickTaskTitle.trim(),
      description: `Scheduled from Studio Calendar for ${selectedDateStr}`,
      relatedClientId: "",
      relatedProjectId: "",
      assignedPersonId: currentUser.id,
      priority: "Medium",
      startDate: selectedDateStr,
      dueDate: selectedDateStr,
      status: "To Do",
      isRecurring: false,
    });
    setQuickTaskTitle("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Studio Master Calendar
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Unified schedule of tasks, project launch deadlines, client follow-ups, and invoice due dates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() - 1,
                  1
                )
              )
            }
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() + 1,
                  1
                )
              )
            }
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Grid */}
        <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4">
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-neutral-400 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 mt-2">
            {calendarDays.map((cell, idx) => {
              if (!cell.inMonth) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="h-24 rounded-lg bg-neutral-50/40 dark:bg-neutral-950/30"
                  />
                );
              }
              const dayEvents = allEvents.filter(
                (e) => e.date === cell.dateStr
              );
              const isSelected = cell.dateStr === selectedDateStr;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`h-24 rounded-lg border p-1.5 text-left flex flex-col justify-between transition overflow-hidden ${
                    isSelected
                      ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800/40"
                      : "border-neutral-200/60 dark:border-neutral-800 hover:border-neutral-300"
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {cell.dayNumber}
                  </span>
                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[9px] px-1.5 py-0.5 rounded truncate font-medium ${ev.badgeClass}`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-neutral-400 pl-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Agenda & Quick Add */}
        <div className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div>
              <span className="text-xs text-neutral-400">Selected Date</span>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {selectedDateStr}
              </h2>
            </div>

            <form onSubmit={handleQuickAddTask} className="flex gap-2 text-xs">
              <input
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                placeholder="Schedule task on this date..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            <div className="space-y-2 text-xs">
              {selectedDateEvents.length === 0 ? (
                <p className="text-neutral-400 py-6 text-center">
                  No deadlines, tasks, or follow-ups scheduled for{" "}
                  {selectedDateStr}.
                </p>
              ) : (
                selectedDateEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => {
                      if (ev.category === "Project Deadline") {
                        setSelectedProjectId(ev.id.replace("p-", ""));
                        setActiveSection("projects");
                      } else if (ev.category === "Follow-up") {
                        setActiveSection("leads");
                      } else if (ev.category === "Invoice Due") {
                        setActiveSection("finance");
                      } else {
                        setActiveSection("tasks");
                      }
                    }}
                    className="cursor-pointer p-3 rounded-lg border border-neutral-200/70 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  >
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded ${ev.badgeClass}`}
                    >
                      {ev.category}
                    </span>
                    <div className="font-semibold mt-1.5">{ev.title}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-white" />{" "}
              Tasks
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Project
              Deadlines
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Lead
              Follow-ups
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Invoices Due
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
