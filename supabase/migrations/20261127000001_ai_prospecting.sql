-- =============================================================================
-- AI Prospecting & Outreach System Schema Migration
-- Extends the Twofold Studio OS CRM workspace architecture without modifying
-- existing core CRM tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Prospect Spreadsheet Import Jobs
-- ---------------------------------------------------------------------------
create table if not exists public.prospect_imports (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key     text not null,
  file_name           text not null,
  file_type           text not null check (file_type in ('csv', 'xlsx', 'xls')),
  file_size           integer not null check (file_size >= 0),
  total_rows          integer not null default 0 check (total_rows >= 0),
  imported_count      integer not null default 0 check (imported_count >= 0),
  updated_count       integer not null default 0 check (updated_count >= 0),
  skipped_count       integer not null default 0 check (skipped_count >= 0),
  failed_count        integer not null default 0 check (failed_count >= 0),
  status              text not null default 'processing'
                        check (status in ('processing', 'completed', 'completed_with_errors', 'failed')),
  duplicate_strategy  text not null default 'skip'
                        check (duplicate_strategy in ('skip', 'update')),
  column_mapping      jsonb not null default '{}'::jsonb,
  row_results         jsonb not null default '[]'::jsonb,
  error               text,
  created_by          uuid references public.team_members(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz,
  unique (workspace_id, idempotency_key)
);

create index if not exists idx_prospect_imports_ws_created
  on public.prospect_imports(workspace_id, created_at desc);

create trigger trg_prospect_imports_updated_at
  before update on public.prospect_imports
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Prospect Database (Scoped per workspace + linked to CRM leads)
-- ---------------------------------------------------------------------------
create table if not exists public.prospects (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  import_id            uuid references public.prospect_imports(id) on delete set null,
  campaign_id          uuid references public.campaigns(id) on delete set null,
  crm_lead_id          uuid references public.leads(id) on delete set null,
  business_name        text not null default '',
  contact_person       text not null default '',
  website              text not null default '',
  email                text not null default '',
  phone                text not null default '',
  instagram            text not null default '',
  linkedin_url         text not null default '',
  category             text not null default '',
  location             text not null default '',
  country              text not null default '',
  notes                text not null default '',
  source               text not null default '',
  status               text not null default 'Imported'
                         check (status in (
                           'Imported',
                           'Pending Research',
                           'Researching',
                           'Ready for Outreach',
                           'Outreach Pending Approval',
                           'Contacted',
                           'Follow-up Required',
                           'Replied',
                           'Interested',
                           'Call Booked',
                           'Not Interested',
                           'Converted',
                           'Do Not Contact'
                         )),
  enrichment_status    text not null default 'not_configured'
                         check (enrichment_status in ('not_configured', 'pending', 'in_progress', 'completed', 'failed')),
  research_status      text not null default 'not_configured'
                         check (research_status in ('not_started', 'not_configured', 'queued', 'in_progress', 'completed', 'failed')),
  outreach_status      text not null default 'not_started'
                         check (outreach_status in ('not_started', 'draft', 'pending_approval', 'approved', 'sent', 'replied', 'suppressed')),
  qualification_status text not null default 'unqualified'
                         check (qualification_status in ('unqualified', 'interested', 'not_interested', 'converted')),
  validation_warnings  jsonb not null default '[]'::jsonb,
  research             jsonb not null default '{}'::jsonb,
  created_by           uuid references public.team_members(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Normalized columns matching public.leads for workspace-level dedupe
  normalized_email       text generated always as (nullif(lower(btrim(email)), '')) stored,
  normalized_phone       text generated always as (nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '')) stored,
  website_domain         text generated always as (
                           nullif(regexp_replace(regexp_replace(lower(btrim(website)), '^https?://(www\.)?', ''), '[/?#:].*$', ''), '')
                         ) stored,
  instagram_handle_lower text generated always as (nullif(lower(regexp_replace(btrim(instagram), '^@+', '')), '')) stored
);

create index if not exists idx_prospects_ws_status
  on public.prospects(workspace_id, status);
create index if not exists idx_prospects_crm_lead
  on public.prospects(crm_lead_id) where crm_lead_id is not null;

create unique index if not exists uidx_prospects_ws_email
  on public.prospects(workspace_id, normalized_email)
  where normalized_email is not null;

create unique index if not exists uidx_prospects_ws_domain
  on public.prospects(workspace_id, website_domain)
  where website_domain is not null;

create unique index if not exists uidx_prospects_ws_phone
  on public.prospects(workspace_id, normalized_phone)
  where normalized_phone is not null;

create unique index if not exists uidx_prospects_ws_instagram
  on public.prospects(workspace_id, instagram_handle_lower)
  where instagram_handle_lower is not null;

create trigger trg_prospects_updated_at
  before update on public.prospects
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Prospect Audit & Lifecycle Events
-- ---------------------------------------------------------------------------
create table if not exists public.prospect_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id  uuid references public.prospects(id) on delete cascade,
  import_id    uuid references public.prospect_imports(id) on delete cascade,
  actor_id     uuid references public.team_members(id) on delete set null,
  event_type   text not null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_prospect_events_ws_time
  on public.prospect_events(workspace_id, created_at desc);

create trigger trg_prospect_events_updated_at
  before update on public.prospect_events
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Automation Workflow Runs (n8n Execution Ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  workflow_key    text not null,
  status          text not null default 'queued'
                    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  idempotency_key text not null,
  attempts        integer not null default 0 check (attempts >= 0),
  input           jsonb not null default '{}'::jsonb,
  output          jsonb not null default '{}'::jsonb,
  error           text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, workflow_key, idempotency_key)
);

create index if not exists idx_automation_runs_ws_time
  on public.automation_runs(workspace_id, created_at desc);

create trigger trg_automation_runs_updated_at
  before update on public.automation_runs
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security (Multi-Tenant Isolation)
-- ---------------------------------------------------------------------------
alter table public.prospect_imports enable row level security;
alter table public.prospects        enable row level security;
alter table public.prospect_events  enable row level security;
alter table public.automation_runs  enable row level security;

-- prospect_imports policies
drop policy if exists prospect_imports_select on public.prospect_imports;
create policy prospect_imports_select on public.prospect_imports
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists prospect_imports_insert on public.prospect_imports;
create policy prospect_imports_insert on public.prospect_imports
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists prospect_imports_update on public.prospect_imports;
create policy prospect_imports_update on public.prospect_imports
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists prospect_imports_delete on public.prospect_imports;
create policy prospect_imports_delete on public.prospect_imports
  for delete using (public.is_workspace_manager_or_admin(workspace_id));

-- prospects policies
drop policy if exists prospects_select on public.prospects;
create policy prospects_select on public.prospects
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists prospects_insert on public.prospects;
create policy prospects_insert on public.prospects
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists prospects_update on public.prospects;
create policy prospects_update on public.prospects
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists prospects_delete on public.prospects;
create policy prospects_delete on public.prospects
  for delete using (public.is_workspace_manager_or_admin(workspace_id));

-- prospect_events policies
drop policy if exists prospect_events_select on public.prospect_events;
create policy prospect_events_select on public.prospect_events
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists prospect_events_insert on public.prospect_events;
create policy prospect_events_insert on public.prospect_events
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists prospect_events_update on public.prospect_events;
create policy prospect_events_update on public.prospect_events
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists prospect_events_delete on public.prospect_events;
create policy prospect_events_delete on public.prospect_events
  for delete using (public.is_workspace_manager_or_admin(workspace_id));

-- automation_runs policies: workspace members can read/delete (managers+);
-- inserts/updates are restricted to server/service role (no insert/update policy for authenticated).
drop policy if exists automation_runs_select on public.automation_runs;
create policy automation_runs_select on public.automation_runs
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists automation_runs_delete on public.automation_runs;
create policy automation_runs_delete on public.automation_runs
  for delete using (public.is_workspace_manager_or_admin(workspace_id));
