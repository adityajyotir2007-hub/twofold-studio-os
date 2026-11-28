"use client";

import React from "react";
import { useAgency } from "@/context/AgencyContext";
import { ProspectingCapabilities } from "@/types/prospecting";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Database,
  Mail,
  SearchCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

interface IntegrationsPanelProps {
  capabilities: ProspectingCapabilities | null;
}

export function IntegrationsPanel({ capabilities }: IntegrationsPanelProps) {
  const { setActiveSection } = useAgency();

  const cards = [
    {
      title: "Database Storage (Supabase PostgreSQL)",
      icon: Database,
      connected: Boolean(capabilities?.supabaseConfigured),
      statusLabel: capabilities?.supabaseConfigured
        ? "Connected"
        : "Not provisioned",
      description: capabilities?.supabaseConfigured
        ? "Supabase project credentials are active on the server."
        : "No Supabase project or NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is configured. Prospects are currently saved in workspace JSON + browser cache.",
      envVars: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ],
    },
    {
      title: "AI Research & Personalization (Gemini API)",
      icon: Sparkles,
      connected: Boolean(capabilities?.gemini),
      statusLabel: capabilities?.gemini ? "Configured" : "Not configured",
      description:
        "Server-side LLM for website research, opportunity detection, email drafting, and reply classification.",
      envVars: ["GEMINI_API_KEY"],
    },
    {
      title: "Workflow Execution Engine (n8n)",
      icon: Workflow,
      connected: Boolean(capabilities?.n8n),
      statusLabel: capabilities?.n8n
        ? "Configured"
        : "Not configured (0 workflows deployed)",
      description:
        "Signed webhook orchestration for background prospect research, enrichment, reply checks, and call scheduling.",
      envVars: ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_SECRET"],
    },
    {
      title: "Gmail OAuth (Email Outreach & Reply Sync)",
      icon: Mail,
      connected: Boolean(capabilities?.gmail),
      statusLabel: capabilities?.gmail ? "Connected" : "Not connected",
      description:
        "Official Google Workspace OAuth 2.0 integration used for approved outreach sending and reply detection.",
      settingsCta: true,
    },
    {
      title: "Google Calendar (Call Booking Slots)",
      icon: Calendar,
      connected: Boolean(capabilities?.googleCalendar),
      statusLabel: capabilities?.googleCalendar
        ? "Connected"
        : "Not connected",
      description:
        "Official Google Calendar API used to fetch available meeting slots and confirm booked discovery calls.",
      settingsCta: true,
    },
    {
      title: "Contact & Email Enrichment Providers",
      icon: SearchCheck,
      connected: (capabilities?.enrichmentProviders?.length || 0) > 0,
      statusLabel:
        (capabilities?.enrichmentProviders?.length || 0) > 0
          ? capabilities!.enrichmentProviders.join(", ")
          : "None configured",
      description:
        "Verified contact enrichment (e.g. Apollo, Hunter, Clearbit). Until configured, contact verification and discovery remain unavailable and no contact data will ever be fabricated.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 text-xs text-neutral-600 dark:text-neutral-300">
        Integration statuses below are read directly from live server configuration. Providers never appear connected unless valid server credentials are present.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {card.title}
                    </h3>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                      card.connected
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                    }`}
                  >
                    {card.connected ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                    )}
                    {card.statusLabel}
                  </span>
                </div>

                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {card.description}
                </p>
              </div>

              {card.envVars && card.envVars.length > 0 && (
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-1.5">
                  {card.envVars.map((ev) => (
                    <code
                      key={ev}
                      className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 text-[10px] text-neutral-700 dark:text-neutral-300"
                    >
                      {ev}
                    </code>
                  ))}
                </div>
              )}

              {card.settingsCta && (
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setActiveSection("settings")}
                    className="text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
                  >
                    Configure in CRM Settings → Integrations →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
