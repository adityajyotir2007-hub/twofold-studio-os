"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  CONNECTED_CALL_OUTCOMES,
  convertCurrency,
  formatCurrency,
  LEAD_SOURCES,
  OUTREACH_CHANNELS,
  POSITIVE_OUTREACH_STATUSES,
  REPLIED_OUTREACH_STATUSES,
} from "@/lib/constants";
import { Download, Info } from "lucide-react";

type PeriodKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "thisMonth"
  | "lastMonth"
  | "allTime"
  | "custom";

function getBounds(key: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  switch (key) {
    case "today":
      return { from: today, to: today, label: `Today (${today})` };
    case "yesterday":
      return {
        from: yesterday,
        to: yesterday,
        label: `Yesterday (${yesterday})`,
      };
    case "7d":
      return {
        from: new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10),
        to: today,
        label: "Last 7 Days",
      };
    case "30d":
      return {
        from: new Date(now.getTime() - 29 * 86400000)
          .toISOString()
          .slice(0, 10),
        to: today,
        label: "Last 30 Days",
      };
    case "thisMonth":
      return {
        from: `${today.slice(0, 7)}-01`,
        to: today,
        label: "This Month",
      };
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .slice(0, 10);
      return { from: first, to: last, label: "Last Month" };
    }
    case "custom":
      return {
        from: customFrom || "1970-01-01",
        to: customTo || today,
        label: "Custom Date Range",
      };
    case "allTime":
    default:
      return {
        from: "1970-01-01",
        to: "2099-12-31",
        label: "All Time",
      };
  }
}

export function AnalyticsView() {
  const { db, permissions, updateSettings } = useAgency();
  const cur = db.settings.defaultCurrency;
  const includeDemo = db.settings.includeDemoDataInAnalytics ?? true;

  const [period, setPeriod] = useState<PeriodKey>("allTime");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const bounds = useMemo(
    () => getBounds(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  // Compute all 6 required breakdowns strictly from actual database records (Part 12)
  const report = useMemo(() => {
    const filterDemo = <T extends { isDemo?: boolean }>(arr: T[]) =>
      includeDemo ? arr : arr.filter((x) => !x.isDemo);

    const inRange = (d?: string) => {
      if (!d) return period === "allTime";
      const iso = d.slice(0, 10);
      return iso >= bounds.from && iso <= bounds.to;
    };

    const leads = filterDemo(db.leads).filter((l) => inRange(l.dateAdded));
    const outreach = filterDemo(db.outreach).filter((o) =>
      inRange(o.dateSent || o.occurredAt)
    );
    const calls = filterDemo(db.coldCalls || []).filter((c) =>
      inRange(c.callDate)
    );
    const finance = filterDemo(db.finance).filter((f) =>
      inRange(f.paymentDate || f.dueDate)
    );

    // 1. Breakdown by Team Member
    const byTeamMember = db.teamMembers.map((m) => {
      const mLeads = leads.filter((l) => l.assignedTeamMemberId === m.id);
      const mOutreach = outreach.filter((o) => o.memberId === m.id);
      const mCalls = calls.filter((c) => c.callingTeamMemberId === m.id);
      const mConnected = mCalls.filter((c) =>
        CONNECTED_CALL_OUTCOMES.has(c.outcome)
      ).length;
      const mReplies = mOutreach.filter((o) =>
        REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
      ).length;
      const mConverted = mLeads.filter((l) => l.status === "Converted").length;
      return {
        name: m.name,
        role: m.role,
        leads: mLeads.length,
        outreachSent: mOutreach.filter((o) => o.direction !== "Inbound").length,
        callsAttempted: mCalls.length,
        callsConnected: mConnected,
        replies: mReplies,
        converted: mConverted,
      };
    });

    // 2. Breakdown by Communication Channel (distinguishing Sent vs Delivered, Manual vs API, Attempted vs Connected)
    const byChannel = [
      ...OUTREACH_CHANNELS.map((ch) => {
        const items = outreach.filter((o) => o.communicationChannel === ch);
        const outbound = items.filter((o) => o.direction !== "Inbound");
        const manual = outbound.filter((o) => o.source !== "api").length;
        const api = outbound.filter((o) => o.source === "api").length;
        const delivered = outbound.filter(
          (o) => o.deliveryStatus === "delivered" || o.deliveryStatus === "read"
        ).length;
        const replies = items.filter((o) =>
          REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
        ).length;
        const positive = items.filter((o) =>
          POSITIVE_OUTREACH_STATUSES.has(o.replyStatus)
        ).length;
        return {
          channel: ch,
          sentOrAttempted: outbound.length,
          deliveredOrConnected: delivered,
          manualCount: manual,
          apiCount: api,
          replies,
          positive,
        };
      }),
      {
        channel: "Cold Calling",
        sentOrAttempted: calls.length,
        deliveredOrConnected: calls.filter((c) =>
          CONNECTED_CALL_OUTCOMES.has(c.outcome)
        ).length,
        manualCount: calls.filter((c) => c.source !== "api").length,
        apiCount: calls.filter((c) => c.source === "api").length,
        replies: calls.filter((c) => CONNECTED_CALL_OUTCOMES.has(c.outcome))
          .length,
        positive: calls.filter(
          (c) =>
            c.outcome === "Interested" ||
            c.outcome === "Meeting Booked" ||
            c.outcome === "Converted"
        ).length,
      },
    ];

    // 3. Breakdown by Campaign
    const byCampaign = filterDemo(db.campaigns || []).map((camp) => {
      const leadSet = new Set(camp.leadIds);
      const cOut = outreach.filter(
        (o) => o.campaignId === camp.id || leadSet.has(o.leadId)
      );
      const cCalls = calls.filter(
        (c) => c.campaignId === camp.id || leadSet.has(c.leadId)
      );
      return {
        name: camp.name,
        status: camp.status,
        prospects: camp.leadIds.length,
        emails: cOut.filter((o) => o.communicationChannel === "Cold Emails")
          .length,
        calls: cCalls.length,
        dms: cOut.filter(
          (o) =>
            o.communicationChannel === "Instagram DMs" ||
            o.communicationChannel === "WhatsApp Messages"
        ).length,
        replies: cOut.filter((o) =>
          REPLIED_OUTREACH_STATUSES.has(o.replyStatus)
        ).length,
        meetings:
          cOut.filter((o) => o.replyStatus === "Meeting Booked").length +
          cCalls.filter((c) => c.outcome === "Meeting Booked").length,
      };
    });

    // 4. Breakdown by Industry
    const indMap = new Map<
      string,
      { leads: number; converted: number; pipelineValue: number }
    >();
    for (const l of leads) {
      const row = indMap.get(l.industry) || {
        leads: 0,
        converted: 0,
        pipelineValue: 0,
      };
      row.leads++;
      if (l.status === "Converted") row.converted++;
      row.pipelineValue += l.estimatedProjectValue;
      indMap.set(l.industry, row);
    }
    const byIndustry = Array.from(indMap.entries()).map(([industry, v]) => ({
      industry,
      ...v,
    }));

    // 5. Breakdown by Country
    const countryMap = new Map<
      string,
      { leads: number; converted: number; invoiced: number; received: number }
    >();
    for (const l of leads) {
      const row = countryMap.get(l.country) || {
        leads: 0,
        converted: 0,
        invoiced: 0,
        received: 0,
      };
      row.leads++;
      if (l.status === "Converted") row.converted++;
      countryMap.set(l.country, row);
    }
    for (const f of finance) {
      if (f.transactionType === "Expense") continue;
      const client = db.clients.find((c) => c.id === f.clientId);
      const country = client?.country || "Unspecified";
      const row = countryMap.get(country) || {
        leads: 0,
        converted: 0,
        invoiced: 0,
        received: 0,
      };
      row.invoiced += convertCurrency(f.amount, f.currency, cur);
      row.received += convertCurrency(f.paidAmount, f.currency, cur);
      countryMap.set(country, row);
    }
    const byCountry = Array.from(countryMap.entries()).map(([country, v]) => ({
      country,
      ...v,
    }));

    // 6. Breakdown by Lead Source
    const byLeadSource = LEAD_SOURCES.map((source) => {
      const sLeads = leads.filter((l) => l.leadSource === source);
      return {
        source,
        leads: sLeads.length,
        contacted: sLeads.filter((l) => l.status !== "New").length,
        converted: sLeads.filter((l) => l.status === "Converted").length,
        pipelineValue: sLeads.reduce(
          (s, l) => s + l.estimatedProjectValue,
          0
        ),
      };
    });

    return {
      byTeamMember,
      byChannel,
      byCampaign,
      byIndustry,
      byCountry,
      byLeadSource,
    };
  }, [db, includeDemo, bounds, period, cur]);

  const handleDownloadCsv = () => {
    const lines: string[] = [
      `Twofold Studio OS — Verified Database Analytics Report`,
      `Period,${bounds.label} (${bounds.from} to ${bounds.to})`,
      `Include Demo Records,${includeDemo}`,
      "",
      "--- BREAKDOWN BY COMMUNICATION CHANNEL ---",
      "Channel,Outbound Sent/Attempted,Delivered/Connected,Manual Logs,API Synced,Replies,Positive Replies",
      ...report.byChannel.map(
        (r) =>
          `${r.channel},${r.sentOrAttempted},${r.deliveredOrConnected},${r.manualCount},${r.apiCount},${r.replies},${r.positive}`
      ),
      "",
      "--- BREAKDOWN BY TEAM MEMBER ---",
      "Member,Role,Assigned Leads,Outreach Sent,Calls Attempted,Calls Connected,Replies,Converted",
      ...report.byTeamMember.map(
        (m) =>
          `${m.name},${m.role},${m.leads},${m.outreachSent},${m.callsAttempted},${m.callsConnected},${m.replies},${m.converted}`
      ),
      "",
      "--- BREAKDOWN BY LEAD SOURCE ---",
      "Lead Source,Total Leads,Contacted,Converted,Pipeline Value",
      ...report.byLeadSource.map(
        (s) =>
          `${s.source},${s.leads},${s.contacted},${s.converted},${s.pipelineValue}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twofold-analytics-${bounds.from}-to-${bounds.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Business Analytics &amp; Multi-Dimensional Breakdowns
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Period: <strong>{bounds.label}</strong> ({bounds.from} → {bounds.to}
            ) · Zero fictional or random numbers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) =>
                updateSettings({
                  includeDemoDataInAnalytics: e.target.checked,
                })
              }
            />
            <span>Include DEMO Records</span>
          </label>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <Download className="w-3.5 h-3.5" /> Export Verified CSV Report
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3 flex flex-wrap items-center gap-1.5 text-xs">
        {(
          [
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["7d", "Last 7 Days"],
            ["30d", "Last 30 Days"],
            ["thisMonth", "This Month"],
            ["lastMonth", "Last Month"],
            ["allTime", "All Time"],
            ["custom", "Custom Date Range"],
          ] as [PeriodKey, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPeriod(k)}
            className={`px-2.5 py-1 rounded-lg font-medium ${
              period === k
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100"
            }`}
          >
            {l}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2">
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

      {/* Analytics Integrity Rules Notice */}
      <div className="p-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
        <div>
          <strong>Analytics Calculation Rules:</strong> Sent emails are distinguished from confirmed delivered emails; calls attempted are distinguished from calls connected; manually logged DMs are distinguished from API-synchronized DMs; and invoiced revenue is distinguished from received payments.
        </div>
      </div>

      {/* 1. Breakdown by Communication Channel */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">
          1. Breakdown by Communication Channel
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                <th className="py-2 px-3">Channel</th>
                <th className="py-2 px-3">Sent / Attempted</th>
                <th className="py-2 px-3">Delivered / Connected</th>
                <th className="py-2 px-3">Manually Logged</th>
                <th className="py-2 px-3">API Synchronized</th>
                <th className="py-2 px-3">Replies Received</th>
                <th className="py-2 px-3">Positive Replies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {report.byChannel.map((row) => (
                <tr key={row.channel}>
                  <td className="py-2.5 px-3 font-semibold">{row.channel}</td>
                  <td className="py-2.5 px-3 tabular-nums">
                    {row.sentOrAttempted}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">
                    {row.deliveredOrConnected}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">
                    {row.manualCount}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">{row.apiCount}</td>
                  <td className="py-2.5 px-3 tabular-nums font-medium">
                    {row.replies}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-emerald-600 font-semibold">
                    {row.positive}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Breakdown by Team Member */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">2. Breakdown by Team Member</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                <th className="py-2 px-3">Team Member</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Assigned Leads</th>
                <th className="py-2 px-3">Outreach Sent</th>
                <th className="py-2 px-3">Calls Attempted</th>
                <th className="py-2 px-3">Calls Connected</th>
                <th className="py-2 px-3">Replies</th>
                <th className="py-2 px-3">Converted Clients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {report.byTeamMember.map((m) => (
                <tr key={m.name}>
                  <td className="py-2.5 px-3 font-semibold">{m.name}</td>
                  <td className="py-2.5 px-3">{m.role}</td>
                  <td className="py-2.5 px-3 tabular-nums">{m.leads}</td>
                  <td className="py-2.5 px-3 tabular-nums">{m.outreachSent}</td>
                  <td className="py-2.5 px-3 tabular-nums">
                    {m.callsAttempted}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">
                    {m.callsConnected}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">{m.replies}</td>
                  <td className="py-2.5 px-3 tabular-nums font-semibold text-emerald-600">
                    {m.converted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Breakdown by Campaign & 4. Breakdown by Lead Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">3. Breakdown by Campaign</h2>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                <th className="py-2 px-2">Campaign</th>
                <th className="py-2 px-2">Prospects</th>
                <th className="py-2 px-2">Emails</th>
                <th className="py-2 px-2">Calls</th>
                <th className="py-2 px-2">DMs</th>
                <th className="py-2 px-2">Replies</th>
                <th className="py-2 px-2">Meetings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {report.byCampaign.map((c) => (
                <tr key={c.name}>
                  <td className="py-2 px-2 font-semibold">{c.name}</td>
                  <td className="py-2 px-2 tabular-nums">{c.prospects}</td>
                  <td className="py-2 px-2 tabular-nums">{c.emails}</td>
                  <td className="py-2 px-2 tabular-nums">{c.calls}</td>
                  <td className="py-2 px-2 tabular-nums">{c.dms}</td>
                  <td className="py-2 px-2 tabular-nums">{c.replies}</td>
                  <td className="py-2 px-2 tabular-nums font-semibold">
                    {c.meetings}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">4. Breakdown by Lead Source</h2>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                <th className="py-2 px-2">Source</th>
                <th className="py-2 px-2">Total Leads</th>
                <th className="py-2 px-2">Contacted</th>
                <th className="py-2 px-2">Converted</th>
                <th className="py-2 px-2 text-right">Pipeline Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {report.byLeadSource.map((s) => (
                <tr key={s.source}>
                  <td className="py-2 px-2 font-semibold">{s.source}</td>
                  <td className="py-2 px-2 tabular-nums">{s.leads}</td>
                  <td className="py-2 px-2 tabular-nums">{s.contacted}</td>
                  <td className="py-2 px-2 tabular-nums">{s.converted}</td>
                  <td className="py-2 px-2 tabular-nums text-right">
                    {formatCurrency(s.pipelineValue, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Breakdown by Industry & 6. Breakdown by Country */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">5. Breakdown by Industry</h2>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                <th className="py-2 px-2">Industry</th>
                <th className="py-2 px-2">Leads</th>
                <th className="py-2 px-2">Converted</th>
                <th className="py-2 px-2 text-right">Pipeline Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {report.byIndustry.map((i) => (
                <tr key={i.industry}>
                  <td className="py-2 px-2 font-semibold">{i.industry}</td>
                  <td className="py-2 px-2 tabular-nums">{i.leads}</td>
                  <td className="py-2 px-2 tabular-nums">{i.converted}</td>
                  <td className="py-2 px-2 tabular-nums text-right">
                    {formatCurrency(i.pipelineValue, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">
            6. Breakdown by Country (Invoiced vs. Received)
          </h2>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                <th className="py-2 px-2">Country</th>
                <th className="py-2 px-2">Leads</th>
                <th className="py-2 px-2">Converted</th>
                {permissions.finance && (
                  <>
                    <th className="py-2 px-2 text-right">Invoiced</th>
                    <th className="py-2 px-2 text-right">Received Cash</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {report.byCountry.map((c) => (
                <tr key={c.country}>
                  <td className="py-2 px-2 font-semibold">{c.country}</td>
                  <td className="py-2 px-2 tabular-nums">{c.leads}</td>
                  <td className="py-2 px-2 tabular-nums">{c.converted}</td>
                  {permissions.finance && (
                    <>
                      <td className="py-2 px-2 tabular-nums text-right">
                        {formatCurrency(c.invoiced, cur)}
                      </td>
                      <td className="py-2 px-2 tabular-nums text-right font-semibold text-emerald-600">
                        {formatCurrency(c.received, cur)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
