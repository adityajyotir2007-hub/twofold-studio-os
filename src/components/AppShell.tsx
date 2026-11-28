"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { NavigationSection } from "@/types/agency";
import { AuthScreen } from "@/components/AuthScreen";
import { InteractiveLandingPage } from "@/components/InteractiveLandingPage";
import { DashboardView } from "@/components/modules/DashboardView";
import { LeadsCrmView } from "@/components/modules/LeadsCrmView";
import { OutreachManagerView } from "@/components/modules/OutreachManagerView";
import { ProspectingView } from "@/components/modules/ProspectingView";
import { ColdCallsView } from "@/components/modules/ColdCallsView";
import { ClientsView } from "@/components/modules/ClientsView";
import { ProjectsView } from "@/components/modules/ProjectsView";
import { TasksView } from "@/components/modules/TasksView";
import { CalendarView } from "@/components/modules/CalendarView";
import { FinanceView } from "@/components/modules/FinanceView";
import { DocumentsView } from "@/components/modules/DocumentsView";
import { TemplatesView } from "@/components/modules/TemplatesView";
import { AnalyticsView } from "@/components/modules/AnalyticsView";
import { TeamView } from "@/components/modules/TeamView";
import { SettingsView } from "@/components/modules/SettingsView";
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Phone,
  Plus,
  Radar,
  Radio,
  Search,
  Send,
  Settings,
  Sun,
  Users,
  UsersRound,
  X,
} from "lucide-react";

const NAV: {
  key: NavigationSection;
  label: string;
  icon: React.ElementType;
  perm?: "finance" | "team";
}[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "leads", label: "Leads & CRM", icon: Users },
  { key: "outreach", label: "Outreach & Campaigns", icon: Send },
  { key: "prospecting", label: "AI Prospecting", icon: Radar },
  { key: "calls", label: "Cold Calling", icon: Phone },
  { key: "clients", label: "Clients", icon: Briefcase },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "finance", label: "Finance", icon: DollarSign, perm: "finance" },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "team", label: "Team", icon: UsersRound, perm: "team" },
  { key: "settings", label: "Settings", icon: Settings },
];

interface LiveAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  section: NavigationSection;
}

export function AppShell() {
  const {
    db,
    isLoading,
    isAuthenticated,
    isRealtimeConnected,
    currentUser,
    permissions,
    activeSection,
    setActiveSection,
    setSelectedClientId,
    setSelectedProjectId,
    theme,
    toggleTheme,
    logout,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAgency();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [previewLanding, setPreviewLanding] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const prefs = db.settings.notificationPreferences;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setNotifOpen(false);
        setQuickOpen(false);
        setProfileOpen(false);
        setActivityOpen(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const liveAlerts = useMemo<LiveAlert[]>(() => {
    const alerts: LiveAlert[] = [];
    if (prefs.followUpsDue) {
      db.leads
        .filter(
          (l) =>
            l.nextFollowUpDate &&
            l.nextFollowUpDate <= todayStr &&
            !["Converted", "Lost", "Not Interested"].includes(l.status)
        )
        .forEach((l) =>
          alerts.push({
            id: `fu-${l.id}`,
            type: "Follow-up Due",
            title: `Follow up: ${l.businessName}`,
            message: `Due ${l.nextFollowUpDate} · ${l.status}`,
            section: "leads",
          })
        );
    }
    if (prefs.overdueTasks) {
      db.tasks
        .filter((t) => t.status !== "Completed" && t.dueDate < todayStr)
        .forEach((t) =>
          alerts.push({
            id: `ot-${t.id}`,
            type: "Overdue Task",
            title: t.taskTitle,
            message: `Was due ${t.dueDate}`,
            section: "tasks",
          })
        );
    }
    if (prefs.projectDeadlines) {
      db.projects
        .filter((p) => {
          if (p.projectStatus === "Completed") return false;
          const d =
            (new Date(p.deadline).getTime() - new Date(todayStr).getTime()) /
            86400000;
          return d <= 7;
        })
        .forEach((p) =>
          alerts.push({
            id: `pd-${p.id}`,
            type: "Project Deadline",
            title: p.projectName,
            message:
              p.deadline < todayStr
                ? `Past deadline (${p.deadline})`
                : `Deadline ${p.deadline} · ${p.progressPercentage}%`,
            section: "projects",
          })
        );
    }
    if (prefs.pendingPayments && permissions.finance) {
      db.finance
        .filter(
          (f) =>
            f.transactionType !== "Expense" &&
            (f.paymentStatus === "Overdue" ||
              (f.paymentStatus !== "Paid" &&
                f.paymentStatus !== "Refunded" &&
                f.dueDate < todayStr))
        )
        .forEach((f) =>
          alerts.push({
            id: `pp-${f.id}`,
            type: "Pending Payment",
            title: `${f.invoiceNumber} overdue`,
            message: `${f.currency} ${(
              f.amount - f.paidAmount
            ).toLocaleString()} outstanding`,
            section: "finance",
          })
        );
    }
    return alerts;
  }, [
    db.leads,
    db.tasks,
    db.projects,
    db.finance,
    prefs,
    permissions.finance,
    todayStr,
  ]);

  const visibleStored = db.notifications.filter(
    (n) =>
      (permissions.finance || n.section !== "finance") &&
      (!n.recipientMemberId || n.recipientMemberId === currentUser.id)
  );
  const unread =
    visibleStored.filter((n) => !n.isRead).length + liveAlerts.length;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: {
      id: string;
      label: string;
      sub: string;
      kind: string;
      go: () => void;
    }[] = [];
    db.leads.forEach((l) => {
      if (
        [l.businessName, l.contactPerson, l.businessEmail, l.city]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        out.push({
          id: l.id,
          label: l.businessName,
          sub: `${l.contactPerson} · ${l.status}`,
          kind: "Lead",
          go: () => setActiveSection("leads"),
        });
    });
    db.clients.forEach((c) => {
      if (
        [c.businessName, c.contactPerson, c.email]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        out.push({
          id: c.id,
          label: c.businessName,
          sub: c.contactPerson,
          kind: "Client",
          go: () => {
            setSelectedClientId(c.id);
            setActiveSection("clients");
          },
        });
    });
    db.projects.forEach((p) => {
      if ([p.projectName, p.projectType].join(" ").toLowerCase().includes(q))
        out.push({
          id: p.id,
          label: p.projectName,
          sub: p.projectStatus,
          kind: "Project",
          go: () => {
            setSelectedProjectId(p.id);
            setActiveSection("projects");
          },
        });
    });
    db.tasks.forEach((t) => {
      if (t.taskTitle.toLowerCase().includes(q))
        out.push({
          id: t.id,
          label: t.taskTitle,
          sub: `${t.status} · due ${t.dueDate}`,
          kind: "Task",
          go: () => setActiveSection("tasks"),
        });
    });
    return out.slice(0, 12);
  }, [
    query,
    db,
    setActiveSection,
    setSelectedClientId,
    setSelectedProjectId,
  ]);

  const myOpenTasks = db.tasks.filter(
    (t) => t.assignedPersonId === currentUser.id && t.status !== "Completed"
  );

  const go = (section: NavigationSection) => {
    setSelectedClientId(null);
    setSelectedProjectId(null);
    setActiveSection(section);
    setMobileOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading Twofold Studio
          OS…
        </div>
      </div>
    );
  }

  if (!isAuthenticated || previewLanding) {
    return (
      <div className="relative">
        {isAuthenticated && previewLanding && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              type="button"
              onClick={() => setPreviewLanding(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-lg hover:opacity-90 transition"
            >
              Return to Live Workspace →
            </button>
          </div>
        )}
        <InteractiveLandingPage
          onOpenSignIn={() => setPreviewLanding(false)}
        />
      </div>
    );
  }

  const navItems = NAV.filter((n) => !n.perm || permissions[n.perm]);

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <DashboardView
            onQuickCreate={(t) =>
              go(
                (
                  {
                    lead: "leads",
                    outreach: "outreach",
                    call: "calls",
                    client: "clients",
                    project: "projects",
                    task: "tasks",
                    invoice: "finance",
                  } as const
                )[t]
              )
            }
          />
        );
      case "leads":
        return <LeadsCrmView />;
      case "outreach":
        return <OutreachManagerView />;
      case "prospecting":
        return <ProspectingView />;
      case "calls":
        return <ColdCallsView />;
      case "clients":
        return <ClientsView />;
      case "projects":
        return <ProjectsView />;
      case "tasks":
        return <TasksView />;
      case "calendar":
        return <CalendarView />;
      case "finance":
        return <FinanceView />;
      case "documents":
        return <DocumentsView />;
      case "templates":
        return <TemplatesView />;
      case "analytics":
        return <AnalyticsView />;
      case "team":
        return <TeamView />;
      case "settings":
        return <SettingsView />;
    }
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200/80 dark:border-neutral-800 transition-all ${
        mobile ? "w-64" : collapsed ? "w-[60px]" : "w-60"
      }`}
    >
      <div className="h-14 flex items-center gap-2.5 px-3.5 border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-xs font-semibold shrink-0">
          {db.settings.logoText || "TF"}
        </div>
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {db.settings.agencyName}
            </div>
            <div className="text-[10px] text-neutral-400">Agency OS</div>
          </div>
        )}
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((n) => {
          const Icon = n.icon;
          const active = activeSection === n.key;
          const badge =
            n.key === "tasks"
              ? db.tasks.filter(
                  (t) => t.status !== "Completed" && t.dueDate < todayStr
                ).length
              : n.key === "leads"
              ? db.leads.filter((l) => l.status === "New").length
              : 0;
          return (
            <button
              key={n.key}
              type="button"
              title={collapsed && !mobile ? n.label : undefined}
              onClick={() => go(n.key)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition ${
                active
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(!collapsed || mobile) && (
                <span className="flex-1 text-left truncate">{n.label}</span>
              )}
              {(!collapsed || mobile) && badge > 0 && (
                <span className="text-[10px] px-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {!mobile && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 text-xs"
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronsLeft className="w-4 h-4" /> Collapse
            </>
          )}
        </button>
      )}
    </aside>
  );

  return (
    <div className="h-screen flex bg-[#FAFAFA] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <Sidebar mobile />
          <div
            className="flex-1 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Global search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Search leads, clients, projects, tasks…"
              className="w-full pl-8 pr-12 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
            <kbd className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded px-1">
              Ctrl K
            </kbd>
            {searchFocused && query.trim().length >= 2 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-xs text-neutral-400">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  searchResults.map((r) => (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      onMouseDown={() => {
                        r.go();
                        setQuery("");
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.label}</div>
                        <div className="text-[11px] text-neutral-400 truncate">
                          {r.sub}
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 shrink-0">
                        {r.kind}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Realtime Live Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-500 ml-auto">
            <Radio
              className={`w-3.5 h-3.5 ${
                isRealtimeConnected ? "text-emerald-500" : "text-neutral-400"
              }`}
            />
            <span>{isRealtimeConnected ? "Realtime Live" : "Syncing"}</span>
          </div>

          <div className="hidden lg:block text-xs text-neutral-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>

          <div className="flex items-center gap-1 ml-auto lg:ml-2">
            <button
              type="button"
              onClick={() => go("tasks")}
              title="My open tasks"
              className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <CheckSquare className="w-4 h-4" />
              {myOpenTasks.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center">
                  {myOpenTasks.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              title="Activity log"
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <Activity className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setQuickOpen(false);
                  setProfileOpen(false);
                }}
                className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-[360px] max-w-[90vw] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-50">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-xs font-semibold">
                      Database Notifications
                    </span>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[11px] text-neutral-500 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {liveAlerts.length > 0 && (
                      <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        Needs attention
                      </div>
                    )}
                    {liveAlerts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          go(a.section);
                          setNotifOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="font-medium truncate">{a.title}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 pl-3.5">
                          {a.type} · {a.message}
                        </div>
                      </button>
                    ))}
                    <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      Recent
                    </div>
                    {visibleStored.length === 0 && (
                      <div className="px-4 py-3 text-xs text-neutral-400">
                        No notifications.
                      </div>
                    )}
                    {visibleStored.slice(0, 20).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.section) go(n.section);
                          setNotifOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              n.isRead
                                ? "bg-transparent"
                                : "bg-neutral-900 dark:bg-white"
                            }`}
                          />
                          <span
                            className={`truncate ${
                              n.isRead ? "text-neutral-500" : "font-medium"
                            }`}
                          >
                            {n.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 pl-3.5 line-clamp-2">
                          {n.message}
                        </div>
                        <div className="text-[10px] text-neutral-400 pl-3.5">
                          {n.createdAt}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick add */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setQuickOpen((o) => !o);
                  setNotifOpen(false);
                  setProfileOpen(false);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              >
                <Plus className="w-3.5 h-3.5" />{" "}
                <span className="hidden sm:inline">New</span>
              </button>
              {quickOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-50 py-1 text-xs">
                  {(
                    [
                      ["leads", "Lead"],
                      ["outreach", "Outreach / Campaign"],
                      ["calls", "Cold Call"],
                      ["clients", "Client"],
                      ["projects", "Project"],
                      ["tasks", "Task"],
                      ...(permissions.finance
                        ? [["finance", "Invoice / Expense"]]
                        : []),
                      ["documents", "Document"],
                      ["templates", "Template"],
                    ] as [NavigationSection, string][]
                  ).map(([s, l]) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        go(s);
                        setQuickOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      New {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle theme"
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Authenticated User Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                  setQuickOpen(false);
                }}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="w-7 h-7 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-[10px] font-semibold">
                  {currentUser.avatarInitials}
                </span>
                <span className="hidden xl:block text-left">
                  <span className="block text-xs font-medium leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="block text-[10px] text-neutral-400 leading-tight">
                    {currentUser.role}
                  </span>
                </span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-50 text-xs">
                  <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="font-semibold">{currentUser.name}</div>
                    <div className="text-neutral-400">{currentUser.email}</div>
                    <div className="mt-1 inline-block px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium">
                      Role: {currentUser.role}
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewLanding(true);
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <LayoutTemplate className="w-3.5 h-3.5" /> Interactive
                      Landing Page
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        go("settings");
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5" /> Account &amp;
                      Integrations
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileOpen(false);
                        await logout();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 text-red-600"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out of Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1500px] mx-auto p-4 sm:p-6">
            {renderSection()}
          </div>
        </main>
      </div>

      {/* Activity log drawer */}
      {activityOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex justify-end"
          onClick={() => setActivityOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-neutral-900 h-full overflow-y-auto border-l border-neutral-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-semibold">Activity Audit Log</h2>
                <p className="text-[11px] text-neutral-500">
                  Server-recorded audit trail of all workspace operations
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivityOpen(false)}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {db.activityLog.length === 0 && (
                <p className="text-xs text-neutral-400">No activity yet.</p>
              )}
              {db.activityLog.map((a) => (
                <div key={a.id} className="flex gap-3 text-xs">
                  <span className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {a.actorName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <div>
                      <span className="font-semibold">{a.actorName}</span>{" "}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          a.action === "deleted"
                            ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : a.action === "completed" ||
                              a.action === "converted"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-neutral-100 dark:bg-neutral-800"
                        }`}
                      >
                        {a.action}
                      </span>{" "}
                      <span className="text-neutral-500">{a.entityType}</span>{" "}
                      <span className="font-medium">{a.entityName}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {a.details}
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {a.createdAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
