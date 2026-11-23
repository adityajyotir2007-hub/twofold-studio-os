"use client";

import React, { useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { CURRENCIES } from "@/lib/constants";
import {
  AgencySettings,
  CurrencyCode,
  IntegrationConnection,
  IntegrationProviderId,
  RolePermissionConfig,
  UserRole,
} from "@/types/agency";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  KeyRound,
  Lock,
  Plug,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
  X,
} from "lucide-react";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {desc && <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950";

export function SettingsView() {
  const {
    db,
    currentUser,
    permissions,
    updateSettings,
    updateTeamMember,
    purgeDemoRecords,
    refreshState,
    theme,
    toggleTheme,
  } = useAgency();

  const s = db.settings;
  const integrations = db.integrations || [];

  const [profile, setProfile] = useState({
    agencyName: s.agencyName,
    tagline: s.tagline,
    logoText: s.logoText,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    website: s.website,
  });
  const [account, setAccount] = useState({
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone,
    title: currentUser.title,
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmPurgeDemo, setConfirmPurgeDemo] = useState(false);

  // Part 4 — Integration Connect & Verification Modal State
  const [activeIntegration, setActiveIntegration] =
    useState<IntegrationConnection | null>(null);
  const [credAccessToken, setCredAccessToken] = useState("");
  const [credPhoneNumberId, setCredPhoneNumberId] = useState("");
  const [credAccountSid, setCredAccountSid] = useState("");
  const [credAuthToken, setCredAuthToken] = useState("");
  const [credFromNumber, setCredFromNumber] = useState("");
  const [integrationBusy, setIntegrationBusy] = useState<string | null>(null);
  const [integrationMessage, setIntegrationMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const flash = (k: string) => {
    setSaved(k);
    setTimeout(() => setSaved(null), 1800);
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twofold-studio-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartOAuth = async (provider: IntegrationProviderId) => {
    setIntegrationBusy(provider);
    setIntegrationMessage(null);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_oauth", provider }),
    });
    const data = await res.json();
    setIntegrationBusy(null);
    if (res.ok && data.authorizationUrl) {
      window.location.href = data.authorizationUrl;
      return;
    }
    setIntegrationMessage({
      type: "err",
      text:
        data.error ||
        "OAuth client credentials are not yet configured in environment variables.",
    });
  };

  const handleConnectWithVerifiedCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntegration) return;
    setIntegrationBusy(activeIntegration.provider);
    setIntegrationMessage(null);

    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "connect_credentials",
        provider: activeIntegration.provider,
        credentials: {
          accessToken: credAccessToken,
          phoneNumberId: credPhoneNumberId,
          accountSid: credAccountSid,
          authToken: credAuthToken,
          fromNumber: credFromNumber,
        },
      }),
    });
    const data = await res.json();
    setIntegrationBusy(null);
    await refreshState();

    if (!res.ok || !data.ok) {
      setIntegrationMessage({
        type: "err",
        text: data.error || "Live verification failed.",
      });
      return;
    }

    setIntegrationMessage({
      type: "ok",
      text: `Live verification succeeded! Connected ${activeIntegration.name}.`,
    });
    setActiveIntegration(null);
  };

  const handleTestConnection = async (provider: IntegrationProviderId) => {
    setIntegrationBusy(provider);
    setIntegrationMessage(null);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_connection", provider }),
    });
    const data = await res.json();
    setIntegrationBusy(null);
    await refreshState();
    setIntegrationMessage({
      type: res.ok && data.ok ? "ok" : "err",
      text:
        res.ok && data.ok
          ? `Connection test passed for ${provider}.`
          : data.error || `Connection test failed for ${provider}.`,
    });
  };

  const handleDisconnectIntegration = async (
    provider: IntegrationProviderId
  ) => {
    setIntegrationBusy(provider);
    setIntegrationMessage(null);
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", provider }),
    });
    setIntegrationBusy(null);
    await refreshState();
    setIntegrationMessage({
      type: "ok",
      text: `Revoked encrypted credentials and disconnected ${provider}.`,
    });
  };

  const handleUpdateSyncSetting = async (
    provider: IntegrationProviderId,
    updates: Partial<IntegrationConnection["syncSettings"]>
  ) => {
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_settings",
        provider,
        syncSettings: updates,
      }),
    });
    await refreshState();
  };

  const SavedBadge = ({ k }: { k: string }) =>
    saved === k ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
        <Check className="w-3 h-3" /> Saved
      </span>
    ) : null;

  const notifLabels: {
    key: keyof AgencySettings["notificationPreferences"];
    label: string;
  }[] = [
    { key: "newLeads", label: "New leads" },
    { key: "followUpsDue", label: "Follow-ups due" },
    { key: "newClients", label: "New clients" },
    { key: "projectDeadlines", label: "Project deadlines" },
    { key: "overdueTasks", label: "Overdue tasks" },
    { key: "pendingPayments", label: "Pending payments" },
    { key: "projectStatusChanges", label: "Project status changes" },
  ];

  const permLabels: { key: keyof RolePermissionConfig; label: string }[] = [
    { key: "finance", label: "Finance & invoices" },
    { key: "team", label: "Team management" },
    { key: "settings", label: "Agency settings" },
    { key: "deleteRecords", label: "Delete records" },
  ];

  const demoCount =
    db.leads.filter((l) => l.isDemo).length +
    db.clients.filter((c) => c.isDemo).length +
    db.projects.filter((p) => p.isDemo).length +
    db.finance.filter((f) => f.isDemo).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Workspace Settings &amp; Integrations
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Configuration, connected external business accounts, RBAC permissions, and data security for {s.agencyName}.
        </p>
      </div>

      {/* PART 4 — INTEGRATIONS & CONNECTED ACCOUNTS */}
      <Section
        title="Integrations & Connected Accounts"
        desc="Connect real business communication channels and data sources. Tokens are encrypted with AES-256-GCM on the server and never exposed to browser JavaScript. An integration is only marked Connected after live provider authentication succeeds."
      >
        {integrationMessage && (
          <div
            className={`mb-4 p-3 rounded-xl border text-xs flex items-center justify-between ${
              integrationMessage.type === "ok"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            <span>{integrationMessage.text}</span>
            <button
              type="button"
              onClick={() => setIntegrationMessage(null)}
              className="ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {integrations.map((int) => {
            const isConnected = int.status === "connected";
            const isError = int.status === "error";
            const isOAuthProvider =
              int.provider === "gmail" ||
              int.provider === "google_sheets" ||
              int.provider === "google_calendar" ||
              int.provider === "instagram";

            return (
              <div
                key={int.id}
                className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40 flex flex-col justify-between space-y-3.5"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {int.name}
                      </h3>
                      <div className="text-[11px] text-neutral-400">
                        Webhook Endpoint:{" "}
                        <code className="font-mono">
                          /api/webhooks/{int.provider}
                        </code>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        isConnected
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : isError
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300"
                          : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </>
                      ) : isError ? (
                        <>
                          <AlertCircle className="w-3 h-3" /> Auth Error
                        </>
                      ) : (
                        "Disconnected"
                      )}
                    </span>
                  </div>

                  {/* Account Information & Permissions Granted */}
                  <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Account Info:</span>
                      <span className="font-medium">
                        {int.accountInfo.email ||
                          int.accountInfo.phoneNumber ||
                          int.accountInfo.accountName ||
                          "Not authenticated"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Last Sync:</span>
                      <span>{int.lastSyncAt || "Never"}</span>
                    </div>
                    {int.lastSyncError && (
                      <div className="text-red-600 dark:text-red-400 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                        Last Error: {int.lastSyncError}
                      </div>
                    )}
                    {int.permissionsGranted.length > 0 && (
                      <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800 text-neutral-500 truncate">
                        Scopes: {int.permissionsGranted.join(", ")}
                      </div>
                    )}
                  </div>

                  {/* Sync Settings */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={int.syncSettings.autoMatchLeads}
                        onChange={(e) =>
                          handleUpdateSyncSetting(int.provider, {
                            autoMatchLeads: e.target.checked,
                          })
                        }
                      />
                      Auto-match CRM leads
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={int.syncSettings.autoCreateOutreach}
                        onChange={(e) =>
                          handleUpdateSyncSetting(int.provider, {
                            autoCreateOutreach: e.target.checked,
                          })
                        }
                      />
                      Auto-log outreach
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={int.syncSettings.webhookEnabled}
                        onChange={(e) =>
                          handleUpdateSyncSetting(int.provider, {
                            webhookEnabled: e.target.checked,
                          })
                        }
                      />
                      Webhooks enabled
                    </label>
                  </div>
                </div>

                {/* Connect / Disconnect / Test Connection Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-200/70 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {permissions.settings ? (
                      <>
                        {isOAuthProvider && (
                          <button
                            type="button"
                            disabled={integrationBusy === int.provider}
                            onClick={() => handleStartOAuth(int.provider)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                          >
                            <ExternalLink className="w-3 h-3" /> OAuth Connect
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveIntegration(int);
                            setCredAccessToken("");
                            setCredPhoneNumberId("");
                            setCredAccountSid("");
                            setCredAuthToken("");
                            setCredFromNumber("");
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-medium hover:bg-neutral-50"
                        >
                          <KeyRound className="w-3 h-3" />{" "}
                          {isConnected ? "Rotate Token" : "Connect API Token"}
                        </button>
                        {isConnected && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDisconnectIntegration(int.provider)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Unplug className="w-3 h-3" /> Disconnect
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-neutral-400">
                        Admin required to modify credentials
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={integrationBusy === int.provider}
                    onClick={() => handleTestConnection(int.provider)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${
                        integrationBusy === int.provider ? "animate-spin" : ""
                      }`}
                    />
                    Test Connection
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Account settings — everyone */}
      <Section
        title="Account Settings"
        desc="Your personal profile in the Twofold Studio workspace."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["name", "email", "phone", "title"] as const).map((k) => (
            <div key={k}>
              <label className="block text-xs font-medium mb-1 capitalize">
                {k}
              </label>
              <input
                value={account[k]}
                onChange={(e) =>
                  setAccount({ ...account, [k]: e.target.value })
                }
                className={inputCls}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          <SavedBadge k="account" />
          <button
            type="button"
            onClick={() => {
              if (
                !account.name.trim() ||
                !/^\S+@\S+\.\S+$/.test(account.email)
              )
                return;
              updateTeamMember(currentUser.id, account);
              flash("account");
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            Save Account
          </button>
        </div>
      </Section>

      {/* Theme — everyone */}
      <Section title="Theme Preferences">
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => theme !== t && toggleTheme()}
              className={`px-4 py-2 rounded-lg text-xs font-medium border capitalize ${
                theme === t
                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              {t} mode
            </button>
          ))}
        </div>
      </Section>

      {!permissions.settings ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
          <Lock className="w-4 h-4" />
          Agency profile, currency, permissions, and data purge are restricted to Admins.
        </div>
      ) : (
        <>
          <Section title="Agency Profile, Logo & Contact Details">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-lg font-semibold">
                {profile.logoText || "TF"}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">
                  Logo Monogram (1–3 characters)
                </label>
                <input
                  maxLength={3}
                  value={profile.logoText}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      logoText: e.target.value.toUpperCase(),
                    })
                  }
                  className={inputCls + " max-w-[120px]"}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["agencyName", "Agency Name"],
                  ["tagline", "Tagline"],
                  ["contactEmail", "Contact Email"],
                  ["contactPhone", "Contact Phone"],
                  ["website", "Website"],
                  ["address", "Address"],
                ] as const
              ).map(([k, l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium mb-1">{l}</label>
                  <input
                    value={profile[k]}
                    onChange={(e) =>
                      setProfile({ ...profile, [k]: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 mt-4">
              <SavedBadge k="profile" />
              <button
                type="button"
                onClick={() => {
                  if (!profile.agencyName.trim()) return;
                  updateSettings(profile);
                  flash("profile");
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              >
                Save Profile
              </button>
            </div>
          </Section>

          <Section
            title="Regional Defaults"
            desc="Default currency is used to normalize all multi-currency reporting."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Default Currency
                </label>
                <select
                  value={s.defaultCurrency}
                  onChange={(e) => {
                    updateSettings({
                      defaultCurrency: e.target.value as CurrencyCode,
                    });
                    flash("regional");
                  }}
                  className={inputCls}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Date Format
                </label>
                <select
                  value={s.dateFormat}
                  onChange={(e) => {
                    updateSettings({
                      dateFormat: e.target
                        .value as AgencySettings["dateFormat"],
                    });
                    flash("regional");
                  }}
                  className={inputCls}
                >
                  <option value="MMM DD, YYYY">MMM DD, YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
            <div className="mt-2 text-right">
              <SavedBadge k="regional" />
            </div>
          </Section>

          <Section
            title="Team Permissions"
            desc="Enforced on both the server API and Supabase Row Level Security policies."
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
                  <th className="text-left py-2">Permission</th>
                  {(["Admin", "Manager", "Team Member"] as UserRole[]).map(
                    (r) => (
                      <th key={r} className="py-2 text-center">
                        {r}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {permLabels.map((p) => (
                  <tr
                    key={p.key}
                    className="border-b border-neutral-50 dark:border-neutral-800/60"
                  >
                    <td className="py-2">{p.label}</td>
                    {(["Admin", "Manager", "Team Member"] as UserRole[]).map(
                      (r) => {
                        const locked = r === "Admin" && p.key === "settings";
                        return (
                          <td key={r} className="text-center">
                            <input
                              type="checkbox"
                              disabled={locked}
                              checked={s.rolePermissions[r][p.key]}
                              onChange={(e) =>
                                updateSettings({
                                  rolePermissions: {
                                    ...s.rolePermissions,
                                    [r]: {
                                      ...s.rolePermissions[r],
                                      [p.key]: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          </td>
                        );
                      }
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Notification Preferences">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {notifLabels.map((n) => (
                <label
                  key={n.key}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs cursor-pointer"
                >
                  {n.label}
                  <input
                    type="checkbox"
                    checked={s.notificationPreferences[n.key]}
                    onChange={(e) =>
                      updateSettings({
                        notificationPreferences: {
                          ...s.notificationPreferences,
                          [n.key]: e.target.checked,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section
            title="Data Export & Seeded Demo Record Removal"
            desc="Export your workspace data or safely remove seeded DEMO records after verification without touching legitimate user records."
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              >
                <Download className="w-3.5 h-3.5" /> Export Full Workspace
                (JSON)
              </button>
              <button
                type="button"
                disabled={demoCount === 0}
                onClick={() => setConfirmPurgeDemo(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" /> Purge Seeded DEMO Records (
                {demoCount} remaining)
              </button>
            </div>
          </Section>
        </>
      )}

      {/* CONNECT & VERIFY CREDENTIALS MODAL */}
      {activeIntegration && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-semibold">
                  Authenticate {activeIntegration.name}
                </h2>
                <p className="text-neutral-500">
                  Credentials are verified live against the provider API and encrypted via AES-256-GCM.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveIntegration(null)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConnectWithVerifiedCredentials}
              className="space-y-3.5"
            >
              {activeIntegration.provider === "calling" ? (
                <>
                  <div>
                    <label className="block font-medium mb-1">
                      Twilio Account SID *
                    </label>
                    <input
                      required
                      value={credAccountSid}
                      onChange={(e) => setCredAccountSid(e.target.value)}
                      placeholder="AC..."
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">
                      Twilio Auth Token *
                    </label>
                    <input
                      type="password"
                      required
                      value={credAuthToken}
                      onChange={(e) => setCredAuthToken(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">
                      Outbound Caller Phone Number
                    </label>
                    <input
                      value={credFromNumber}
                      onChange={(e) => setCredFromNumber(e.target.value)}
                      placeholder="+14155550100"
                      className={inputCls}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-medium mb-1">
                      Authorized OAuth / System Access Token *
                    </label>
                    <input
                      type="password"
                      required
                      value={credAccessToken}
                      onChange={(e) => setCredAccessToken(e.target.value)}
                      placeholder="Paste live OAuth 2.0 or Graph API access token..."
                      className={inputCls}
                    />
                  </div>
                  {activeIntegration.provider === "whatsapp" && (
                    <div>
                      <label className="block font-medium mb-1">
                        WhatsApp Business Phone Number ID *
                      </label>
                      <input
                        required
                        value={credPhoneNumberId}
                        onChange={(e) => setCredPhoneNumberId(e.target.value)}
                        placeholder="e.g., 109283746510293"
                        className={inputCls}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Stored in encrypted server vault (`integration-secrets.enc.json` / `public.integration_secrets`).
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveIntegration(null)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={integrationBusy === activeIntegration.provider}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                >
                  <Plug className="w-3.5 h-3.5" />
                  {integrationBusy === activeIntegration.provider
                    ? "Verifying with Provider..."
                    : "Verify & Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM PURGE DEMO DATA MODAL */}
      {confirmPurgeDemo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-xs">
            <h3 className="text-sm font-semibold">
              Purge All Seeded DEMO Records?
            </h3>
            <p className="text-neutral-500 mt-1">
              This removes only the initial seeded demo leads, demo clients, demo projects, and demo invoices (`is_demo = true`). All real records you or your team created will be preserved.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmPurgeDemo(false)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await purgeDemoRecords();
                  setConfirmPurgeDemo(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium"
              >
                Purge DEMO Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
