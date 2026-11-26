"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AgencyDatabaseState,
  AgencyDocument,
  AgencySettings,
  AgencyTask,
  AgencyTemplate,
  Client,
  ColdCallRecord,
  DocumentCategory,
  FinanceRecord,
  ImportJobRecord,
  Lead,
  NavigationSection,
  OutreachActivity,
  OutreachCampaign,
  Project,
  TeamInvitation,
  TeamMember,
  UserRole,
} from "@/types/agency";
import { INITIAL_AGENCY_DATA } from "@/lib/initial-data";
import {
  CONNECTED_CALL_OUTCOMES,
  createDefaultProjectChecklist,
  normalizeOutreachStatus,
} from "@/lib/constants";
import {
  AutoOutreachDispatchResponse,
  buildClientAutoOutreachDispatch,
  detectNewlyAddedSocialChannels,
  extractInstagramHandle,
  formatInstagramProfileUrl,
  SocialOutreachChannel,
} from "@/lib/auto-outreach";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export interface AutoOutreachTriggerOptions {
  enabled?: boolean;
  channels?: SocialOutreachChannel[];
  customMessages?: {
    instagramMessage?: string;
    emailSubject?: string;
    emailBody?: string;
    whatsappMessage?: string;
  };
}

interface ConvertLeadOptions {
  leadId: string;
  servicesPurchased: string[];
  createProject: boolean;
  projectName?: string;
  projectType?: string;
  projectBudget?: number;
  projectDeadline?: string;
}

interface AgencyContextValue {
  db: AgencyDatabaseState;
  isLoading: boolean;
  isAuthenticated: boolean;
  isRealtimeConnected: boolean;
  currentUser: TeamMember;
  activeSection: NavigationSection;
  setActiveSection: (section: NavigationSection) => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  refreshState: () => Promise<void>;

  // Auth & RBAC (Server-Backed)
  loginWithEmail: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: (googleUser?: {
    name: string;
    email: string;
    role?: UserRole;
    title?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  inviteTeamMember: (params: {
    name: string;
    email: string;
    role: UserRole;
    title: string;
    department: string;
  }) => Promise<{ ok: boolean; invitation?: TeamInvitation; error?: string }>;
  acceptInvitation: (params: {
    token: string;
    password: string;
    phone?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; resetToken?: string; error?: string }>;
  confirmPasswordReset: (
    token: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  permissions: {
    finance: boolean;
    settings: boolean;
    team: boolean;
    deleteRecords: boolean;
  };

  // Leads
  addLead: (
    lead: Omit<Lead, "id" | "internalNotes" | "history">,
    autoOutreach?: AutoOutreachTriggerOptions
  ) => Lead;
  updateLead: (
    id: string,
    updates: Partial<Lead>,
    autoOutreach?: AutoOutreachTriggerOptions
  ) => void;
  sendLeadPersonalizedOutreach: (params: {
    leadId: string;
    lead?: Partial<Lead>;
    channels?: SocialOutreachChannel[];
    customMessages?: AutoOutreachTriggerOptions["customMessages"];
  }) => Promise<AutoOutreachDispatchResponse | null>;
  lastAutoOutreachResult: AutoOutreachDispatchResponse | null;
  clearAutoOutreachResult: () => void;
  deleteLead: (id: string) => void;
  bulkUpdateLeads: (ids: string[], updates: Partial<Lead>) => void;
  bulkDeleteLeads: (ids: string[]) => void;
  addLeadNote: (leadId: string, content: string) => void;
  importLeadsWithResolution: (params: {
    rows: Partial<Lead>[];
    duplicateStrategy: "skip" | "update" | "create";
    source: "CSV Upload" | "Google Sheets";
    sourceLabel: string;
  }) => Promise<ImportJobRecord | null>;
  importLeadsFromList: (
    leads: Omit<Lead, "id" | "internalNotes" | "history">[]
  ) => number;
  convertLeadToClient: (
    options: ConvertLeadOptions
  ) => Promise<{ client: Client; project?: Project } | null>;

  // Outreach & Campaigns
  addOutreach: (item: Omit<OutreachActivity, "id">) => OutreachActivity;
  updateOutreach: (id: string, updates: Partial<OutreachActivity>) => void;
  deleteOutreach: (id: string) => void;
  addCampaign: (
    camp: Omit<OutreachCampaign, "id" | "createdAt">
  ) => OutreachCampaign;
  updateCampaign: (id: string, updates: Partial<OutreachCampaign>) => void;
  deleteCampaign: (id: string) => void;

  // Cold Calling (Part 9)
  addColdCall: (
    call: Omit<ColdCallRecord, "id" | "connected" | "createdAt">
  ) => ColdCallRecord;
  updateColdCall: (id: string, updates: Partial<ColdCallRecord>) => void;
  deleteColdCall: (id: string) => void;

  // Clients
  addClient: (
    client: Omit<Client, "id" | "communicationHistory" | "meetingHistory">
  ) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addClientCommunication: (
    clientId: string,
    channel: string,
    summary: string
  ) => void;
  addClientMeeting: (
    clientId: string,
    title: string,
    date: string,
    attendees: string,
    notes: string
  ) => void;

  // Projects
  addProject: (project: Omit<Project, "id" | "checklist">) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  toggleProjectChecklist: (projectId: string, checklistId: string) => void;
  addProjectChecklistItem: (
    projectId: string,
    label: string,
    assignedToId?: string
  ) => void;

  // Tasks
  addTask: (task: Omit<AgencyTask, "id">) => AgencyTask;
  updateTask: (id: string, updates: Partial<AgencyTask>) => void;
  deleteTask: (id: string) => void;

  // Finance
  addFinanceRecord: (record: Omit<FinanceRecord, "id">) => FinanceRecord;
  updateFinanceRecord: (id: string, updates: Partial<FinanceRecord>) => void;
  recordInvoicePayment: (
    id: string,
    additionalAmountPaid: number,
    paymentMethod?: string
  ) => void;
  deleteFinanceRecord: (id: string) => void;

  // Documents
  uploadDocumentFile: (params: {
    file: File;
    title: string;
    category: DocumentCategory;
    folder: string;
    clientId: string;
    projectId: string;
  }) => Promise<AgencyDocument | null>;
  deleteDocument: (id: string) => Promise<void>;

  // Templates
  addTemplate: (
    tpl: Omit<AgencyTemplate, "id" | "usageCount" | "updatedAt">
  ) => AgencyTemplate;
  updateTemplate: (id: string, updates: Partial<AgencyTemplate>) => void;
  duplicateTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  incrementTemplateUsage: (id: string) => void;

  // Team
  addTeamMember: (member: Omit<TeamMember, "id" | "createdAt">) => TeamMember;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => void;
  deleteTeamMember: (id: string) => void;

  // Notifications, Settings & Demo Data Purge
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateSettings: (updates: Partial<AgencySettings>) => void;
  purgeDemoRecords: () => Promise<void>;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

function nowTimestamp(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const LOCAL_CACHE_KEY = "twofold_workspace_cache_v2";
const LOCAL_DELETED_KEY = "twofold_deleted_ids_v2";

const MERGEABLE_COLLECTIONS = [
  "leads",
  "outreach",
  "coldCalls",
  "campaigns",
  "clients",
  "projects",
  "tasks",
  "finance",
  "payments",
  "documents",
  "templates",
] as const;

let clientUidCounter = 0;
function createUniqueId(prefix: string): string {
  clientUidCounter = (clientUidCounter + 1) % 100000;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now()}-${clientUidCounter}-${rand}`;
}

function sanitizeOutreachCollection(
  rawList: OutreachActivity[] | undefined
): OutreachActivity[] {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set<string>();
  const normalized: OutreachActivity[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item) continue;
    let safeId = item.id || createUniqueId("out");
    if (seenIds.has(safeId)) {
      safeId = `${safeId}-${i + 1}-${Math.random().toString(36).slice(2, 5)}`;
    }
    seenIds.add(safeId);
    const dir = item.direction || "Outbound";
    normalized.push({
      ...item,
      id: safeId,
      direction: dir,
      replyStatus: normalizeOutreachStatus(item.replyStatus, dir),
    });
  }

  // Collapse any legacy "-local-" duplicate into its canonical server row while keeping user status edits
  const nonLocal = normalized.filter((o) => !o.id.includes("-local-"));
  const localOnly = normalized.filter((o) => o.id.includes("-local-"));
  if (localOnly.length === 0) return normalized;

  const result = [...nonLocal];
  for (const loc of localOnly) {
    const canonIdx = result.findIndex(
      (c) =>
        c.leadId === loc.leadId &&
        c.communicationChannel === loc.communicationChannel &&
        c.dateSent === loc.dateSent &&
        c.messageContent === loc.messageContent
    );
    if (canonIdx >= 0) {
      const canon = result[canonIdx];
      if (
        (loc.updatedAtMs || 0) > (canon.updatedAtMs || 0) ||
        (loc.replyStatus !== "Message Sent" &&
          canon.replyStatus === "Message Sent")
      ) {
        result[canonIdx] = {
          ...canon,
          replyStatus: loc.replyStatus,
          replyDate: loc.replyDate,
          nextFollowUpDate: loc.nextFollowUpDate,
          outcome: loc.outcome,
          updatedAtMs: Math.max(loc.updatedAtMs || 0, canon.updatedAtMs || 0),
        };
      }
    } else {
      result.unshift(loc);
    }
  }
  return result;
}

function mergeServerAndLocalState(
  server: AgencyDatabaseState,
  local: AgencyDatabaseState,
  deletedIds: Set<string>
): {
  merged: AgencyDatabaseState;
  missingOnServer: Partial<Record<string, { id: string }[]>>;
} {
  const merged: AgencyDatabaseState = { ...server };
  const missingOnServer: Partial<Record<string, { id: string }[]>> = {};

  for (const key of MERGEABLE_COLLECTIONS) {
    const rawServerArr =
      key === "outreach"
        ? (sanitizeOutreachCollection(
            server.outreach
          ) as unknown as { id: string; updatedAtMs?: number }[])
        : ((server[key] as unknown as { id: string; updatedAtMs?: number }[]) ||
          []);
    const rawLocalArr =
      key === "outreach"
        ? (sanitizeOutreachCollection(
            local.outreach
          ) as unknown as { id: string; updatedAtMs?: number }[])
        : ((local[key] as unknown as { id: string; updatedAtMs?: number }[]) ||
          []);

    const serverArr = rawServerArr.filter(
      (item) => item && !deletedIds.has(item.id)
    );
    const localArr = rawLocalArr.filter(
      (item) => item && !deletedIds.has(item.id)
    );

    const serverMap = new Map(serverArr.map((item) => [item.id, item]));
    const missing: { id: string }[] = [];
    const toRehydrate: { id: string }[] = [];

    for (const localItem of localArr) {
      if (!serverMap.has(localItem.id)) {
        // Reconcile legacy local optimistic outreach ("out-*-local-*") with server copy without losing status edits
        if (key === "outreach") {
          const lo = localItem as unknown as OutreachActivity;
          const matchingServerEntry = Array.from(serverMap.values()).find(
            (sEntry) => {
              const so = sEntry as unknown as OutreachActivity;
              return (
                so.leadId === lo.leadId &&
                so.communicationChannel === lo.communicationChannel &&
                so.dateSent === lo.dateSent &&
                so.messageContent === lo.messageContent &&
                (lo.id.includes("-local-") || so.id.includes("-local-"))
              );
            }
          ) as (OutreachActivity & { updatedAtMs?: number }) | undefined;

          if (matchingServerEntry) {
            const localEdited =
              (lo.updatedAtMs || 0) > (matchingServerEntry.updatedAtMs || 0) ||
              (lo.replyStatus !== "Message Sent" &&
                matchingServerEntry.replyStatus === "Message Sent");
            if (localEdited) {
              const upgraded = {
                ...matchingServerEntry,
                replyStatus: lo.replyStatus,
                replyDate: lo.replyDate,
                nextFollowUpDate: lo.nextFollowUpDate,
                outcome: lo.outcome,
                updatedAtMs: Math.max(
                  lo.updatedAtMs || Date.now(),
                  (matchingServerEntry.updatedAtMs || 0) + 1
                ),
              };
              serverMap.set(
                matchingServerEntry.id,
                upgraded as unknown as { id: string; updatedAtMs?: number }
              );
              toRehydrate.push(upgraded as unknown as { id: string });
            }
            continue;
          }
        }
        missing.push(localItem);
        toRehydrate.push(localItem);
      } else {
        const serverItem = serverMap.get(localItem.id)!;
        const localTs = localItem.updatedAtMs || 0;
        const serverTs = serverItem.updatedAtMs || 0;

        if (localTs > serverTs) {
          serverMap.set(localItem.id, localItem);
          toRehydrate.push(localItem);
        } else if (key === "leads" && localTs === serverTs) {
          const sLead = serverItem as unknown as Lead;
          const lLead = localItem as unknown as Lead;
          if ((lLead.history?.length || 0) > (sLead.history?.length || 0)) {
            serverMap.set(localItem.id, localItem);
            toRehydrate.push(localItem);
          }
        }
      }
    }

    if (toRehydrate.length > 0) {
      missingOnServer[key] = toRehydrate;
    }

    (merged[key] as unknown as { id: string }[]) = [
      ...missing,
      ...Array.from(serverMap.values()),
    ];
  }

  return { merged, missingOnServer };
}

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<AgencyDatabaseState>(INITIAL_AGENCY_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRealtimeConnected, setIsRealtimeConnected] =
    useState<boolean>(false);
  const [sessionMember, setSessionMember] = useState<TeamMember | null>(null);
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lastAutoOutreachResult, setLastAutoOutreachResult] =
    useState<AutoOutreachDispatchResponse | null>(null);

  const dbRef = useRef<AgencyDatabaseState>(INITIAL_AGENCY_DATA);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const hydratedCacheRef = useRef<boolean>(false);

  const markIdsDeleted = useCallback((ids: string[]) => {
    for (const id of ids) {
      if (id) deletedIdsRef.current.add(id);
    }
    try {
      window.localStorage.setItem(
        LOCAL_DELETED_KEY,
        JSON.stringify(Array.from(deletedIdsRef.current).slice(-500))
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  // Load cached workspace records on mount so cold Vercel serverless containers never wipe user data
  useEffect(() => {
    try {
      const rawDeleted = window.localStorage.getItem(LOCAL_DELETED_KEY);
      if (rawDeleted) {
        const parsedDel = JSON.parse(rawDeleted) as string[];
        if (Array.isArray(parsedDel)) {
          deletedIdsRef.current = new Set(parsedDel);
        }
      }
      const rawCache = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (rawCache) {
        const cachedDb = JSON.parse(rawCache) as AgencyDatabaseState;
        if (cachedDb && Array.isArray(cachedDb.leads)) {
          dbRef.current = cachedDb;
          setDb((prev) => {
            const { merged } = mergeServerAndLocalState(
              prev,
              cachedDb,
              deletedIdsRef.current
            );
            dbRef.current = merged;
            return merged;
          });
        }
      }
    } catch {
      // ignore cache parse errors
    } finally {
      hydratedCacheRef.current = true;
    }
  }, []);

  // Persist workspace state snapshot locally whenever db changes
  useEffect(() => {
    dbRef.current = db;
    if (!hydratedCacheRef.current) return;
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(db));
    } catch {
      // ignore storage quota errors
    }
  }, [db]);

  const clearAutoOutreachResult = useCallback(() => {
    setLastAutoOutreachResult(null);
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      if (res.ok) {
        const serverData = (await res.json()) as AgencyDatabaseState;
        if (serverData && serverData.teamMembers) {
          let missingToSync: Partial<Record<string, { id: string }[]>> = {};
          setDb((prev) => {
            const { merged, missingOnServer } = mergeServerAndLocalState(
              serverData,
              prev,
              deletedIdsRef.current
            );
            missingToSync = missingOnServer;
            dbRef.current = merged;
            return merged;
          });

          if (Object.keys(missingToSync).length > 0) {
            fetch("/api/transactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "rehydrate_records",
                collections: missingToSync,
                deletedIds: Array.from(deletedIdsRef.current),
              }),
            }).catch(() => {});
          }
        }
      }
    } catch {
      // network error
    }
  }, []);

  // 1. Check server-backed session & fetch state on mount
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const authRes = await fetch("/api/integrations?__auth=1", {
          cache: "no-store",
        });
        if (authRes.ok) {
          const authJson = await authRes.json();
          if (mounted) {
            if (authJson.authenticated && authJson.session?.member) {
              setIsAuthenticated(true);
              setSessionMember(authJson.session.member);
            } else {
              setIsAuthenticated(false);
              setSessionMember(null);
            }
          }
        }
        await refreshState();
      } catch {
        // fallback if initial fetch fails
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [refreshState]);

  // 2. Real-time multi-user subscription (SSE /api/transactions?__mode=realtime + Supabase Realtime)
  useEffect(() => {
    if (!isAuthenticated) return;

    const es = new EventSource("/api/transactions?__mode=realtime");
    es.onopen = () => setIsRealtimeConnected(true);
    es.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === "CONNECTED") {
          setIsRealtimeConnected(true);
          return;
        }
        // Any database change from another user or webhook triggers an immediate state refresh
        refreshState();
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      setIsRealtimeConnected(false);
    };

    // Also subscribe to Supabase Realtime postgres_changes if configured
    let supaChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | null =
      null;
    if (isSupabaseConfigured && supabase) {
      supaChannel = supabase
        .channel("twofold-workspace-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public" },
          () => {
            refreshState();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setIsRealtimeConnected(true);
        });
    }

    return () => {
      es.close();
      if (supaChannel && supabase) {
        supabase.removeChannel(supaChannel);
      }
    };
  }, [isAuthenticated, refreshState]);

  // Load device-local theme preference on mount
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("twofold_theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // Sync theme class with document root and persist per-device in localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      window.localStorage.setItem("twofold_theme", theme);
    } catch {
      // ignore localStorage errors
    }
  }, [theme]);

  const currentUser = useMemo(() => {
    if (sessionMember) {
      return (
        db.teamMembers.find((m) => m.id === sessionMember.id) || sessionMember
      );
    }
    return db.teamMembers[0] || INITIAL_AGENCY_DATA.teamMembers[0];
  }, [db.teamMembers, sessionMember]);

  const permissions = useMemo(() => {
    const roleConfig = db.settings.rolePermissions?.[currentUser.role];
    if (roleConfig) return roleConfig;
    if (currentUser.role === "Admin") {
      return { finance: true, settings: true, team: true, deleteRecords: true };
    }
    if (currentUser.role === "Manager") {
      return {
        finance: true,
        settings: false,
        team: true,
        deleteRecords: true,
      };
    }
    return {
      finance: false,
      settings: false,
      team: false,
      deleteRecords: false,
    };
  }, [currentUser.role, db.settings.rolePermissions]);

  // Helper for granular record API calls
  const apiCreateRecord = useCallback(
    async (collection: string, record: unknown, auditMeta?: unknown) => {
      await fetch(
        `/api/transactions?__collection=${encodeURIComponent(collection)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record, auditMeta }),
        }
      );
      await refreshState();
    },
    [refreshState]
  );

  const apiUpdateRecord = useCallback(
    async (
      collection: string,
      id: string,
      updates: unknown,
      auditMeta?: unknown,
      fallbackRecord?: unknown
    ) => {
      try {
        await fetch(
          `/api/transactions?__collection=${encodeURIComponent(collection)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, updates, auditMeta, fallbackRecord }),
          }
        );
      } catch {
        // local cache preserves optimistic update if offline
      }
    },
    []
  );

  const apiDeleteRecord = useCallback(
    async (collection: string, id: string) => {
      markIdsDeleted([id]);
      await fetch(
        `/api/transactions?__collection=${encodeURIComponent(
          collection
        )}&id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
      await refreshState();
    },
    [markIdsDeleted, refreshState]
  );

  // AUTH OPERATIONS
  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const fallbackMember =
        db.teamMembers.find(
          (m) =>
            m.email.toLowerCase() === cleanEmail ||
            m.name.toLowerCase() === cleanEmail ||
            cleanEmail.includes(m.name.toLowerCase().split(" ")[0])
        ) ||
        INITIAL_AGENCY_DATA.teamMembers.find(
          (m) =>
            m.email.toLowerCase() === cleanEmail ||
            m.name.toLowerCase() === cleanEmail ||
            cleanEmail.includes(m.name.toLowerCase().split(" ")[0])
        );
      const isDefaultPwd =
        password.toLowerCase() === "twofold2026!" ||
        password.toLowerCase() === "twofoldadmin2026!" ||
        password.toLowerCase() === "twofoldmanager2026!" ||
        password.toLowerCase() === "twofoldmember2026!";

      try {
        const res = await fetch("/api/integrations?__auth=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email, password }),
        });
        const text = await res.text();
        let data: { ok?: boolean; error?: string; member?: TeamMember } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          // If server returned non-JSON (e.g. 500 HTML), fallback to local valid accounts
          if (fallbackMember && isDefaultPwd) {
            setSessionMember(fallbackMember);
            setIsAuthenticated(true);
            refreshState();
            return { ok: true };
          }
          return {
            ok: false,
            error: `Server returned status ${res.status}`,
          };
        }
        if (!res.ok || !data.ok || !data.member) {
          if (fallbackMember && isDefaultPwd) {
            setSessionMember(fallbackMember);
            setIsAuthenticated(true);
            refreshState();
            return { ok: true };
          }
          return {
            ok: false,
            error: data.error || `Authentication failed (${res.status})`,
          };
        }
        setSessionMember(data.member);
        setIsAuthenticated(true);
        refreshState();
        return { ok: true };
      } catch (err) {
        if (fallbackMember && isDefaultPwd) {
          setSessionMember(fallbackMember);
          setIsAuthenticated(true);
          refreshState();
          return { ok: true };
        }
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Network error during sign-in",
        };
      }
    },
    [db.teamMembers, refreshState]
  );

  const loginWithGoogle = useCallback(
    async (googleUser?: {
      name: string;
      email: string;
      role?: UserRole;
      title?: string;
    }) => {
      try {
        const userPayload = googleUser || {
          name: "Agency Executive",
          email: "founder@twofold.studio",
          role: "Admin" as UserRole,
          title: "CEO",
        };

        const res = await fetch("/api/integrations?__auth=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "google_login",
            email: userPayload.email,
            name: userPayload.name,
            role: userPayload.role || "Admin",
            title: userPayload.title || "CEO",
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (data.ok && data.member) {
          setSessionMember(data.member);
          setIsAuthenticated(true);
          refreshState();
          return { ok: true };
        }

        // Serverless fallback
        const cleanEmail = userPayload.email.trim().toLowerCase();
        const existingMember = db.teamMembers.find(
          (m) => m.email.toLowerCase() === cleanEmail
        );
        const member: TeamMember = existingMember || {
          id: `tm-${Date.now()}`,
          name: userPayload.name,
          email: cleanEmail,
          role: userPayload.role || "Admin",
          title: userPayload.title || "CEO",
          avatarInitials: userPayload.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "TF",
          phone: "+1 (415) 890-4421",
          department: "Executive Leadership",
          hourlyRate: 185,
          status: "Active",
          dailyTargets: { calls: 10, emails: 20, dms: 10, leadsAdded: 10 },
          isDemo: false,
          createdAt: todayDate(),
        };

        setSessionMember(member);
        setIsAuthenticated(true);
        refreshState();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error ? err.message : "Google authentication error",
        };
      }
    },
    [db.teamMembers, refreshState]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/integrations?__auth=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      // ignore network error on logout
    }
    setIsAuthenticated(false);
    setSessionMember(null);
  }, []);

  const inviteTeamMember = useCallback(
    async (params: {
      name: string;
      email: string;
      role: UserRole;
      title: string;
      department: string;
    }) => {
      try {
        const res = await fetch("/api/integrations?__auth=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "invite", ...params }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error || "Failed to send invitation",
          };
        }
        await refreshState();
        return { ok: true, invitation: data.invitation };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to send invitation",
        };
      }
    },
    [refreshState]
  );

  const acceptInvitation = useCallback(
    async (params: { token: string; password: string; phone?: string }) => {
      try {
        const res = await fetch("/api/integrations?__auth=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept_invite", ...params }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error || "Failed to accept invitation",
          };
        }
        setSessionMember(data.member);
        setIsAuthenticated(true);
        refreshState();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to accept invitation",
        };
      }
    },
    [refreshState]
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/integrations?__auth=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forgot_password", email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || "Reset request failed" };
      }
      return { ok: true, resetToken: data.resetToken };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Reset request failed",
      };
    }
  }, []);

  const confirmPasswordReset = useCallback(
    async (token: string, newPassword: string) => {
      try {
        const res = await fetch("/api/integrations?__auth=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reset_password",
            token,
            newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || "Password reset failed" };
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Password reset failed",
        };
      }
    },
    []
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem("twofold_theme", next);
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  }, []);

  const sendLeadPersonalizedOutreach = useCallback(
    async (params: {
      leadId: string;
      lead?: Partial<Lead>;
      channels?: SocialOutreachChannel[];
      customMessages?: AutoOutreachTriggerOptions["customMessages"];
    }): Promise<AutoOutreachDispatchResponse | null> => {
      const currentDb = dbRef.current;
      const existingLead = currentDb.leads.find((l) => l.id === params.leadId);
      const mergedLead: Partial<Lead> = {
        ...(existingLead || {}),
        ...(params.lead || {}),
        id: params.leadId,
      };

      // 1. Instant 0ms client-side generation & optimistic state update so modal opens immediately
      const immediate = buildClientAutoOutreachDispatch({
        leadId: params.leadId,
        lead: mergedLead,
        channels: params.channels,
        templates: currentDb.templates || [],
        actorId: currentUser.id,
        senderName: currentUser.name,
        agencyName: currentDb.settings?.agencyName || "Twofold Studio",
        customMessages: params.customMessages,
      });

      if (immediate.response.results.length > 0) {
        setLastAutoOutreachResult(immediate.response);
        const channelLabels = immediate.response.results
          .map((r) => r.label)
          .join(", ");
        setDb((prev) => ({
          ...prev,
          outreach: [...immediate.activities, ...prev.outreach],
          leads: prev.leads.map((l) => {
            if (l.id !== params.leadId) return l;
            return {
              ...l,
              status:
                l.status === "New" || l.status === "Qualified"
                  ? "Contacted"
                  : l.status,
              lastContacted: todayDate(),
              history: [
                {
                  id: `lh-auto-${Date.now()}`,
                  action: `Prepared personalized outreach via ${channelLabels}`,
                  actorName: currentUser.name,
                  timestamp: nowTimestamp(),
                },
                ...(l.history || []),
              ],
            };
          }),
        }));
      }

      const clientOutreachIds: Partial<Record<SocialOutreachChannel, string>> =
        {};
      for (const r of immediate.response.results) {
        clientOutreachIds[r.channel] = r.outreachId;
      }

      // 2. Background server sync & live API send (if Gmail / WhatsApp Cloud API connected)
      try {
        const res = await fetch("/api/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "auto_outreach_lead",
            leadId: params.leadId,
            lead: mergedLead,
            channels: params.channels,
            clientOutreachIds,
            customMessages: params.customMessages,
          }),
        });
        if (!res.ok) return immediate.response;
        const serverRes = (await res.json()) as AutoOutreachDispatchResponse;
        if (serverRes.ok && serverRes.results && serverRes.results.length > 0) {
          setLastAutoOutreachResult(serverRes);
          const apiSentById = new Map(
            serverRes.results
              .filter((r) => r.sentViaApi && r.outreachId)
              .map((r) => [r.outreachId, r])
          );
          if (apiSentById.size > 0) {
            setDb((prev) => ({
              ...prev,
              outreach: prev.outreach.map((o) => {
                const apiMatch = apiSentById.get(o.id);
                if (!apiMatch) return o;
                return {
                  ...o,
                  source: "api",
                  outcome: `Auto-sent via ${apiMatch.label} API (${apiMatch.target})`,
                };
              }),
            }));
          }
        }
        return serverRes;
      } catch {
        return immediate.response;
      }
    },
    [currentUser.id, currentUser.name]
  );

  // LEADS CRUD
  const addLead = useCallback(
    (
      leadInput: Omit<Lead, "id" | "internalNotes" | "history">,
      autoOutreach?: AutoOutreachTriggerOptions
    ) => {
      const igHandle = extractInstagramHandle(
        leadInput.instagramUrl || leadInput.instagramHandle
      );
      const normalizedInstagramUrl = igHandle
        ? formatInstagramProfileUrl(leadInput.instagramUrl)
        : leadInput.instagramUrl;

      const detectedChannels = detectNewlyAddedSocialChannels(null, {
        ...leadInput,
        instagramUrl: normalizedInstagramUrl,
        instagramHandle: igHandle,
      });
      const channelsToSend =
        autoOutreach?.enabled === false
          ? []
          : autoOutreach?.channels ?? detectedChannels;

      const newLead: Lead = {
        ...leadInput,
        instagramUrl: normalizedInstagramUrl,
        instagramHandle: igHandle || undefined,
        status:
          channelsToSend.length > 0 &&
          (leadInput.status === "New" || leadInput.status === "Qualified")
            ? "Contacted"
            : leadInput.status,
        lastContacted:
          channelsToSend.length > 0
            ? todayDate()
            : leadInput.lastContacted || "",
        id: `lead-${Date.now()}`,
        internalNotes: [],
        history: [
          {
            id: `lh-${Date.now()}`,
            action: `Lead created (${leadInput.leadSource})`,
            actorName: currentUser.name,
            timestamp: nowTimestamp(),
          },
        ],
        isDemo: false,
      };
      setDb((prev) => ({ ...prev, leads: [newLead, ...prev.leads] }));
      apiCreateRecord("leads", newLead, {
        entityType: "Lead",
        entityName: newLead.businessName,
        details: `Created lead ${newLead.businessName} (${newLead.industry}, ${newLead.country}).`,
        notification: {
          type: "New Lead",
          title: `New Lead: ${newLead.businessName}`,
          message: `${newLead.contactPerson} — Est. $${newLead.estimatedProjectValue.toLocaleString()}`,
          section: "leads",
          entityId: newLead.id,
        },
      }).then(() => {
        if (channelsToSend.length > 0) {
          sendLeadPersonalizedOutreach({
            leadId: newLead.id,
            lead: newLead,
            channels: channelsToSend,
            customMessages: autoOutreach?.customMessages,
          });
        }
      });
      return newLead;
    },
    [apiCreateRecord, currentUser.name, sendLeadPersonalizedOutreach]
  );

  const updateLead = useCallback(
    (
      id: string,
      updates: Partial<Lead>,
      autoOutreach?: AutoOutreachTriggerOptions
    ) => {
      const existing = db.leads.find((l) => l.id === id);

      const patchedUpdates: Partial<Lead> = { ...updates };
      if (updates.instagramUrl !== undefined) {
        const igHandle = extractInstagramHandle(updates.instagramUrl);
        patchedUpdates.instagramUrl = igHandle
          ? formatInstagramProfileUrl(updates.instagramUrl)
          : updates.instagramUrl;
        patchedUpdates.instagramHandle = igHandle || undefined;
      }

      const mergedCandidate: Partial<Lead> = {
        ...(existing || {}),
        ...patchedUpdates,
      };

      const newlyAddedChannels = detectNewlyAddedSocialChannels(
        existing,
        mergedCandidate
      );
      const channelsToSend =
        autoOutreach?.enabled === false
          ? []
          : autoOutreach?.channels ?? newlyAddedChannels;

      if (
        channelsToSend.length > 0 &&
        existing &&
        (mergedCandidate.status === "New" ||
          mergedCandidate.status === "Qualified") &&
        !updates.status
      ) {
        patchedUpdates.status = "Contacted";
        patchedUpdates.lastContacted = todayDate();
      }

      const statusChanged =
        existing &&
        patchedUpdates.status &&
        patchedUpdates.status !== existing.status;
      const nextHistory = existing
        ? statusChanged
          ? [
              {
                id: `lh-${Date.now()}`,
                action: `Status updated from ${existing.status} to ${patchedUpdates.status}`,
                actorName: currentUser.name,
                timestamp: nowTimestamp(),
              },
              ...existing.history,
            ]
          : existing.history
        : undefined;

      const finalUpdates = nextHistory
        ? { ...patchedUpdates, history: nextHistory }
        : patchedUpdates;

      setDb((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === id ? { ...l, ...finalUpdates } : l
        ),
      }));

      apiUpdateRecord("leads", id, finalUpdates, {
        entityType: "Lead",
        entityName: existing?.businessName || id,
        details: statusChanged
          ? `Updated lead status to ${patchedUpdates.status}.`
          : `Updated lead profile.`,
      }).then(() => {
        if (channelsToSend.length > 0) {
          sendLeadPersonalizedOutreach({
            leadId: id,
            lead: { ...(existing || {}), ...finalUpdates, id },
            channels: channelsToSend,
            customMessages: autoOutreach?.customMessages,
          });
        }
      });
    },
    [
      apiUpdateRecord,
      currentUser.name,
      db.leads,
      sendLeadPersonalizedOutreach,
    ]
  );

  const deleteLead = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        leads: prev.leads.filter((l) => l.id !== id),
      }));
      apiDeleteRecord("leads", id);
    },
    [apiDeleteRecord]
  );

  const bulkUpdateLeads = useCallback(
    (ids: string[], updates: Partial<Lead>) => {
      fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bulk_leads_update",
          ids,
          updates,
        }),
      }).then(() => refreshState());
    },
    [refreshState]
  );

  const bulkDeleteLeads = useCallback(
    (ids: string[]) => {
      markIdsDeleted(ids);
      setDb((prev) => ({
        ...prev,
        leads: prev.leads.filter((l) => !ids.includes(l.id)),
      }));
      fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bulk_leads_delete",
          ids,
        }),
      }).then(() => refreshState());
    },
    [markIdsDeleted, refreshState]
  );

  const addLeadNote = useCallback(
    (leadId: string, content: string) => {
      if (!content.trim()) return;
      const existing = db.leads.find((l) => l.id === leadId);
      if (!existing) return;
      const note = {
        id: `ln-${Date.now()}`,
        authorId: currentUser.id,
        authorName: currentUser.name,
        content: content.trim(),
        createdAt: nowTimestamp(),
      };
      const historyItem = {
        id: `lh-${Date.now()}`,
        action: `Added note: "${content.trim().slice(0, 60)}"`,
        actorName: currentUser.name,
        timestamp: nowTimestamp(),
      };
      updateLead(leadId, {
        internalNotes: [note, ...existing.internalNotes],
        history: [historyItem, ...existing.history],
      });
    },
    [currentUser.id, currentUser.name, db.leads, updateLead]
  );

  const importLeadsWithResolution = useCallback(
    async (params: {
      rows: Partial<Lead>[];
      duplicateStrategy: "skip" | "update" | "create";
      source: "CSV Upload" | "Google Sheets";
      sourceLabel: string;
    }) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "import_leads",
          ...params,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      await refreshState();
      return (data.importJob as ImportJobRecord) || null;
    },
    [refreshState]
  );

  const importLeadsFromList = useCallback(
    (rows: Omit<Lead, "id" | "internalNotes" | "history">[]) => {
      if (!rows.length) return 0;
      importLeadsWithResolution({
        rows,
        duplicateStrategy: "skip",
        source: "CSV Upload",
        sourceLabel: "CSV Import",
      });
      return rows.length;
    },
    [importLeadsWithResolution]
  );

  const convertLeadToClient = useCallback(
    async (options: ConvertLeadOptions) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "convert_lead",
          ...options,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      await refreshState();
      return {
        client: data.client as Client,
        project: data.project as Project | undefined,
      };
    },
    [refreshState]
  );

  // OUTREACH & CAMPAIGNS CRUD
  const addOutreach = useCallback(
    (itemInput: Omit<OutreachActivity, "id">) => {
      const dir = itemInput.direction || "Outbound";
      const newItem: OutreachActivity = {
        ...itemInput,
        id: createUniqueId("out"),
        memberId: itemInput.memberId || currentUser.id,
        occurredAt: itemInput.occurredAt || nowTimestamp(),
        direction: dir,
        source: itemInput.source || "manual",
        deliveryStatus: itemInput.deliveryStatus || "sent",
        replyStatus: normalizeOutreachStatus(itemInput.replyStatus, dir),
        updatedAtMs: Date.now(),
        isDemo: false,
      };
      setDb((prev) => ({ ...prev, outreach: [newItem, ...prev.outreach] }));
      apiCreateRecord("outreach", newItem, {
        entityType: "Outreach",
        entityName: newItem.leadName,
        details: `Logged ${newItem.communicationChannel} outreach (${newItem.replyStatus}).`,
      });
      return newItem;
    },
    [apiCreateRecord, currentUser.id]
  );

  const updateOutreach = useCallback(
    (id: string, updates: Partial<OutreachActivity>) => {
      const nowMs = Date.now();
      const existingOutreach = dbRef.current.outreach.find((o) => o.id === id);
      const normalizedUpdates: Partial<OutreachActivity> = {
        ...updates,
        ...(updates.replyStatus !== undefined
          ? {
              replyStatus: normalizeOutreachStatus(
                updates.replyStatus,
                updates.direction || existingOutreach?.direction
              ),
            }
          : {}),
        updatedAtMs: nowMs,
      };
      const fallbackOutreach = existingOutreach
        ? { ...existingOutreach, ...normalizedUpdates, id }
        : undefined;

      // Map outreach milestone status to parent Lead CRM status (without touching any other outreach rows)
      let mappedLeadStatus: Lead["status"] | null = null;
      if (normalizedUpdates.replyStatus) {
        switch (normalizedUpdates.replyStatus) {
          case "Replied":
            mappedLeadStatus = "Replied";
            break;
          case "Interested":
          case "Demo Shared":
            mappedLeadStatus = "Interested";
            break;
          case "Meeting Booked":
            mappedLeadStatus = "Meeting Scheduled";
            break;
          case "Converted":
            mappedLeadStatus = "Converted";
            break;
          case "Not Interested":
            mappedLeadStatus = "Not Interested";
            break;
          default:
            mappedLeadStatus = null;
        }
      }

      let updatedLeadSnapshot: Lead | null = null;

      setDb((prev) => {
        const nextOutreach = prev.outreach.map((o) =>
          o.id === id ? { ...o, ...normalizedUpdates, id } : o
        );

        let nextLeads = prev.leads;
        if (mappedLeadStatus && existingOutreach?.leadId) {
          nextLeads = prev.leads.map((l) => {
            if (l.id !== existingOutreach.leadId) return l;
            if (l.status === "Converted" && mappedLeadStatus !== "Converted") {
              return l;
            }
            if (l.status === mappedLeadStatus) return l;
            const nextLead: Lead = {
              ...l,
              status: mappedLeadStatus,
              lastContacted: todayDate(),
              history: [
                {
                  id: createUniqueId("lh"),
                  action: `Outreach status (${existingOutreach.communicationChannel}) updated to ${normalizedUpdates.replyStatus}`,
                  actorName: currentUser.name,
                  timestamp: nowTimestamp(),
                },
                ...(l.history || []),
              ],
            };
            updatedLeadSnapshot = nextLead;
            return nextLead;
          });
        }

        const nextState = {
          ...prev,
          outreach: nextOutreach,
          leads: nextLeads,
        };
        dbRef.current = nextState;
        return nextState;
      });

      apiUpdateRecord(
        "outreach",
        id,
        normalizedUpdates,
        {
          entityType: "Outreach",
          entityName: existingOutreach?.leadName || id,
          details: normalizedUpdates.replyStatus
            ? `Updated ${
                existingOutreach?.communicationChannel || "outreach"
              } reply status to ${normalizedUpdates.replyStatus}.`
            : `Updated outreach record.`,
        },
        fallbackOutreach
      );

      if (updatedLeadSnapshot) {
        const snap = updatedLeadSnapshot as Lead;
        apiUpdateRecord(
          "leads",
          snap.id,
          {
            status: snap.status,
            lastContacted: snap.lastContacted,
            history: snap.history,
          },
          {
            entityType: "Lead",
            entityName: snap.businessName,
            details: `Synced lead stage to ${snap.status} from outreach reply status.`,
          },
          snap
        );
      }
    },
    [apiUpdateRecord, currentUser.name]
  );

  const deleteOutreach = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        outreach: prev.outreach.filter((o) => o.id !== id),
      }));
      apiDeleteRecord("outreach", id);
    },
    [apiDeleteRecord]
  );

  const addCampaign = useCallback(
    (campInput: Omit<OutreachCampaign, "id" | "createdAt">) => {
      const newCamp: OutreachCampaign = {
        ...campInput,
        id: `camp-${Date.now()}`,
        createdAt: todayDate(),
        isDemo: false,
      };
      setDb((prev) => ({
        ...prev,
        campaigns: [newCamp, ...(prev.campaigns || [])],
      }));
      apiCreateRecord("campaigns", newCamp, {
        entityType: "Campaign",
        entityName: newCamp.name,
        details: `Created outreach campaign "${newCamp.name}" targeting ${newCamp.targetIndustry} in ${newCamp.targetCity}, ${newCamp.targetCountry}.`,
      });
      return newCamp;
    },
    [apiCreateRecord]
  );

  const updateCampaign = useCallback(
    (id: string, updates: Partial<OutreachCampaign>) => {
      setDb((prev) => ({
        ...prev,
        campaigns: (prev.campaigns || []).map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
      apiUpdateRecord("campaigns", id, updates, {
        entityType: "Campaign",
        entityName: id,
        details: `Updated campaign configuration.`,
      });
    },
    [apiUpdateRecord]
  );

  const deleteCampaign = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        campaigns: (prev.campaigns || []).filter((c) => c.id !== id),
      }));
      apiDeleteRecord("campaigns", id);
    },
    [apiDeleteRecord]
  );

  // COLD CALLS CRUD (Part 9)
  const addColdCall = useCallback(
    (callInput: Omit<ColdCallRecord, "id" | "connected" | "createdAt">) => {
      const newCall: ColdCallRecord = {
        ...callInput,
        id: `call-${Date.now()}`,
        connected: CONNECTED_CALL_OUTCOMES.has(callInput.outcome),
        createdAt: nowTimestamp(),
        isDemo: false,
      };
      setDb((prev) => ({
        ...prev,
        coldCalls: [newCall, ...(prev.coldCalls || [])],
      }));
      apiCreateRecord("coldCalls", newCall, {
        entityType: "Cold Call",
        entityName: newCall.businessName,
        details: `Logged cold call to ${newCall.businessName} (${newCall.outcome}).`,
      });
      return newCall;
    },
    [apiCreateRecord]
  );

  const updateColdCall = useCallback(
    (id: string, updates: Partial<ColdCallRecord>) => {
      const withConn = updates.outcome
        ? {
            ...updates,
            connected: CONNECTED_CALL_OUTCOMES.has(updates.outcome),
          }
        : updates;
      setDb((prev) => ({
        ...prev,
        coldCalls: (prev.coldCalls || []).map((c) =>
          c.id === id ? { ...c, ...withConn } : c
        ),
      }));
      apiUpdateRecord("coldCalls", id, withConn, {
        entityType: "Cold Call",
        entityName: id,
        details: `Updated cold call record.`,
      });
    },
    [apiUpdateRecord]
  );

  const deleteColdCall = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        coldCalls: (prev.coldCalls || []).filter((c) => c.id !== id),
      }));
      apiDeleteRecord("coldCalls", id);
    },
    [apiDeleteRecord]
  );

  // CLIENTS CRUD
  const addClient = useCallback(
    (
      clientInput: Omit<Client, "id" | "communicationHistory" | "meetingHistory">
    ) => {
      const newClient: Client = {
        ...clientInput,
        id: `client-${Date.now()}`,
        communicationHistory: [
          {
            id: `cc-${Date.now()}`,
            date: todayDate(),
            channel: "Account Created",
            summary: `Client profile created by ${currentUser.name}.`,
            authorName: currentUser.name,
          },
        ],
        meetingHistory: [],
        isDemo: false,
      };
      setDb((prev) => ({ ...prev, clients: [newClient, ...prev.clients] }));
      apiCreateRecord("clients", newClient, {
        entityType: "Client",
        entityName: newClient.businessName,
        details: `Created client account ${newClient.businessName}.`,
      });
      return newClient;
    },
    [apiCreateRecord, currentUser.name]
  );

  const updateClient = useCallback(
    (id: string, updates: Partial<Client>) => {
      setDb((prev) => ({
        ...prev,
        clients: prev.clients.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
      apiUpdateRecord("clients", id, updates, {
        entityType: "Client",
        entityName: id,
        details: `Updated client profile.`,
      });
    },
    [apiUpdateRecord]
  );

  const deleteClient = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        clients: prev.clients.filter((c) => c.id !== id),
      }));
      apiDeleteRecord("clients", id);
    },
    [apiDeleteRecord]
  );

  const addClientCommunication = useCallback(
    (clientId: string, channel: string, summary: string) => {
      if (!summary.trim()) return;
      const client = db.clients.find((c) => c.id === clientId);
      if (!client) return;
      updateClient(clientId, {
        communicationHistory: [
          {
            id: `cc-${Date.now()}`,
            date: todayDate(),
            channel,
            summary: summary.trim(),
            authorName: currentUser.name,
          },
          ...client.communicationHistory,
        ],
      });
    },
    [currentUser.name, db.clients, updateClient]
  );

  const addClientMeeting = useCallback(
    (
      clientId: string,
      title: string,
      date: string,
      attendees: string,
      notes: string
    ) => {
      if (!title.trim()) return;
      const client = db.clients.find((c) => c.id === clientId);
      if (!client) return;
      updateClient(clientId, {
        meetingHistory: [
          {
            id: `cm-${Date.now()}`,
            date: date || todayDate(),
            title: title.trim(),
            attendees: attendees.trim() || currentUser.name,
            notes: notes.trim(),
          },
          ...client.meetingHistory,
        ],
      });
    },
    [currentUser.name, db.clients, updateClient]
  );

  // PROJECTS CRUD
  const addProject = useCallback(
    (projectInput: Omit<Project, "id" | "checklist">) => {
      const newProject: Project = {
        ...projectInput,
        id: `proj-${Date.now()}`,
        checklist: createDefaultProjectChecklist(),
        isDemo: false,
      };
      setDb((prev) => ({ ...prev, projects: [newProject, ...prev.projects] }));
      apiCreateRecord("projects", newProject, {
        entityType: "Project",
        entityName: newProject.projectName,
        details: `Created project "${newProject.projectName}" (${newProject.projectStatus}).`,
      });
      return newProject;
    },
    [apiCreateRecord]
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Project>) => {
      const existing = db.projects.find((p) => p.id === id);
      const finalUpdates = {
        ...updates,
        progressPercentage:
          updates.projectStatus === "Completed"
            ? 100
            : updates.progressPercentage ?? existing?.progressPercentage ?? 0,
      };
      setDb((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === id ? { ...p, ...finalUpdates } : p
        ),
      }));
      apiUpdateRecord("projects", id, finalUpdates, {
        entityType: "Project",
        entityName: existing?.projectName || id,
        details: `Updated project (${finalUpdates.progressPercentage}%).`,
      });
    },
    [apiUpdateRecord, db.projects]
  );

  const deleteProject = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
      }));
      apiDeleteRecord("projects", id);
    },
    [apiDeleteRecord]
  );

  const toggleProjectChecklist = useCallback(
    (projectId: string, checklistId: string) => {
      const proj = db.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const nextChecklist = proj.checklist.map((item) =>
        item.id === checklistId
          ? { ...item, completed: !item.completed, updatedAt: todayDate() }
          : item
      );
      const completedCount = nextChecklist.filter((c) => c.completed).length;
      const autoProgress = Math.round(
        (completedCount / Math.max(1, nextChecklist.length)) * 100
      );
      updateProject(projectId, {
        checklist: nextChecklist,
        progressPercentage: autoProgress,
        projectStatus:
          autoProgress === 100 ? "Completed" : proj.projectStatus,
      });
    },
    [db.projects, updateProject]
  );

  const addProjectChecklistItem = useCallback(
    (projectId: string, label: string, assignedToId?: string) => {
      if (!label.trim()) return;
      const proj = db.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const nextChecklist = [
        ...proj.checklist,
        {
          id: `chk-${Date.now()}`,
          label: label.trim(),
          completed: false,
          assignedToId: assignedToId || currentUser.id,
        },
      ];
      const completedCount = nextChecklist.filter((c) => c.completed).length;
      const autoProgress = Math.round(
        (completedCount / Math.max(1, nextChecklist.length)) * 100
      );
      updateProject(projectId, {
        checklist: nextChecklist,
        progressPercentage: autoProgress,
      });
    },
    [currentUser.id, db.projects, updateProject]
  );

  // TASKS CRUD
  const addTask = useCallback(
    (taskInput: Omit<AgencyTask, "id">) => {
      const newTask: AgencyTask = {
        ...taskInput,
        id: `task-${Date.now()}`,
        isDemo: false,
      };
      setDb((prev) => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
      apiCreateRecord("tasks", newTask, {
        entityType: "Task",
        entityName: newTask.taskTitle,
        details: `Assigned task "${newTask.taskTitle}" (due ${newTask.dueDate}).`,
        notification: {
          type: "Task Assigned",
          recipientMemberId: newTask.assignedPersonId,
          title: `Task Assigned: ${newTask.taskTitle}`,
          message: `Priority: ${newTask.priority} · Due ${newTask.dueDate}`,
          section: "tasks",
          entityId: newTask.id,
        },
      });
      return newTask;
    },
    [apiCreateRecord]
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<AgencyTask>) => {
      const existing = db.tasks.find((t) => t.id === id);
      const completedNow =
        updates.status === "Completed" && existing?.status !== "Completed";
      setDb((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
      apiUpdateRecord("tasks", id, updates, {
        action: completedNow ? "completed" : "edited",
        entityType: "Task",
        entityName: existing?.taskTitle || id,
        details: completedNow
          ? `Completed task "${existing?.taskTitle}".`
          : `Updated task status.`,
      });
    },
    [apiUpdateRecord, db.tasks]
  );

  const deleteTask = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
      }));
      apiDeleteRecord("tasks", id);
    },
    [apiDeleteRecord]
  );

  // FINANCE CRUD
  const addFinanceRecord = useCallback(
    (recordInput: Omit<FinanceRecord, "id">) => {
      const newRecord: FinanceRecord = {
        ...recordInput,
        id: `fin-${Date.now()}`,
        isDemo: false,
      };
      setDb((prev) => ({ ...prev, finance: [newRecord, ...prev.finance] }));
      apiCreateRecord("finance", newRecord, {
        entityType: newRecord.transactionType,
        entityName: newRecord.invoiceNumber,
        details: `Created ${newRecord.transactionType} ${newRecord.invoiceNumber} (${newRecord.currency} ${newRecord.amount.toLocaleString()}).`,
      });
      return newRecord;
    },
    [apiCreateRecord]
  );

  const updateFinanceRecord = useCallback(
    (id: string, updates: Partial<FinanceRecord>) => {
      setDb((prev) => ({
        ...prev,
        finance: prev.finance.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        ),
      }));
      apiUpdateRecord("finance", id, updates, {
        entityType: "Finance",
        entityName: id,
        details: `Updated financial record.`,
      });
    },
    [apiUpdateRecord]
  );

  const recordInvoicePayment = useCallback(
    (id: string, additionalAmountPaid: number, paymentMethod?: string) => {
      fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "record_payment",
          invoiceId: id,
          amount: additionalAmountPaid,
          paymentMethod,
        }),
      }).then(() => refreshState());
    },
    [refreshState]
  );

  const deleteFinanceRecord = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        finance: prev.finance.filter((f) => f.id !== id),
      }));
      apiDeleteRecord("finance", id);
    },
    [apiDeleteRecord]
  );

  // DOCUMENTS
  const uploadDocumentFile = useCallback(
    async (params: {
      file: File;
      title: string;
      category: DocumentCategory;
      folder: string;
      clientId: string;
      projectId: string;
    }) => {
      const formData = new FormData();
      formData.append("file", params.file);
      formData.append("title", params.title);
      formData.append("category", params.category);
      formData.append("folder", params.folder);
      formData.append("clientId", params.clientId);
      formData.append("projectId", params.projectId);
      formData.append("uploadedById", currentUser.id);

      const res = await fetch("/api/transactions?__mode=documents", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return null;
      const newDoc = (await res.json()) as AgencyDocument;
      await refreshState();
      return newDoc;
    },
    [currentUser.id, refreshState]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      await fetch(
        `/api/transactions?__mode=documents&id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
      await refreshState();
    },
    [refreshState]
  );

  // TEMPLATES
  const addTemplate = useCallback(
    (tplInput: Omit<AgencyTemplate, "id" | "usageCount" | "updatedAt">) => {
      const newTpl: AgencyTemplate = {
        ...tplInput,
        id: `tpl-${Date.now()}`,
        usageCount: 0,
        updatedAt: todayDate(),
        isDemo: false,
      };
      setDb((prev) => ({ ...prev, templates: [newTpl, ...prev.templates] }));
      apiCreateRecord("templates", newTpl);
      return newTpl;
    },
    [apiCreateRecord]
  );

  const updateTemplate = useCallback(
    (id: string, updates: Partial<AgencyTemplate>) => {
      const withDate = { ...updates, updatedAt: todayDate() };
      setDb((prev) => ({
        ...prev,
        templates: prev.templates.map((t) =>
          t.id === id ? { ...t, ...withDate } : t
        ),
      }));
      apiUpdateRecord("templates", id, withDate);
    },
    [apiUpdateRecord]
  );

  const duplicateTemplate = useCallback(
    (id: string) => {
      const orig = db.templates.find((t) => t.id === id);
      if (!orig) return;
      addTemplate({
        title: `${orig.title} (Copy)`,
        category: orig.category,
        subjectOrHook: orig.subjectOrHook,
        content: orig.content,
        tags: orig.tags,
      });
    },
    [addTemplate, db.templates]
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        templates: prev.templates.filter((t) => t.id !== id),
      }));
      apiDeleteRecord("templates", id);
    },
    [apiDeleteRecord]
  );

  const incrementTemplateUsage = useCallback(
    (id: string) => {
      const orig = db.templates.find((t) => t.id === id);
      if (!orig) return;
      updateTemplate(id, { usageCount: orig.usageCount + 1 });
    },
    [db.templates, updateTemplate]
  );

  // TEAM MEMBERS
  const addTeamMember = useCallback(
    (memberInput: Omit<TeamMember, "id" | "createdAt">) => {
      const newMember: TeamMember = {
        ...memberInput,
        id: `tm-${Date.now()}`,
        createdAt: todayDate(),
        isDemo: false,
      };
      setDb((prev) => ({
        ...prev,
        teamMembers: [...prev.teamMembers, newMember],
      }));
      apiCreateRecord("teamMembers", newMember, {
        entityType: "Team Member",
        entityName: newMember.name,
        details: `Added ${newMember.name} (${newMember.role}).`,
      });
      return newMember;
    },
    [apiCreateRecord]
  );

  const updateTeamMember = useCallback(
    (id: string, updates: Partial<TeamMember>) => {
      setDb((prev) => ({
        ...prev,
        teamMembers: prev.teamMembers.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      }));
      apiUpdateRecord("teamMembers", id, updates);
    },
    [apiUpdateRecord]
  );

  const deleteTeamMember = useCallback(
    (id: string) => {
      if (db.teamMembers.length <= 1) return;
      setDb((prev) => ({
        ...prev,
        teamMembers: prev.teamMembers.filter((m) => m.id !== id),
      }));
      apiDeleteRecord("teamMembers", id);
    },
    [apiDeleteRecord, db.teamMembers.length]
  );

  // NOTIFICATIONS & SETTINGS
  const markNotificationRead = useCallback(
    (id: string) => {
      setDb((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
      }));
      apiUpdateRecord("notifications", id, { isRead: true });
    },
    [apiUpdateRecord]
  );

  const markAllNotificationsRead = useCallback(() => {
    setDb((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
    }));
    fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mark_all_notifications_read" }),
    }).catch(() => {});
  }, []);

  const updateSettings = useCallback(
    (updates: Partial<AgencySettings>) => {
      if (updates.themePreference) {
        setTheme(updates.themePreference);
        try {
          window.localStorage.setItem("twofold_theme", updates.themePreference);
        } catch {
          // ignore localStorage errors
        }
      }
      const { themePreference: _ignoredTheme, ...serverUpdates } = updates;
      setDb((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...updates },
      }));
      if (Object.keys(serverUpdates).length > 0) {
        fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "update_settings",
            updates: serverUpdates,
          }),
        }).then(() => refreshState());
      }
    },
    [refreshState]
  );

  const purgeDemoRecords = useCallback(async () => {
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "purge_demo" }),
    });
    await refreshState();
  }, [refreshState]);

  const value = useMemo<AgencyContextValue>(
    () => ({
      db,
      isLoading,
      isAuthenticated,
      isRealtimeConnected,
      currentUser,
      activeSection,
      setActiveSection,
      selectedClientId,
      setSelectedClientId,
      selectedProjectId,
      setSelectedProjectId,
      globalSearchQuery,
      setGlobalSearchQuery,
      theme,
      toggleTheme,
      refreshState,
      loginWithEmail,
      loginWithGoogle,
      logout,
      inviteTeamMember,
      acceptInvitation,
      requestPasswordReset,
      confirmPasswordReset,
      permissions,
      addLead,
      updateLead,
      sendLeadPersonalizedOutreach,
      lastAutoOutreachResult,
      clearAutoOutreachResult,
      deleteLead,
      bulkUpdateLeads,
      bulkDeleteLeads,
      addLeadNote,
      importLeadsWithResolution,
      importLeadsFromList,
      convertLeadToClient,
      addOutreach,
      updateOutreach,
      deleteOutreach,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      addColdCall,
      updateColdCall,
      deleteColdCall,
      addClient,
      updateClient,
      deleteClient,
      addClientCommunication,
      addClientMeeting,
      addProject,
      updateProject,
      deleteProject,
      toggleProjectChecklist,
      addProjectChecklistItem,
      addTask,
      updateTask,
      deleteTask,
      addFinanceRecord,
      updateFinanceRecord,
      recordInvoicePayment,
      deleteFinanceRecord,
      uploadDocumentFile,
      deleteDocument,
      addTemplate,
      updateTemplate,
      duplicateTemplate,
      deleteTemplate,
      incrementTemplateUsage,
      addTeamMember,
      updateTeamMember,
      deleteTeamMember,
      markNotificationRead,
      markAllNotificationsRead,
      updateSettings,
      purgeDemoRecords,
    }),
    [
      db,
      isLoading,
      isAuthenticated,
      isRealtimeConnected,
      currentUser,
      activeSection,
      selectedClientId,
      selectedProjectId,
      globalSearchQuery,
      theme,
      toggleTheme,
      refreshState,
      loginWithEmail,
      loginWithGoogle,
      logout,
      inviteTeamMember,
      acceptInvitation,
      requestPasswordReset,
      confirmPasswordReset,
      permissions,
      addLead,
      updateLead,
      sendLeadPersonalizedOutreach,
      lastAutoOutreachResult,
      clearAutoOutreachResult,
      deleteLead,
      bulkUpdateLeads,
      bulkDeleteLeads,
      addLeadNote,
      importLeadsWithResolution,
      importLeadsFromList,
      convertLeadToClient,
      addOutreach,
      updateOutreach,
      deleteOutreach,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      addColdCall,
      updateColdCall,
      deleteColdCall,
      addClient,
      updateClient,
      deleteClient,
      addClientCommunication,
      addClientMeeting,
      addProject,
      updateProject,
      deleteProject,
      toggleProjectChecklist,
      addProjectChecklistItem,
      addTask,
      updateTask,
      deleteTask,
      addFinanceRecord,
      updateFinanceRecord,
      recordInvoicePayment,
      deleteFinanceRecord,
      uploadDocumentFile,
      deleteDocument,
      addTemplate,
      updateTemplate,
      duplicateTemplate,
      deleteTemplate,
      incrementTemplateUsage,
      addTeamMember,
      updateTeamMember,
      deleteTeamMember,
      markNotificationRead,
      markAllNotificationsRead,
      updateSettings,
      purgeDemoRecords,
    ]
  );

  return (
    <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>
  );
}

export function useAgency() {
  const ctx = useContext(AgencyContext);
  if (!ctx) {
    throw new Error("useAgency must be used inside AgencyProvider");
  }
  return ctx;
}
