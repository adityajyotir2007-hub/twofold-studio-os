"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { CALL_OUTCOMES, CONNECTED_CALL_OUTCOMES } from "@/lib/constants";
import { CallOutcome, ColdCallRecord } from "@/types/agency";
import {
  CheckCircle2,
  Edit3,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";

export function ColdCallsView() {
  const {
    db,
    currentUser,
    permissions,
    addColdCall,
    updateColdCall,
    deleteColdCall,
    updateTeamMember,
  } = useAgency();

  const todayStr = new Date().toISOString().slice(0, 10);
  const calls = db.coldCalls || [];
  const callingIntegration = (db.integrations || []).find(
    (i) => i.provider === "calling"
  );

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [memberFilter, setMemberFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<ColdCallRecord | null>(null);

  const emptyForm = {
    leadId: db.leads[0]?.id || "",
    businessName: db.leads[0]?.businessName || "",
    phoneNumber: db.leads[0]?.phoneNumber || "",
    callingTeamMemberId: currentUser.id,
    campaignId: db.campaigns?.[0]?.id || "",
    callDate: todayStr,
    callTime: new Date().toTimeString().slice(0, 5),
    durationMinutes: "",
    durationSecondsPart: "",
    outcome: "Interested" as CallOutcome,
    notes: "",
    followUpDate: new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 10),
    nextAction: "",
    recordingConsent: false,
    recordingUrl: "",
  };
  const [formState, setFormState] = useState(emptyForm);

  // Analytics: Attempted vs Connected vs Meetings Booked vs Conversions + Per-Member Targets
  const stats = useMemo(() => {
    const totalAttempted = calls.length;
    const connectedCalls = calls.filter((c) =>
      CONNECTED_CALL_OUTCOMES.has(c.outcome)
    ).length;
    const connectRate =
      totalAttempted > 0
        ? Math.round((connectedCalls / totalAttempted) * 1000) / 10
        : 0;
    const meetingsBooked = calls.filter(
      (c) => c.outcome === "Meeting Booked" || c.outcome === "Converted"
    ).length;
    const converted = calls.filter((c) => c.outcome === "Converted").length;
    const conversionRate =
      totalAttempted > 0
        ? Math.round((converted / totalAttempted) * 1000) / 10
        : 0;

    const perMember = db.teamMembers.map((m) => {
      const mCalls = calls.filter((c) => c.callingTeamMemberId === m.id);
      const todayCalls = mCalls.filter((c) => c.callDate === todayStr).length;
      const mConnected = mCalls.filter((c) =>
        CONNECTED_CALL_OUTCOMES.has(c.outcome)
      ).length;
      const mBooked = mCalls.filter(
        (c) => c.outcome === "Meeting Booked" || c.outcome === "Converted"
      ).length;
      const target = m.dailyTargets?.calls ?? 15;
      return {
        member: m,
        total: mCalls.length,
        todayCalls,
        connected: mConnected,
        booked: mBooked,
        target,
      };
    });

    return {
      totalAttempted,
      connectedCalls,
      connectRate,
      meetingsBooked,
      converted,
      conversionRate,
      perMember,
    };
  }, [calls, db.teamMembers, todayStr]);

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (outcomeFilter !== "All" && c.outcome !== outcomeFilter) return false;
      if (memberFilter !== "All" && c.callingTeamMemberId !== memberFilter)
        return false;
      if (!q) return true;
      return (
        c.businessName.toLowerCase().includes(q) ||
        c.phoneNumber.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q) ||
        c.nextAction.toLowerCase().includes(q)
      );
    });
  }, [calls, search, outcomeFilter, memberFilter]);

  const openLogModal = (prefillLeadId?: string) => {
    setEditingCall(null);
    const found = prefillLeadId
      ? db.leads.find((l) => l.id === prefillLeadId)
      : db.leads[0];
    setFormState({
      ...emptyForm,
      leadId: found?.id || "",
      businessName: found?.businessName || "",
      phoneNumber: found?.phoneNumber || "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (call: ColdCallRecord) => {
    setEditingCall(call);
    const mins =
      call.durationSeconds != null ? Math.floor(call.durationSeconds / 60) : "";
    const secs =
      call.durationSeconds != null ? call.durationSeconds % 60 : "";
    setFormState({
      leadId: call.leadId,
      businessName: call.businessName,
      phoneNumber: call.phoneNumber,
      callingTeamMemberId: call.callingTeamMemberId,
      campaignId: call.campaignId || "",
      callDate: call.callDate,
      callTime: call.callTime,
      durationMinutes: mins === "" ? "" : String(mins),
      durationSecondsPart: secs === "" ? "" : String(secs),
      outcome: call.outcome,
      notes: call.notes,
      followUpDate: call.followUpDate,
      nextAction: call.nextAction,
      recordingConsent: Boolean(call.recordingConsent),
      recordingUrl: call.recordingUrl || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.businessName.trim() || !formState.phoneNumber.trim()) return;

    const hasDuration =
      formState.durationMinutes.trim() !== "" ||
      formState.durationSecondsPart.trim() !== "";
    const durationSeconds = hasDuration
      ? (Number(formState.durationMinutes) || 0) * 60 +
        (Number(formState.durationSecondsPart) || 0)
      : null;

    const payload = {
      leadId: formState.leadId,
      businessName: formState.businessName.trim(),
      phoneNumber: formState.phoneNumber.trim(),
      callingTeamMemberId: formState.callingTeamMemberId,
      campaignId: formState.campaignId || undefined,
      callDate: formState.callDate,
      callTime: formState.callTime,
      durationSeconds,
      outcome: formState.outcome,
      notes: formState.notes.trim(),
      followUpDate: formState.followUpDate,
      nextAction: formState.nextAction.trim(),
      source: "manual" as const,
      recordingConsent: formState.recordingConsent,
      recordingUrl: formState.recordingConsent
        ? formState.recordingUrl.trim() || undefined
        : undefined,
    };

    if (editingCall) {
      updateColdCall(editingCall.id, payload);
    } else {
      addColdCall(payload);
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
              Cold Calling &amp; Tele-Outreach
            </h1>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                callingIntegration?.status === "connected"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
              }`}
            >
              {callingIntegration?.status === "connected"
                ? `Twilio Connected (${callingIntegration.accountInfo.phoneNumber})`
                : "Manual Call Logging + Click-to-Call"}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Track outbound prospect calls, connect rates, daily targets, and meeting conversions. Call durations are never fabricated.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openLogModal()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Log Outbound Call
        </button>
      </div>

      {/* 6 Cold Call KPI Cards (Distinguishing Attempted vs Connected) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Calls Attempted",
            value: stats.totalAttempted,
            sub: "Total outbound dials",
          },
          {
            label: "Calls Connected",
            value: stats.connectedCalls,
            sub: "Spoke with decision maker",
          },
          {
            label: "Connect Rate",
            value: `${stats.connectRate}%`,
            sub: "Connected / Attempted",
          },
          {
            label: "Meetings Booked",
            value: stats.meetingsBooked,
            sub: "Booked on call",
          },
          {
            label: "Converted Clients",
            value: stats.converted,
            sub: "Closed from call",
          },
          {
            label: "Call Conversion Rate",
            value: `${stats.conversionRate}%`,
            sub: "Converted / Attempted",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5"
          >
            <div className="text-[11px] text-neutral-500">{card.label}</div>
            <div className="text-lg font-semibold mt-1 tabular-nums">
              {card.value}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Call Targets & Rep Performance */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-sm font-semibold">
              Team Calling Performance &amp; Daily Call Targets
            </h2>
            <p className="text-xs text-neutral-500">
              Calls made today vs. daily target, total connected calls, and meetings booked per team member
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {stats.perMember.map((row) => {
            const pct =
              row.target > 0
                ? Math.min(100, Math.round((row.todayCalls / row.target) * 100))
                : 100;
            return (
              <div
                key={row.member.id}
                className="p-3.5 rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{row.member.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                    {row.member.role}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>
                    Today: <strong>{row.todayCalls}</strong> / {row.target}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={row.target}
                    onChange={(e) =>
                      updateTeamMember(row.member.id, {
                        dailyTargets: {
                          calls: Number(e.target.value),
                          emails: row.member.dailyTargets?.emails ?? 20,
                          dms: row.member.dailyTargets?.dms ?? 15,
                          leadsAdded: row.member.dailyTargets?.leadsAdded ?? 10,
                        },
                      })
                    }
                    className="w-14 px-1.5 py-0.5 text-right rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px]"
                    title="Daily Call Target"
                  />
                </div>
                <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-neutral-900 dark:bg-white rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                  <span>Total: {row.total}</span>
                  <span>Connected: {row.connected}</span>
                  <span>Booked: {row.booked}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search calls by business name, phone number, notes, or next action..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
          />
        </div>

        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Call Outcomes</option>
          {CALL_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Team Members</option>
          {db.teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Cold Calls Log Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 bg-neutral-50/60 dark:bg-neutral-950/50">
                <th className="py-2.5 px-3.5">Business &amp; Phone</th>
                <th className="py-2.5 px-3.5">Caller</th>
                <th className="py-2.5 px-3.5">Date &amp; Time</th>
                <th className="py-2.5 px-3.5">Duration</th>
                <th className="py-2.5 px-3.5">Outcome</th>
                <th className="py-2.5 px-3.5">Notes &amp; Next Action</th>
                <th className="py-2.5 px-3.5">Follow-up</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-neutral-400"
                  >
                    No cold calls logged yet. Click &ldquo;Log Outbound Call&rdquo; to record a call.
                  </td>
                </tr>
              ) : (
                filteredCalls.map((call) => {
                  const caller = db.teamMembers.find(
                    (m) => m.id === call.callingTeamMemberId
                  );
                  const isConnected = CONNECTED_CALL_OUTCOMES.has(call.outcome);
                  return (
                    <tr
                      key={call.id}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition"
                    >
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {call.businessName}
                          </span>
                          {call.isDemo && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-semibold">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href={`tel:${call.phoneNumber}`}
                            className="inline-flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-400 hover:underline font-mono"
                            title="Click to Call"
                          >
                            <PhoneCall className="w-3 h-3 text-emerald-600" />
                            {call.phoneNumber}
                          </a>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        {caller?.name || "Team Member"}
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-[11px] text-neutral-500">
                        <div>{call.callDate}</div>
                        <div>{call.callTime}</div>
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-[11px]">
                        {call.durationSeconds != null ? (
                          <span className="font-mono font-medium">
                            {Math.floor(call.durationSeconds / 60)}m{" "}
                            {call.durationSeconds % 60}s
                          </span>
                        ) : (
                          <span className="text-neutral-400">Not recorded</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <select
                          value={call.outcome}
                          onChange={(e) =>
                            updateColdCall(call.id, {
                              outcome: e.target.value as CallOutcome,
                            })
                          }
                          className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                            call.outcome === "Meeting Booked" ||
                            call.outcome === "Converted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : isConnected
                              ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900"
                              : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700"
                          }`}
                        >
                          {CALL_OUTCOMES.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3.5 max-w-xs">
                        <p className="text-neutral-700 dark:text-neutral-300 line-clamp-2">
                          {call.notes || "—"}
                        </p>
                        {call.nextAction && (
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            Next: {call.nextAction}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-[11px] text-neutral-500">
                        {call.followUpDate || "—"}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={`tel:${call.phoneNumber}`}
                            className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                            title="Dial via Click-to-Call"
                          >
                            <PhoneOutgoing className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => openEditModal(call)}
                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {permissions.deleteRecords && (
                            <button
                              type="button"
                              onClick={() => deleteColdCall(call.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOG / EDIT COLD CALL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editingCall ? "Edit Cold Call Log" : "Log Outbound Cold Call"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCall} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Select Lead from CRM
                  </label>
                  <select
                    value={formState.leadId}
                    onChange={(e) => {
                      const found = db.leads.find(
                        (l) => l.id === e.target.value
                      );
                      setFormState({
                        ...formState,
                        leadId: e.target.value,
                        businessName:
                          found?.businessName || formState.businessName,
                        phoneNumber:
                          found?.phoneNumber || formState.phoneNumber,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">Custom Prospect...</option>
                    {db.leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.businessName} ({l.phoneNumber || "No phone"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Business Name *
                  </label>
                  <input
                    required
                    value={formState.businessName}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        businessName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Phone Number *
                  </label>
                  <input
                    required
                    value={formState.phoneNumber}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        phoneNumber: e.target.value,
                      })
                    }
                    placeholder="+1 (415) 555-0192"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Calling Team Member
                  </label>
                  <select
                    value={formState.callingTeamMemberId}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        callingTeamMemberId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {db.teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Outreach Campaign
                  </label>
                  <select
                    value={formState.campaignId}
                    onChange={(e) =>
                      setFormState({ ...formState, campaignId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="">No Campaign</option>
                    {(db.campaigns || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Call Date</label>
                  <input
                    type="date"
                    value={formState.callDate}
                    onChange={(e) =>
                      setFormState({ ...formState, callDate: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Call Time</label>
                  <input
                    type="time"
                    value={formState.callTime}
                    onChange={(e) =>
                      setFormState({ ...formState, callTime: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Duration (Min / Sec)
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={formState.durationMinutes}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          durationMinutes: e.target.value,
                        })
                      }
                      className="w-1/2 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                    <input
                      type="number"
                      min={0}
                      max={59}
                      placeholder="Sec"
                      value={formState.durationSecondsPart}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          durationSecondsPart: e.target.value,
                        })
                      }
                      className="w-1/2 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium mb-1">Call Outcome</label>
                  <select
                    value={formState.outcome}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        outcome: e.target.value as CallOutcome,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {CALL_OUTCOMES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Call Notes</label>
                <textarea
                  rows={3}
                  value={formState.notes}
                  onChange={(e) =>
                    setFormState({ ...formState, notes: e.target.value })
                  }
                  placeholder="Key pain points discussed, decision maker feedback..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={formState.followUpDate}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        followUpDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Next Action</label>
                  <input
                    value={formState.nextAction}
                    onChange={(e) =>
                      setFormState({ ...formState, nextAction: e.target.value })
                    }
                    placeholder="e.g., Send Figma teardown & calendar invite"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              {/* Optional Call Recording with Mandatory Consent Gate */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.recordingConsent}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        recordingConsent: e.target.checked,
                      })
                    }
                  />
                  <span>
                    Call Recording Consent Verified (Applicable two-party / GDPR consent obtained)
                  </span>
                </label>
                {formState.recordingConsent && (
                  <input
                    value={formState.recordingUrl}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        recordingUrl: e.target.value,
                      })
                    }
                    placeholder="Optional recording URL (https://...)"
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  />
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
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {editingCall ? "Save Changes" : "Save Call Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
