# AI Prospecting & Outreach System — Architecture & Integration Blueprint

## 1. Phase 1 Codebase Assessment

### Technology Stack
- **Frontend:** Next.js `16.4.6` App Router (`next build --webpack`), React `19`, TypeScript `5.7`, Tailwind CSS `3.4` (class-based dark mode), `lucide-react`, `recharts`.
- **Validation:** `zod` (`^4.6.7`).
- **Spreadsheet Parsing:** SheetJS (`xlsx` loaded dynamically on the client for `.xlsx`/`.xls`) + RFC-4180 CSV parser (`src/lib/prospecting/parse.ts`).
- **Deployment:** Vercel (`twofold-studio-os.vercel.app`) with auto-deploy from GitHub `main`.

### Current CRM Storage & Tenancy Model
- **Server Persistence:** `src/lib/server-db.ts` reads and writes a JSON state document (`data/agency-db.json` locally, `os.tmpdir()/twofold-studio-data/agency-db.json` on Vercel, which is ephemeral per serverless container).
- **Supabase Status:** Comprehensive SQL migrations exist under `supabase/migrations/` (`workspaces`, `team_members`, `leads`, etc., with generated normalization columns and RLS helpers `is_workspace_member`, `is_workspace_manager_or_admin`, `tg_set_updated_at`), **but the connected Supabase account has 0 provisioned projects** and no `.env.local` exists. `syncRecordToSupabase` is currently a stub. Client persistence across cold Vercel containers relies on `localStorage` caching and `POST /api/transactions` (`rehydrate_records`) in `src/context/AgencyContext.tsx`.
- **Auth & Roles:** Signed HTTP-only cookie `twofold_session` (`src/lib/server-auth.ts`) verified via `getSessionFromRequest(req)`, resolving `{ member, role, workspaceId }` (currently `"ws-twofold-studio"`), with RBAC helpers (`canMemberDeleteRecords`, `canMemberManageSettings`, etc.).

### How AI Prospecting Connects to the CRM
- **Workspace Isolation:** Every `Prospect` and `ProspectImport` carries `workspaceId` matching `session.workspaceId`, and `/api/prospecting` enforces session authentication (`401` when unauthenticated — no `tm-1` fallback) and workspace filtering on every read and write.
- **Deduplication Against Existing CRM Leads:** During import review and server import, prospects are checked against existing workspace prospects **and** existing `db.leads` (`DEFAULT_CRM_WORKSPACE = "ws-twofold-studio"`), flagging matches with a non-blocking `"Already exists in CRM"` warning and linking `crmLeadId`.
- **Promotion to CRM (`send_to_crm`):** Promoting a prospect links to an existing matching CRM lead via `detectLeadDuplicate` / Instagram handle match or inserts a new `Lead` via `insertRecord("leads", ...)` without creating duplicate CRM leads.

### Missing Integrations & Required Credentials
1. **Supabase PostgreSQL Project:** Provision a project and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, then run migrations in `supabase/migrations/` (including `20261127000001_ai_prospecting.sql`).
2. **Gemini API (`GEMINI_API_KEY`):** Required server-side for Phase 5 website research & personalized copy generation.
3. **n8n Automation Engine (`N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_SECRET`):** n8n instance currently has **0 workflows** deployed and no app webhook URL/secret configured.
4. **Google OAuth 2.0 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`):** Required to connect Gmail (sending/replies) and Google Calendar (slot booking) in CRM Settings → Integrations.
5. **Contact Enrichment Provider:** No enrichment provider (Apollo, Hunter, Clearbit, etc.) is configured; contact verification and discovery stay unavailable until connected so no data is ever fabricated.

---

## 2. Database Schema Changes
Added in [`supabase/migrations/20261127000001_ai_prospecting.sql`](../supabase/migrations/20261127000001_ai_prospecting.sql):
- `public.prospect_imports` — import ledger with `idempotency_key`, file metadata, strategy, column mapping, and row-level outcomes.
- `public.prospects` — workspace-scoped prospects with normalized generated columns (`normalized_email`, `normalized_phone`, `website_domain`, `instagram_handle_lower`), partial unique indexes preventing workspace duplicates, and `crm_lead_id` foreign key linking directly to `public.leads`.
- `public.prospect_events` — immutable lifecycle & audit event log.
- `public.automation_runs` — execution tracking table for n8n workflows (service-role write only).

---

## 3. Planned Phase Roadmap (Phases 5–11)
- **Phase 5 (AI Research & Enrichment):** Server-side website fetch + Gemini API classification and summary (`GEMINI_API_KEY`), gated behind configured provider checks.
- **Phase 6 (Personalized Outreach Drafts & Approval):** Generate per-prospect drafts and queue for explicit human approval (`Outreach Pending Approval`) before any sending is enabled.
- **Phase 7 (n8n Automation Engine):** Planned execution handshake:
  - App dispatches signed outbound trigger (`POST N8N_WEBHOOK_BASE_URL/<workflow>`) with `X-Twofold-Signature` (`HMAC-SHA256` over `<timestamp>.<body>`) and an `automation_runs` `idempotency_key`.
  - n8n executes workflow steps and sends a signed callback back to `/api/prospecting` updating `automation_runs.status` (`succeeded` / `failed`). The UI will never mark an automation as successful until the signed execution callback confirms success.
- **Phase 8 (Email Sending, Reply Detection & Follow-ups):** Dispatch approved outreach via connected Gmail OAuth / provider limits & suppression checks, monitor replies, and schedule follow-ups.
- **Phase 9 (Automated Qualification & CRM Sync):** AI classification promotes interested prospects, links `crmLeadId`, and syncs conversation history into existing CRM leads.
- **Phase 10 (Calendar Booking):** Fetch live availability slots from Google Calendar, let prospects confirm slots, and save confirmed appointments into CRM Calendar & Leads.
- **Phase 11 (End-to-End Verification & Security Audit):** Multi-tenant RLS checks, signed webhook tests, rate-limit checks, and full regression validation.
