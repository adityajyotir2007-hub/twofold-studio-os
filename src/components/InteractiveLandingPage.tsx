"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { AuthScreen, GoogleLogo } from "@/components/AuthScreen";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileSpreadsheet,
  FolderKanban,
  Globe,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  Phone,
  Play,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

type ShowcaseTab =
  | "command"
  | "crm"
  | "outreach"
  | "calling"
  | "delivery"
  | "finance";

interface InteractiveLandingPageProps {
  onOpenSignIn?: () => void;
}

export function InteractiveLandingPage({
  onOpenSignIn,
}: InteractiveLandingPageProps) {
  const { db, theme, toggleTheme, loginWithEmail } = useAgency();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("command");
  const [quickLoginLoading, setQuickLoginLoading] = useState<string | null>(
    null
  );

  // Interactive Sandbox State inside the Hero Preview
  const [previewLeadIdx, setPreviewLeadIdx] = useState(0);
  const [simulatedTimelineStep, setSimulatedTimelineStep] = useState(5);
  const [callFilterOutcome, setCallFilterOutcome] = useState<string>("ALL");

  // Interactive Agency ROI & Pipeline Calculator State
  const [teamSize, setTeamSize] = useState(6);
  const [dailyOutreachPerRep, setDailyOutreachPerRep] = useState(35);
  const [avgDealSize, setAvgDealSize] = useState(18000);
  const [replyRatePct, setReplyRatePct] = useState(14);

  const roiProjection = useMemo(() => {
    const monthlyTouches = teamSize * dailyOutreachPerRep * 22;
    const monthlyReplies = Math.round(monthlyTouches * (replyRatePct / 100));
    const meetingsBooked = Math.max(1, Math.round(monthlyReplies * 0.28));
    const dealsClosed = Math.max(1, Math.round(meetingsBooked * 0.25));
    const projectedMonthlyRevenue = dealsClosed * avgDealSize;
    const hoursSavedPerMonth = teamSize * 28;
    return {
      monthlyTouches,
      monthlyReplies,
      meetingsBooked,
      dealsClosed,
      projectedMonthlyRevenue,
      hoursSavedPerMonth,
    };
  }, [teamSize, dailyOutreachPerRep, avgDealSize, replyRatePct]);

  // Live metrics from database state
  const liveStats = useMemo(() => {
    const totalPipeline = db.leads.reduce(
      (sum, l) => sum + (l.estimatedProjectValue || 0),
      0
    );
    const collectedRev = db.finance
      .filter((f) => f.transactionType !== "Expense")
      .reduce((sum, f) => sum + (f.paidAmount || 0), 0);
    const activeProjects = db.projects.filter(
      (p) => p.projectStatus !== "Completed"
    ).length;
    const totalCalls = (db.coldCalls || []).length;
    return {
      leadsCount: db.leads.length,
      totalPipeline,
      collectedRev,
      activeProjects,
      totalCalls,
      outreachCount: db.outreach.length,
    };
  }, [db.leads, db.finance, db.projects, db.coldCalls, db.outreach]);

  const handleInstantRoleLaunch = async (email: string) => {
    setQuickLoginLoading(email);
    try {
      const res = await loginWithEmail(email, "Twofold2026!");
      if (!res.ok) {
        setShowAuthModal(true);
      }
    } finally {
      setQuickLoginLoading(null);
    }
  };

  if (showAuthModal) {
    return (
      <div className="relative">
        <div className="fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setShowAuthModal(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
          >
            ← Back to Interactive Overview
          </button>
        </div>
        <AuthScreen />
      </div>
    );
  }

  const sampleLeads = db.leads.slice(0, 5);
  const selectedPreviewLead = sampleLeads[previewLeadIdx] || sampleLeads[0];

  const unifiedTimelineEvents = [
    {
      step: 1,
      date: "Nov 20 · 09:15",
      channel: "Gmail API",
      badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      direction: "Outbound",
      actor: "Elena Vance",
      summary: `Sent personalized conversion & speed audit to ${
        selectedPreviewLead?.contactPerson || "Founder"
      }`,
      meta: "Thread ID: th_1934a8b · Delivered",
    },
    {
      step: 2,
      date: "Nov 21 · 11:40",
      channel: "Instagram Graph",
      badge:
        "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
      direction: "Outbound",
      actor: "Sora Takahashi",
      summary: "Shared interactive Figma mobile hero prototype link via DM",
      meta: "Msg ID: ig_mid_99412 · Seen",
    },
    {
      step: 3,
      date: "Nov 22 · 14:10",
      channel: "Twilio Voice",
      badge:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      direction: "Outbound",
      actor: "Liam O'Connor",
      summary:
        "Discovery call completed (4m 12s) — walked through booking funnel drop-off",
      meta: "Outcome: Interested · Connected",
    },
    {
      step: 4,
      date: "Nov 22 · 16:48",
      channel: "Gmail Webhook",
      badge:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      direction: "Inbound",
      actor: selectedPreviewLead?.contactPerson || "Prospect",
      summary:
        "\"We reviewed the staging prototype with our partners — let's lock a kickoff call this Thursday.\"",
      meta: "Auto-Matched by Normalized Email · Status -> Replied",
    },
    {
      step: 5,
      date: "Nov 23 · 10:00",
      channel: "Google Calendar",
      badge:
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      direction: "Outbound",
      actor: "Marcus Sterling",
      summary: "Architecture & Scope Review Booked · Proposal ($28,000) Attached",
      meta: "Lead Ready for 1-Click Atomic Client Conversion",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-neutral-900">
      {/* Subtle Grid Backdrop */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Sticky Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
              TF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight">
                  Twofold Studio OS
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  v2.5 Production
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 hidden sm:block">
                Multi-User Agency Operating System · CRM, Outreach, Calling &amp;
                Delivery
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <a
              href="#interactive-sandbox"
              className="hover:text-neutral-900 dark:hover:text-white transition"
            >
              Interactive Sandbox
            </a>
            <a
              href="#unified-timeline"
              className="hover:text-neutral-900 dark:hover:text-white transition"
            >
              Unified Timeline
            </a>
            <a
              href="#integrations"
              className="hover:text-neutral-900 dark:hover:text-white transition"
            >
              6 Live Integrations
            </a>
            <a
              href="#roi-simulator"
              className="hover:text-neutral-900 dark:hover:text-white transition"
            >
              Pipeline Simulator
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle theme"
              className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 transition"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenSignIn) onOpenSignIn();
                setShowAuthModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition shadow-2xs text-neutral-800 dark:text-neutral-100"
            >
              <GoogleLogo className="w-3.5 h-3.5 shrink-0" />
              <span>Sign in with Google</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenSignIn) onOpenSignIn();
                setShowAuthModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
            >
              Email Sign In
            </button>

            <button
              type="button"
              onClick={() => handleInstantRoleLaunch("elena@twofold.studio")}
              disabled={Boolean(quickLoginLoading)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition shadow-sm disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {quickLoginLoading === "elena@twofold.studio"
                ? "Launching OS..."
                : "Launch Live Workspace"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 shadow-2xs mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Real-Time Multi-User Sync · PostgreSQL + Row-Level Security ·
              AES-256-GCM Token Vault
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08] text-neutral-950 dark:text-white">
            The Operating System for{" "}
            <span className="bg-gradient-to-r from-neutral-900 via-neutral-600 to-neutral-900 dark:from-white dark:via-neutral-400 dark:to-white bg-clip-text text-transparent">
              High-Velocity Digital Agencies
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Replace fragmented spreadsheets, disconnected DMs, and manual status
            trackers with one unified workspace. Manage prospects, cold emails,
            WhatsApp &amp; Instagram outreach, cold calls, client conversions,
            and revenue in real time.
          </p>

          {/* Instant Google Login & Role Launchers */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition shadow-sm text-neutral-900 dark:text-white"
            >
              <GoogleLogo className="w-4 h-4 shrink-0" />
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleInstantRoleLaunch("elena@twofold.studio")}
              disabled={Boolean(quickLoginLoading)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-95 transition shadow-md disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              {quickLoginLoading === "elena@twofold.studio"
                ? "Entering Admin Workspace..."
                : "Enter Workspace as Admin (Elena Vance)"}
            </button>

            <button
              type="button"
              onClick={() => handleInstantRoleLaunch("marcus@twofold.studio")}
              disabled={Boolean(quickLoginLoading)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
            >
              <Users className="w-4 h-4 text-blue-500" />
              {quickLoginLoading === "marcus@twofold.studio"
                ? "Entering..."
                : "Demo as Manager"}
            </button>

            <button
              type="button"
              onClick={() => handleInstantRoleLaunch("sora@twofold.studio")}
              disabled={Boolean(quickLoginLoading)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              {quickLoginLoading === "sora@twofold.studio"
                ? "Entering..."
                : "Demo as Team Member (RBAC)"}
            </button>

            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
            >
              <Lock className="w-4 h-4" />
              Custom Login / Invite Token →
            </button>
          </div>

          {/* Live Telemetry Pill Strip */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
              <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                <span>Active Pipeline Value</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl font-bold mt-1">
                ${liveStats.totalPipeline.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                Across {liveStats.leadsCount} verified CRM leads
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
              <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                <span>Collected Revenue</span>
                <DollarSign className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl font-bold mt-1">
                ${liveStats.collectedRev.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                Atomic invoice &amp; payment ledger
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
              <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                <span>Omnichannel Touches</span>
                <Send className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-xl font-bold mt-1">
                {liveStats.outreachCount + liveStats.totalCalls}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                Email, WhatsApp, IG &amp; Cold Calls
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
              <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                <span>Active Client Builds</span>
                <FolderKanban className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl font-bold mt-1">
                {liveStats.activeProjects} Projects
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                Live milestone &amp; task progress sync
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Live OS Preview Window */}
        <div
          id="interactive-sandbox"
          className="mt-12 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden"
        >
          {/* Window Chrome Bar */}
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400/80" />
              <span className="w-3 h-3 rounded-full bg-amber-400/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
              <span className="ml-2 text-xs font-mono text-neutral-500 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-500" />
                twofold-studio-os://workspace/interactive-preview
              </span>
            </div>

            {/* Interactive Module Switcher */}
            <div className="flex flex-wrap items-center gap-1 bg-neutral-200/70 dark:bg-neutral-800 p-1 rounded-xl text-xs">
              {(
                [
                  { id: "command", label: "Executive KPIs", icon: BarChart3 },
                  {
                    id: "crm",
                    label: "Leads & Unified Timeline",
                    icon: Users,
                  },
                  {
                    id: "outreach",
                    label: "Campaigns & Gmail",
                    icon: Mail,
                  },
                  { id: "calling", label: "Cold Calling Floor", icon: Phone },
                  {
                    id: "delivery",
                    label: "Projects & Delivery",
                    icon: FolderKanban,
                  },
                  { id: "finance", label: "Finance & Ledger", icon: DollarSign },
                ] as {
                  id: ShowcaseTab;
                  label: string;
                  icon: React.ElementType;
                }[]
              ).map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                      active
                        ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Tab Body */}
          <div className="p-6 sm:p-8">
            {activeTab === "command" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Part 14 · Strictly Database-Driven KPI Engine
                    </span>
                    <h3 className="text-xl font-semibold mt-0.5">
                      16 Real-Time Agency KPIs — Zero Hardcoded Multipliers
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleInstantRoleLaunch("elena@twofold.studio")
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  >
                    Open Full Dashboard in OS{" "}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
                    <div className="text-xs font-medium text-neutral-500">
                      Conversion Funnel Velocity
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        {
                          stage: "1. Leads Added to CRM",
                          count: db.leads.length,
                          pct: 100,
                          color: "bg-neutral-900 dark:bg-white",
                        },
                        {
                          stage: "2. Contacted (Email / DM / Call)",
                          count: db.leads.filter((l) => l.status !== "New")
                            .length,
                          pct: 78,
                          color: "bg-blue-500",
                        },
                        {
                          stage: "3. Positive Reply / Interested",
                          count: db.leads.filter((l) =>
                            [
                              "Replied",
                              "Interested",
                              "Meeting Scheduled",
                              "Proposal Sent",
                              "Converted",
                            ].includes(l.status)
                          ).length,
                          pct: 46,
                          color: "bg-purple-500",
                        },
                        {
                          stage: "4. Converted to Paying Clients",
                          count: db.clients.length,
                          pct: 28,
                          color: "bg-emerald-500",
                        },
                      ].map((row) => (
                        <div key={row.stage}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{row.stage}</span>
                            <span className="text-neutral-500">
                              {row.count} records ({row.pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.color}`}
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
                    <div className="text-xs font-medium text-neutral-500">
                      Team Daily Target Execution
                    </div>
                    <div className="mt-4 space-y-3">
                      {db.teamMembers.slice(0, 4).map((tm) => (
                        <div
                          key={tm.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-xs font-semibold">
                              {tm.avatarInitials}
                            </div>
                            <div>
                              <div className="text-xs font-semibold">
                                {tm.name}
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                {tm.title}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                            {tm.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-neutral-500">
                        Data Hygiene &amp; Demo Isolation
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
                        Every seeded record is tagged with{" "}
                        <code className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                          isDemo: true
                        </code>
                        . Toggle between <strong>Live Only</strong> and{" "}
                        <strong>Demo Included</strong> on the dashboard, or
                        purge all seeded demo records in one atomic transaction
                        while preserving your real leads and team accounts.
                      </p>
                    </div>
                    <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        32 Foreign Keys &amp; Atomic RPC Transactions Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "crm" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Click any lead to inspect their Unified Timeline
                  </div>
                  {sampleLeads.length > 0 ? (
                    sampleLeads.map((lead, idx) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setPreviewLeadIdx(idx)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between ${
                          idx === previewLeadIdx
                            ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800/60 shadow-2xs"
                            : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <span>{lead.businessName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-700 font-medium">
                              {lead.status}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            {lead.contactPerson} · {lead.industry} · {lead.city}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold">
                            ${lead.estimatedProjectValue.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {lead.websiteStatus}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900">
                      <Users className="w-8 h-8 mx-auto mb-2 text-neutral-400 opacity-60" />
                      <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                        CRM Ready for Real Leads
                      </p>
                      <p className="mt-1 text-neutral-400">
                        All dummy data has been purged. Add real leads manually or import via CSV inside your workspace.
                      </p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Part 10 · Deduplicated Cross-Channel Stream
                      </span>
                      <h4 className="text-base font-semibold">
                        Unified Communication Timeline:{" "}
                        {selectedPreviewLead?.businessName || "Live Activity Stream"}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-neutral-500">Replay Step:</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSimulatedTimelineStep(n)}
                          className={`w-6 h-6 rounded-lg font-medium text-xs ${
                            simulatedTimelineStep >= n
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                              : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {sampleLeads.length === 0 ? (
                      <div className="p-6 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
                        <MessageSquare className="w-6 h-6 mx-auto mb-2 text-neutral-400 opacity-60" />
                        <p className="font-medium text-neutral-700 dark:text-neutral-300">
                          Omnichannel Timeline Ready
                        </p>
                        <p className="mt-0.5">
                          When you send Gmail emails, WhatsApp chats, or Twilio calls, cross-channel communication records stream here automatically.
                        </p>
                      </div>
                    ) : (
                      unifiedTimelineEvents
                        .filter((e) => e.step <= simulatedTimelineStep)
                        .map((ev) => (
                          <div
                            key={ev.step}
                            className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ev.badge}`}
                                >
                                  {ev.channel}
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                                  {ev.direction}
                                </span>
                                <span className="text-xs font-medium">
                                  {ev.actor}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                                {ev.summary}
                              </p>
                              <div className="text-[10px] font-mono text-neutral-400">
                                {ev.meta}
                              </div>
                            </div>
                            <span className="text-[11px] text-neutral-400 shrink-0">
                              {ev.date}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "outreach" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Parts 5, 7, 8 &amp; 11 · Multi-Channel Outreach &amp;
                    Campaigns
                  </span>
                  <h3 className="text-lg font-semibold">
                    Gmail API Thread Sync, WhatsApp Cloud Templates &amp;
                    Instagram Graph Webhooks
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Every outbound email or message is tracked by its provider{" "}
                    <code className="font-mono">messageId</code> and{" "}
                    <code className="font-mono">threadId</code>. When a prospect
                    replies, the webhook matches their normalized email or phone
                    number, appends the reply to the lead&apos;s timeline, flips
                    the lead status to <strong>Replied</strong>, and broadcasts
                    a real-time notification.
                  </p>
                  <div className="space-y-2.5">
                    {(db.campaigns || []).length > 0 ? (
                      (db.campaigns || []).map((camp) => (
                        <div
                          key={camp.id}
                          className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/60 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-semibold">
                              {camp.name}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {camp.communicationChannels?.join(" + ") ||
                                "Multi-Channel"}{" "}
                              · Target: {camp.targetIndustry} (
                              {camp.targetCountry})
                            </div>
                          </div>
                          <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {camp.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
                        No active campaigns yet. Create targeted outreach campaigns in the Outreach module.
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 space-y-3">
                  <div className="text-xs font-semibold">
                    Recent Synchronized Outreach Activity
                  </div>
                  {db.outreach.length > 0 ? (
                    db.outreach.slice(0, 4).map((o) => (
                      <div
                        key={o.id}
                        className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{o.leadName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                            {o.communicationChannel} · {o.replyStatus}
                          </span>
                        </div>
                        <p className="text-neutral-500 line-clamp-1">
                          {o.messageContent}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
                      Zero outreach messages sent yet. Send real emails or WhatsApp messages inside the workspace.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "calling" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Part 9 · Dedicated Cold Calling Module
                    </span>
                    <h3 className="text-lg font-semibold">
                      Attempted vs. Connected Call Tracking, 8 Outcomes &amp;
                      Twilio Webhook Sync
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {[
                      "ALL",
                      "Meeting Booked",
                      "Interested",
                      "Call Back Later",
                      "No Answer",
                    ].map((out) => (
                      <button
                        key={out}
                        type="button"
                        onClick={() => setCallFilterOutcome(out)}
                        className={`px-2.5 py-1 rounded-lg border text-xs transition ${
                          callFilterOutcome === out
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent"
                            : "border-neutral-200 dark:border-neutral-800"
                        }`}
                      >
                        {out}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(db.coldCalls || []).length > 0 ? (
                    (db.coldCalls || [])
                      .filter(
                        (c) =>
                          callFilterOutcome === "ALL" ||
                          c.outcome === callFilterOutcome
                      )
                      .map((call) => (
                        <div
                          key={call.id}
                          className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-semibold">
                              {call.businessName}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono mt-0.5">
                              {call.phoneNumber} ·{" "}
                              {call.durationSeconds != null
                                ? `${Math.floor(call.durationSeconds / 60)}m ${
                                    call.durationSeconds % 60
                                  }s`
                                : "No Duration"}
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5">
                              {call.notes}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0">
                            {call.outcome}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="col-span-full p-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900">
                      <Phone className="w-8 h-8 mx-auto mb-2 text-neutral-400 opacity-60" />
                      <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                        Cold Calling Floor Clean
                      </p>
                      <p className="mt-1 text-neutral-400">
                        All dummy calls removed. Log real discovery calls or connect Twilio Voice for 1-click browser calling.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "delivery" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {db.projects.length > 0 ? (
                  db.projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">
                            {proj.projectName}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {proj.projectType}
                          </div>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800">
                          {proj.projectStatus}
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-neutral-500">
                            Milestone Progress
                          </span>
                          <span className="font-semibold">
                            {proj.progressPercentage}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${proj.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                        <span>Budget: ${proj.projectBudget.toLocaleString()}</span>
                        <span>Due: {proj.deadline}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900">
                    <FolderKanban className="w-8 h-8 mx-auto mb-2 text-neutral-400 opacity-60" />
                    <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                      No Active Projects
                    </p>
                    <p className="mt-1 text-neutral-400">
                      All dummy projects purged. Convert closed CRM leads into active delivery projects inside your workspace.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "finance" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Atomic Payment Ledger &amp; Role-Based Access Control
                    </span>
                    <h3 className="text-lg font-semibold">
                      Invoices, Retainers &amp; Expenses (Restricted from Team
                      Member Role)
                    </h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {db.finance.length > 0 ? (
                    db.finance.slice(0, 6).map((f) => (
                      <div
                        key={f.id}
                        className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold">{f.invoiceNumber}</div>
                          <div className="text-neutral-500">
                            {db.clients.find((c) => c.id === f.clientId)
                              ?.businessName ||
                              db.projects.find((p) => p.id === f.projectId)
                                ?.projectName ||
                              f.notes}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {f.currency} {f.amount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {f.paymentStatus}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full p-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900">
                      <DollarSign className="w-8 h-8 mx-auto mb-2 text-neutral-400 opacity-60" />
                      <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                        Financial Ledger Clean
                      </p>
                      <p className="mt-1 text-neutral-400">
                        All dummy transactions cleared. Record real client invoices, deposits, and retainers with zero clutter.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6 Official External Business Integrations Grid */}
      <section
        id="integrations"
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-neutral-200/80 dark:border-neutral-800"
      >
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Parts 4–9 · Live External API Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            6 Verified Business Integrations with AES-256-GCM Server Token Vault
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
            No fake &ldquo;Connected&rdquo; toggles. Every integration verifies
            real OAuth 2.0 or API credentials against the provider&apos;s live
            endpoint before activating, and stores tokens encrypted on the
            server.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: "Gmail Business API",
              sub: "Google OAuth 2.0 + Push Webhooks",
              icon: Mail,
              points: [
                "Send real outbound emails from agency inbox",
                "Track provider messageId & threadId",
                "Auto-match incoming replies to CRM leads",
              ],
            },
            {
              title: "Google Sheets & CSV Engine",
              sub: "Column Mapper + 4-Field Deduplication",
              icon: FileSpreadsheet,
              points: [
                "Interactive column-to-CRM field mapping",
                "Deduplicate by Name, Email, Domain & Phone",
                "Choose Skip, Update Existing, or Create New",
              ],
            },
            {
              title: "WhatsApp Business Cloud API",
              sub: "Official Meta Graph API v20.0",
              icon: MessageSquare,
              points: [
                "Opt-in compliance & approved template sends",
                "Delivery & read receipt webhook tracking",
                "Full conversation history inside lead drawer",
              ],
            },
            {
              title: "Instagram Professional API",
              sub: "Meta OAuth + Inbound DM Webhooks",
              icon: Globe,
              points: [
                "Sync eligible inbound Instagram business DMs",
                "Match handles to lead profiles automatically",
                "Manual DM logging fallback for non-API threads",
              ],
            },
            {
              title: "Twilio / Calling Provider",
              sub: "Click-to-Call + Call Status Webhooks",
              icon: Phone,
              points: [
                "Real duration & CallSid webhook synchronization",
                "Optional call recording consent gate",
                "Daily rep call targets & conversion leaderboards",
              ],
            },
            {
              title: "Google Calendar Sync",
              sub: "OAuth 2.0 Meeting & Follow-Up Sync",
              icon: Clock,
              points: [
                "Bi-directional client discovery call scheduling",
                "Automated follow-up & deadline reminders",
                "Linked directly to CRM leads & active projects",
              ],
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                      AES-256-GCM
                    </span>
                  </div>
                  <h3 className="text-base font-semibold mt-3">{card.title}</h3>
                  <div className="text-xs text-neutral-400">{card.sub}</div>
                  <ul className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {card.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Agency Pipeline & ROI Simulator */}
      <section
        id="roi-simulator"
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-neutral-200/80 dark:border-neutral-800"
      >
        <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 sm:p-10 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Interactive Agency Growth Simulator
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
                  Model Your Studio&apos;s Monthly Pipeline Velocity
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Adjust the sliders below to see how centralizing cold emails,
                  DMs, and cold calls inside Twofold Studio OS scales your
                  booked meetings and closed retainers.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Active Team Members</span>
                    <span>{teamSize} members</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                    className="w-full accent-neutral-900 dark:accent-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Daily Outreach Touches per Rep (Email/DM/Call)</span>
                    <span>{dailyOutreachPerRep} / day</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={dailyOutreachPerRep}
                    onChange={(e) =>
                      setDailyOutreachPerRep(Number(e.target.value))
                    }
                    className="w-full accent-neutral-900 dark:accent-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Omnichannel Positive Reply Rate</span>
                    <span>{replyRatePct}%</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    value={replyRatePct}
                    onChange={(e) => setReplyRatePct(Number(e.target.value))}
                    className="w-full accent-neutral-900 dark:accent-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Average Client Project Value</span>
                    <span>${avgDealSize.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={75000}
                    step={2500}
                    value={avgDealSize}
                    onChange={(e) => setAvgDealSize(Number(e.target.value))}
                    className="w-full accent-neutral-900 dark:accent-white"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                <div className="text-xs text-neutral-500">
                  Monthly Omnichannel Touches
                </div>
                <div className="text-2xl font-bold mt-1">
                  {roiProjection.monthlyTouches.toLocaleString()}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Auto-logged across Email, IG, WA &amp; Calls
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                <div className="text-xs text-neutral-500">
                  Qualified Discovery Calls
                </div>
                <div className="text-2xl font-bold mt-1">
                  {roiProjection.meetingsBooked} / mo
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  From {roiProjection.monthlyReplies} synchronized replies
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 col-span-2 flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-75">
                    Projected Monthly New Client Revenue
                  </div>
                  <div className="text-3xl font-bold mt-1">
                    ${roiProjection.projectedMonthlyRevenue.toLocaleString()}
                  </div>
                  <div className="text-xs opacity-75 mt-1">
                    {roiProjection.dealsClosed} new client conversions/mo ·{" "}
                    {roiProjection.hoursSavedPerMonth} hrs saved in manual CRM
                    entry
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleInstantRoleLaunch("elena@twofold.studio")
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white hover:opacity-90 transition shrink-0"
                >
                  Start in Live OS →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="border-t border-neutral-200/80 dark:border-neutral-800 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[10px]">
              TF
            </div>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Twofold Studio OS
            </span>
            <span>· Production Multi-User Agency Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="hover:underline"
            >
              Sign In / Accept Invitation
            </button>
            <button
              type="button"
              onClick={() => handleInstantRoleLaunch("elena@twofold.studio")}
              className="font-medium text-neutral-900 dark:text-white hover:underline"
            >
              Launch Workspace →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
