"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  CONNECTED_CALL_OUTCOMES,
  convertCurrency,
  formatCurrency,
  POSITIVE_OUTREACH_STATUSES,
  REPLIED_OUTREACH_STATUSES,
} from "@/lib/constants";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  DollarSign,
  FolderKanban,
  Phone,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type DashboardPeriod =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "thisMonth"
  | "lastMonth"
  | "allTime"
  | "custom";

function computePeriodBounds(
  period: DashboardPeriod,
  customFrom: string,
  customTo: string
): { from: string; to: string; label: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000)
    .toISOString()
    .slice(0, 10);

  switch (period) {
    case "today":
      return { from: today, to: today, label: `Today (${today})` };
    case "yesterday":
      return {
        from: yesterday,
        to: yesterday,
        label: `Yesterday (${yesterday})`,
      };
    case "7d": {
      const from = new Date(now.getTime() - 6 * 86400000)
        .toISOString()
        .slice(0, 10);
      return { from, to: today, label: `Last 7 Days (${from} → ${today})` };
    }
    case "30d": {
      const from = new Date(now.getTime() - 29 * 86400000)
        .toISOString()
        .slice(0, 10);
      return { from, to: today, label: `Last 30 Days (${from} → ${today})` };
    }
    case "thisMonth": {
      const from = `${today.slice(0, 7)}-01`;
      return { from, to: today, label: `This Month (${from} → ${today})` };
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .slice(0, 10);
      return { from: first, to: last, label: `Last Month (${first} → ${last})` };
    }
    case "custom":
      return {
        from: customFrom || "1970-01-01",
        to: customTo || today,
        label: `Custom (${customFrom || "Start"} → ${customTo || today})`,
      };
    case "allTime":
    default:
      return {
        from: "1970-01-01",
        to: "2099-12-31",
        label: "All Time (Actual Database Records)",
      };
  }
}

export function DashboardView({
  onQuickCreate,
}: {
  onQuickCreate: (
    type:
      | "lead"
      | "outreach"
      | "call"
      | "client"
      | "project"
      | "task"
      | "invoice"
  ) => void;
}) {
  const {
    db,
    permissions,
    setActiveSection,
    setSelectedClientId,
    setSelectedProjectId,
    updateTask,
    updateSettings,
    purgeDemoRecords,
  } = useAgency();

  const defaultCurrency = db.settings.defaultCurrency;
  const includeDemo = db.settings.includeDemoDataInAnalytics ?? true;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [period, setPeriod] = useState<DashboardPeriod>("allTime");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const bounds = useMemo(
    () => computePeriodBounds(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  // Filter records by Demo toggle & Date Period (Part 12 & Part 14)
  const scopedData = useMemo(() => {
    const filterDemo = <T extends { isDemo?: boolean }>(arr: T[]) =>
      includeDemo ? arr : arr.filter((x) => !x.isDemo);

    const allLeads = filterDemo(db.leads);
    const allOutreach = filterDemo(db.outreach);
    const allCalls = filterDemo(db.coldCalls || []);
    const allClients = filterDemo(db.clients);
    const allProjects = filterDemo(db.projects);
    const allTasks = filterDemo(db.tasks);
    const allFinance = filterDemo(db.finance);

    const inPeriod = (dateStr?: string) => {
      if (!dateStr) return period === "allTime";
      const d = dateStr.slice(0, 10);
      return d >= bounds.from && d <= bounds.to;
    };

    const periodLeads = allLeads.filter((l) => inPeriod(l.dateAdded));
    const periodOutreach = allOutreach.filter((o) =>
      inPeriod(o.dateSent || o.occurredAt)
    );
    const periodCalls = allCalls.filter((c) => inPeriod(c.callDate));
    const periodFinance = allFinance.filter((f) =>
      inPeriod(f.paymentDate || f.dueDate)
    );

    return {
      allLeads,
      allProjects,
      allClients,
      allTasks,
      periodLeads,
      periodOutreach,
      periodCalls,
      periodFinance,
      demoLeadCount: db.leads.filter((l) => l.isDemo).length,
    };
  }, [db, includeDemo, bounds, period]);

  // All 16 Required Database-Driven Dashboard KPIs (Part 12)
  const kpis = useMemo(() => {
    const {
      allLeads,
      allProjects,
      periodLeads,
      periodOutreach,
      periodCalls,
      periodFinance,
    } = scopedData;

    const contactedStatuses = new Set([
      "Contacted",
      "Replied",
      "Interested",
      "Meeting Scheduled",
      "Proposal Sent",
      "Converted",
    ]);

    const totalLeads = allLeads.length;
    const newLeads = periodLeads.length;
    const leadsContacted = periodLeads.filter((l) =>
      contactedStatuses.has(l.status)
    ).length;

    const outboundOutreach = periodOutreach.filter(
      (o) => o.direction !== "Inbound"
    );
    const totalOutreachActivities =
      periodOutreach.length + periodCalls.length;

    const emailsSent = outboundOutreach.filter(
      (o) => o.communicationChannel === "Cold Emails"
    ).length;
    const emailsDelivered = outboundOutreach.filter(
      (o) =>
        o.communicationChannel === "Cold Emails" &&
        (o.deliveryStatus === "delivered" || o.deliveryStatus === "read")
    ).length;

    const callsMade = periodCalls.length;
    const callsConnected = periodCalls.filter((c) =>
      CONNECTED_CALL_OUTCOMES.has(c.outcome)
    ).length;

    const igDms = outboundOutreach.filter(
      (o) => o.communicationChannel === "Instagram DMs"
    );
    const igDmsManual = igDms.filter((o) => o.source !== "api").length;
    const igDmsApi = igDms.filter((o) => o.source === "api").length;

    const waMsgs = outboundOutreach.filter(
      (o) => o.communicationChannel === "WhatsApp Messages"
    );
    const waManual = waMsgs.filter((o) => o.source !== "api").length;
    const waApi = waMsgs.filter((o) => o.source === "api").length;

    // Deduplicate replies by leadId + channel so the same reply is never counted twice
    const uniqueReplyKeys = new Set<string>();
    let repliesReceived = 0;
    for (const o of periodOutreach) {
      if (
        o.direction === "Inbound" ||
        REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
      ) {
        const key = `${o.leadId || o.leadName}:${o.communicationChannel}:${
          o.providerThreadId || o.id
        }`;
        if (!uniqueReplyKeys.has(key)) {
          uniqueReplyKeys.add(key);
          repliesReceived++;
        }
      }
    }

    const positiveReplies = periodOutreach.filter((o) =>
      POSITIVE_OUTREACH_STATUSES.has(o.replyStatus)
    ).length;

    const meetingsBooked =
      periodOutreach.filter(
        (o) =>
          o.replyStatus === "Meeting Booked" || o.replyStatus === "Converted"
      ).length +
      periodCalls.filter(
        (c) => c.outcome === "Meeting Booked" || c.outcome === "Converted"
      ).length;

    const convertedClients = periodLeads.filter(
      (l) => l.status === "Converted"
    ).length;

    const invoices = periodFinance.filter(
      (f) => f.transactionType !== "Expense"
    );
    const expenses = periodFinance.filter(
      (f) => f.transactionType === "Expense"
    );

    const totalRevenueInvoiced = invoices.reduce(
      (s, f) => s + convertCurrency(f.amount, f.currency, defaultCurrency),
      0
    );
    const receivedPayments = invoices.reduce(
      (s, f) => s + convertCurrency(f.paidAmount, f.currency, defaultCurrency),
      0
    );
    const pendingPayments = invoices
      .filter(
        (f) => f.paymentStatus !== "Paid" && f.paymentStatus !== "Refunded"
      )
      .reduce(
        (s, f) =>
          s +
          convertCurrency(
            Math.max(0, f.amount - f.paidAmount),
            f.currency,
            defaultCurrency
          ),
        0
      );
    const totalExpenses = expenses.reduce(
      (s, f) => s + convertCurrency(f.amount, f.currency, defaultCurrency),
      0
    );

    const activeProjects = allProjects.filter(
      (p) => p.projectStatus !== "Completed"
    ).length;

    return {
      totalLeads,
      newLeads,
      leadsContacted,
      totalOutreachActivities,
      emailsSent,
      emailsDelivered,
      callsMade,
      callsConnected,
      instagramDmsTotal: igDms.length,
      igDmsManual,
      igDmsApi,
      whatsappTotal: waMsgs.length,
      waManual,
      waApi,
      repliesReceived,
      positiveReplies,
      meetingsBooked,
      convertedClients,
      totalRevenueInvoiced,
      receivedPayments,
      pendingPayments,
      totalExpenses,
      netProfit: receivedPayments - totalExpenses,
      activeProjects,
    };
  }, [scopedData, defaultCurrency]);

  // Strict Database-Only Monthly Finance Series (Zero fictional fallback numbers!)
  const monthlyFinanceSeries = useMemo(() => {
    const monthBuckets = new Map<
      string,
      { Invoiced: number; Received: number; Expenses: number }
    >();

    for (const f of scopedData.periodFinance) {
      const d = (f.paymentDate || f.dueDate || "").slice(0, 7);
      if (!d) continue;
      const cur = monthBuckets.get(d) || {
        Invoiced: 0,
        Received: 0,
        Expenses: 0,
      };
      if (f.transactionType === "Expense") {
        cur.Expenses += convertCurrency(f.amount, f.currency, defaultCurrency);
      } else {
        cur.Invoiced += convertCurrency(f.amount, f.currency, defaultCurrency);
        cur.Received += convertCurrency(
          f.paidAmount,
          f.currency,
          defaultCurrency
        );
      }
      monthBuckets.set(d, cur);
    }

    return Array.from(monthBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month,
        Invoiced: Math.round(vals.Invoiced),
        Received: Math.round(vals.Received),
        Expenses: Math.round(vals.Expenses),
        Profit: Math.round(vals.Received - vals.Expenses),
      }));
  }, [scopedData.periodFinance, defaultCurrency]);

  // Lead Funnel computed strictly from database records
  const leadFunnel = useMemo(() => {
    return [
      { stage: "New Leads", count: kpis.newLeads },
      { stage: "Contacted", count: kpis.leadsContacted },
      { stage: "Replies", count: kpis.repliesReceived },
      { stage: "Positive", count: kpis.positiveReplies },
      { stage: "Meetings", count: kpis.meetingsBooked },
      { stage: "Converted", count: kpis.convertedClients },
    ];
  }, [kpis]);

  const todaysTasks = useMemo(
    () =>
      scopedData.allTasks.filter(
        (t) => t.status !== "Completed" && t.dueDate <= todayStr
      ),
    [scopedData.allTasks, todayStr]
  );

  const followUpsDueToday = useMemo(
    () =>
      scopedData.allLeads.filter(
        (l) =>
          l.status !== "Converted" &&
          l.status !== "Lost" &&
          l.nextFollowUpDate &&
          l.nextFollowUpDate <= todayStr
      ),
    [scopedData.allLeads, todayStr]
  );

  return (
    <div className="space-y-6">
      {/* Header + Quick Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Executive Agency Operating Dashboard
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Period: <strong>{bounds.label}</strong> · 100% database-driven calculations (0 fictional numbers).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onQuickCreate("lead")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 transition"
          >
            <Plus className="w-3.5 h-3.5" /> New Lead
          </button>
          <button
            onClick={() => onQuickCreate("outreach")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
          >
            <Send className="w-3.5 h-3.5" /> Log Outreach
          </button>
          <button
            onClick={() => onQuickCreate("call")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
          >
            <Phone className="w-3.5 h-3.5" /> Log Cold Call
          </button>
          <button
            onClick={() => onQuickCreate("project")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
          >
            <FolderKanban className="w-3.5 h-3.5" /> New Project
          </button>
          {permissions.finance && (
            <button
              onClick={() => onQuickCreate("invoice")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
            >
              <DollarSign className="w-3.5 h-3.5" /> Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Period Filter Bar + Demo Data Toggle / Purge */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["7d", "Last 7 Days"],
              ["30d", "Last 30 Days"],
              ["thisMonth", "This Month"],
              ["lastMonth", "Last Month"],
              ["allTime", "All Time"],
              ["custom", "Custom Range"],
            ] as [DashboardPeriod, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                period === key
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800"
              />
              <span>→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800"
              />
            </div>
          )}
        </div>

        {/* Part 14 Demo Data Control */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-neutral-600 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) =>
                updateSettings({
                  includeDemoDataInAnalytics: e.target.checked,
                })
              }
            />
            <span>Include Seeded DEMO Records</span>
          </label>
          {scopedData.demoLeadCount > 0 && permissions.deleteRecords && (
            <button
              type="button"
              onClick={purgeDemoRecords}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-medium hover:bg-amber-100"
              title="Permanently remove all seeded DEMO records while keeping your real records"
            >
              <Trash2 className="w-3 h-3" /> Purge DEMO Data
            </button>
          )}
        </div>
      </div>

      {/* 16 Required Database-Driven Dashboard KPI Cards with Period & Calculation Definitions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          {
            label: "1. Total Leads",
            value: String(kpis.totalLeads),
            def: "Count of all CRM lead records",
            onClick: () => setActiveSection("leads"),
          },
          {
            label: "2. New Leads",
            value: String(kpis.newLeads),
            def: `Added in period (${bounds.from.slice(5)}→${bounds.to.slice(5)})`,
            onClick: () => setActiveSection("leads"),
          },
          {
            label: "3. Leads Contacted",
            value: String(kpis.leadsContacted),
            def: "Leads with status ≥ Contacted",
            onClick: () => setActiveSection("leads"),
          },
          {
            label: "4. Outreach Activities",
            value: String(kpis.totalOutreachActivities),
            def: "Messages + Cold Calls in period",
            onClick: () => setActiveSection("outreach"),
          },
          {
            label: "5. Emails Sent",
            value: String(kpis.emailsSent),
            def: `${kpis.emailsDelivered} confirmed delivered`,
            onClick: () => setActiveSection("outreach"),
          },
          {
            label: "6. Calls Made",
            value: String(kpis.callsMade),
            def: `${kpis.callsConnected} connected calls`,
            onClick: () => setActiveSection("calls"),
          },
          {
            label: "7. Instagram DMs",
            value: String(kpis.instagramDmsTotal),
            def: `${kpis.igDmsManual} manual / ${kpis.igDmsApi} API`,
            onClick: () => setActiveSection("outreach"),
          },
          {
            label: "8. WhatsApp Logged",
            value: String(kpis.whatsappTotal),
            def: `${kpis.waManual} manual / ${kpis.waApi} API`,
            onClick: () => setActiveSection("outreach"),
          },
          {
            label: "9. Replies Received",
            value: String(kpis.repliesReceived),
            def: "Deduplicated prospect replies",
            onClick: () => setActiveSection("outreach"),
          },
          {
            label: "10. Positive Replies",
            value: String(kpis.positiveReplies),
            def: "Interested / Demo / Booked",
            onClick: () => setActiveSection("outreach"),
          },
          {
            label: "11. Meetings Booked",
            value: String(kpis.meetingsBooked),
            def: "Outreach + Call meetings booked",
            onClick: () => setActiveSection("calendar"),
          },
          {
            label: "12. Converted Clients",
            value: String(kpis.convertedClients),
            def: "Leads converted to clients",
            onClick: () => setActiveSection("clients"),
          },
          {
            label: "13. Total Invoiced",
            value: permissions.finance
              ? formatCurrency(kpis.totalRevenueInvoiced, defaultCurrency)
              : "Restricted",
            def: "Gross invoice amount issued",
            onClick: () => permissions.finance && setActiveSection("finance"),
          },
          {
            label: "14. Received Payments",
            value: permissions.finance
              ? formatCurrency(kpis.receivedPayments, defaultCurrency)
              : "Restricted",
            def: "Actual cash payments collected",
            onClick: () => permissions.finance && setActiveSection("finance"),
          },
          {
            label: "15. Pending Payments",
            value: permissions.finance
              ? formatCurrency(kpis.pendingPayments, defaultCurrency)
              : "Restricted",
            def: "Invoiced minus paid amount",
            onClick: () => permissions.finance && setActiveSection("finance"),
          },
          {
            label: "16. Active Projects",
            value: String(kpis.activeProjects),
            def: "Projects with status ≠ Completed",
            onClick: () => setActiveSection("projects"),
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className="text-left bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 hover:border-neutral-400 transition flex flex-col justify-between"
          >
            <div className="text-[11px] font-medium text-neutral-500 truncate">
              {card.label}
            </div>
            <div className="text-lg font-semibold tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">
              {card.value}
            </div>
            <div className="text-[10px] text-neutral-400 truncate mt-0.5">
              {card.def}
            </div>
          </button>
        ))}
      </div>

      {/* Charts Row: Revenue Invoiced vs Received vs Expenses + Lead Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold">
                Invoiced Revenue vs. Received Payments &amp; Expenses
              </h2>
              <p className="text-xs text-neutral-500">
                Computed strictly from database invoices &amp; payments in{" "}
                {defaultCurrency}
              </p>
            </div>
          </div>

          {!permissions.finance ? (
            <div className="h-60 flex items-center justify-center text-xs text-neutral-400">
              Financial telemetry is restricted for the Team Member role.
            </div>
          ) : monthlyFinanceSeries.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
              0 financial transactions in selected period ({bounds.label}).
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyFinanceSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e5e5"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #e5e5e5",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="Invoiced"
                    stroke="#737373"
                    strokeWidth={1.5}
                    fillOpacity={0.08}
                    fill="#737373"
                  />
                  <Area
                    type="monotone"
                    dataKey="Received"
                    stroke="#171717"
                    strokeWidth={2}
                    fillOpacity={0.14}
                    fill="#171717"
                  />
                  <Area
                    type="monotone"
                    dataKey="Profit"
                    stroke="#059669"
                    strokeWidth={2}
                    fillOpacity={0.14}
                    fill="#059669"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Pipeline &amp; Outreach Conversion Funnel
            </h2>
            <p className="text-xs text-neutral-500 mb-3">
              New Leads → Contacted → Replies → Positive → Meetings → Converted
            </p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadFunnel} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e5e5e5"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={82}
                    tick={{ fontSize: 11, fill: "#525252" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e5e5",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Records"
                    fill="#171717"
                    radius={[0, 6, 6, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-neutral-500" />
              Today&apos;s &amp; Overdue Tasks ({todaysTasks.length})
            </h2>
            <button
              onClick={() => setActiveSection("tasks")}
              className="text-xs text-neutral-500 hover:underline"
            >
              All Tasks →
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {todaysTasks.length === 0 ? (
              <p className="text-neutral-400 py-4 text-center">
                0 pending tasks due today.
              </p>
            ) : (
              todaysTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-neutral-200/60 dark:border-neutral-800"
                >
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={task.status === "Completed"}
                      onChange={() =>
                        updateTask(task.id, {
                          status:
                            task.status === "Completed" ? "To Do" : "Completed",
                        })
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">{task.taskTitle}</div>
                      <div className="text-[11px] text-neutral-400">
                        Due {task.dueDate}
                      </div>
                    </div>
                  </label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                    {task.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Follow-ups Due Today & Recent Clients */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Follow-ups Due ({followUpsDueToday.length})
              </h2>
              <button
                onClick={() => setActiveSection("leads")}
                className="text-xs text-neutral-500 hover:underline"
              >
                CRM →
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {followUpsDueToday.slice(0, 4).map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setActiveSection("leads")}
                  className="cursor-pointer p-2.5 rounded-lg border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">{lead.businessName}</div>
                    <div className="text-[11px] text-neutral-500">
                      {lead.contactPerson} · {lead.status}
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    {lead.nextFollowUpDate}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Recent Active Clients
            </h3>
            <div className="space-y-1.5 text-xs">
              {scopedData.allClients.slice(0, 3).map((client) => (
                <div
                  key={client.id}
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setActiveSection("clients");
                  }}
                  className="flex items-center justify-between py-1 cursor-pointer hover:underline"
                >
                  <span className="font-medium">{client.businessName}</span>
                  <span className="text-neutral-500">
                    {permissions.finance
                      ? formatCurrency(
                          client.totalProjectValue,
                          defaultCurrency
                        )
                      : client.paymentStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Studio Activity Feed */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-neutral-500" />
              Live Multi-User Activity Feed
            </h2>
            <span className="text-[11px] text-neutral-400">Audit Trail</span>
          </div>
          <div className="space-y-2.5 text-xs">
            {db.activityLog.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="pb-2 border-b border-neutral-100 dark:border-neutral-800 last:border-none"
              >
                <div>
                  <span className="font-semibold">{item.actorName}</span>{" "}
                  <span className="text-neutral-500">{item.action}</span>{" "}
                  <span className="font-medium">{item.entityName}</span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate">
                  {item.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
