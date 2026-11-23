-- =============================================================================
-- Twofold Studio OS — 0001 Core relational schema
-- UUID primary keys, foreign keys, indexes, created_at/updated_at everywhere.
-- Status/priority/stage values are stored as the human-readable labels used by
-- the UI; roles and communication channels use stable machine codes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Workspaces & membership
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.team_members (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  name            text not null,
  email           text not null,
  role            text not null default 'member' check (role in ('admin','manager','member')),
  title           text,
  phone           text,
  department      text,
  hourly_rate     numeric(10,2),
  avatar_initials text,
  status          text not null default 'active'
                    check (status in ('active','invited','placeholder','disabled')),
  invited_by      uuid references public.team_members(id) on delete set null,
  invited_at      timestamptz,
  joined_at       timestamptz,
  is_demo         boolean not null default false,
  legacy_id       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, email),
  unique (workspace_id, user_id)
);
create index if not exists idx_team_members_user on public.team_members(user_id);

-- ---------------------------------------------------------------------------
-- Leads & CRM
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  business_name           text not null,
  contact_person          text not null default '',
  industry                text not null default '',
  country                 text not null default '',
  city                    text not null default '',
  business_email          text not null default '',
  phone_number            text not null default '',
  website_url             text not null default '',
  instagram_url           text not null default '',
  facebook_url            text not null default '',
  linkedin_url            text not null default '',
  google_maps_url         text not null default '',
  lead_source             text not null default 'Other' check (lead_source in
                            ('Google Maps','Yelp','Instagram','Facebook','LinkedIn','Referrals','Website','Other')),
  business_description    text not null default '',
  website_status          text not null default 'Outdated Website',
  rating                  numeric(3,1),
  number_of_reviews       integer,
  personalization_notes   text not null default '',
  potential_opportunity   text not null default '',
  estimated_project_value numeric(12,2) not null default 0,
  lead_priority           text not null default 'Medium' check (lead_priority in ('Low','Medium','High','Urgent')),
  status                  text not null default 'New' check (status in
                            ('New','Qualified','Contacted','Replied','Interested','Meeting Scheduled',
                             'Proposal Sent','Converted','Not Interested','Lost')),
  assigned_member_id      uuid references public.team_members(id) on delete set null,
  date_added              date not null default current_date,
  last_contacted          date,
  next_follow_up_date     date,
  converted_client_id     uuid,
  -- Channel identities used to match inbound messages to leads
  instagram_user_id       text,
  instagram_handle        text,
  whatsapp_number         text,
  whatsapp_opt_in         boolean not null default false,
  whatsapp_opt_in_at      timestamptz,
  whatsapp_opt_in_source  text,
  -- Normalised columns for duplicate detection & message matching
  normalized_email  text generated always as (nullif(lower(btrim(business_email)), '')) stored,
  normalized_name   text generated always as (nullif(lower(regexp_replace(business_name, '[^a-zA-Z0-9]', '', 'g')), '')) stored,
  normalized_phone  text generated always as (nullif(regexp_replace(phone_number, '[^0-9]', '', 'g'), '')) stored,
  website_domain    text generated always as (
                      nullif(regexp_replace(regexp_replace(lower(btrim(website_url)), '^https?://(www\.)?', ''), '[/?#:].*$', ''), '')
                    ) stored,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_leads_ws_status   on public.leads(workspace_id, status);
create index if not exists idx_leads_assigned    on public.leads(assigned_member_id);
create index if not exists idx_leads_email       on public.leads(workspace_id, normalized_email);
create index if not exists idx_leads_name        on public.leads(workspace_id, normalized_name);
create index if not exists idx_leads_phone       on public.leads(workspace_id, normalized_phone);
create index if not exists idx_leads_domain      on public.leads(workspace_id, website_domain);
create index if not exists idx_leads_ig          on public.leads(workspace_id, instagram_user_id);
create index if not exists idx_leads_followup    on public.leads(workspace_id, next_follow_up_date);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  client_name           text not null,
  business_name         text not null,
  industry              text not null default '',
  contact_person        text not null default '',
  email                 text not null default '',
  phone                 text not null default '',
  country               text not null default '',
  city                  text not null default '',
  website               text not null default '',
  social_media_links    jsonb not null default '{}'::jsonb,
  client_since          date not null default current_date,
  services_purchased    text[] not null default '{}',
  total_project_value   numeric(12,2) not null default 0,
  payment_status        text not null default 'Pending'
                          check (payment_status in ('Paid','Partially Paid','Pending','Overdue')),
  account_manager_id    uuid references public.team_members(id) on delete set null,
  internal_notes        text not null default '',
  origin_lead_id        uuid references public.leads(id) on delete set null,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_clients_ws on public.clients(workspace_id);
create index if not exists idx_clients_manager on public.clients(account_manager_id);

alter table public.leads
  drop constraint if exists leads_converted_client_fk;
alter table public.leads
  add constraint leads_converted_client_fk foreign key (converted_client_id)
  references public.clients(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  client_id            uuid not null references public.clients(id) on delete restrict,
  project_name         text not null,
  project_type         text not null default '',
  project_description  text not null default '',
  project_budget       numeric(12,2) not null default 0,
  currency             text not null default 'USD',
  start_date           date not null default current_date,
  deadline             date not null,
  project_status       text not null default 'Proposal Sent' check (project_status in (
                         'Proposal Sent','Agreement Signed','Client Onboarding','Content & Assets Collection',
                         'Website Design','Website Development','Internal Review','Client Review','Revisions',
                         'Final Approval','Website Launch','Completed')),
  progress_percentage  integer not null default 0 check (progress_percentage between 0 and 100),
  website_demo_url     text not null default '',
  live_website_url     text not null default '',
  reference_websites   text[] not null default '{}',
  internal_notes       text not null default '',
  completed_at         timestamptz,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_projects_ws_status on public.projects(workspace_id, project_status);
create index if not exists idx_projects_client on public.projects(client_id);

create table if not exists public.project_members (
  project_id   uuid not null references public.projects(id) on delete cascade,
  member_id    uuid not null references public.team_members(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (project_id, member_id)
);
create index if not exists idx_project_members_member on public.project_members(member_id);

create table if not exists public.project_checklist_items (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  project_id         uuid not null references public.projects(id) on delete cascade,
  label              text not null,
  completed          boolean not null default false,
  assigned_member_id uuid references public.team_members(id) on delete set null,
  position           integer not null default 0,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_checklist_project on public.project_checklist_items(project_id, position);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  task_title          text not null,
  description         text not null default '',
  related_client_id   uuid references public.clients(id) on delete set null,
  related_project_id  uuid references public.projects(id) on delete set null,
  related_lead_id     uuid references public.leads(id) on delete set null,
  assigned_member_id  uuid references public.team_members(id) on delete set null,
  priority            text not null default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  start_date          date not null default current_date,
  due_date            date not null,
  status              text not null default 'To Do' check (status in ('To Do','In Progress','Under Review','Completed')),
  is_recurring        boolean not null default false,
  recurrence_pattern  text check (recurrence_pattern in ('Daily','Weekly','Monthly')),
  completed_at        timestamptz,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tasks_ws_status on public.tasks(workspace_id, status);
create index if not exists idx_tasks_assignee on public.tasks(assigned_member_id);
create index if not exists idx_tasks_project on public.tasks(related_project_id);
create index if not exists idx_tasks_due on public.tasks(workspace_id, due_date);

-- ---------------------------------------------------------------------------
-- Calendar events (meetings, reminders, synced Google Calendar events)
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_events (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  title              text not null,
  description        text not null default '',
  event_type         text not null default 'meeting' check (event_type in ('meeting','deadline','reminder','call','other')),
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  all_day            boolean not null default false,
  location           text not null default '',
  attendees          text not null default '',
  notes              text not null default '',
  lead_id            uuid references public.leads(id) on delete set null,
  client_id          uuid references public.clients(id) on delete set null,
  project_id         uuid references public.projects(id) on delete set null,
  external_provider  text,
  external_id        text,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workspace_id, external_provider, external_id)
);
create index if not exists idx_events_ws_start on public.calendar_events(workspace_id, starts_at);
create index if not exists idx_events_client on public.calendar_events(client_id);

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  target_industry text not null default '',
  target_country  text not null default '',
  target_city     text not null default '',
  channels        text[] not null default '{}',
  status          text not null default 'Draft' check (status in ('Draft','Active','Paused','Completed')),
  start_date      date,
  end_date        date,
  created_by      uuid references public.team_members(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_campaigns_ws on public.campaigns(workspace_id, status);

create table if not exists public.campaign_members (
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  member_id    uuid not null references public.team_members(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (campaign_id, member_id)
);

create table if not exists public.campaign_leads (
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (campaign_id, lead_id)
);
create index if not exists idx_campaign_leads_lead on public.campaign_leads(lead_id);

create table if not exists public.daily_targets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id    uuid not null references public.team_members(id) on delete cascade,
  metric       text not null check (metric in ('calls','emails','dms','whatsapp','leads_added')),
  target       integer not null check (target >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (member_id, metric)
);

-- ---------------------------------------------------------------------------
-- Unified communication timeline (outreach activities)
-- Every email / DM / WhatsApp / LinkedIn message — manual or API-synced — is
-- one row. Provider message ids are unique so repeated webhook deliveries or
-- sync passes cannot create duplicates.
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_activities (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  lead_id              uuid references public.leads(id) on delete set null,
  client_id            uuid references public.clients(id) on delete set null,
  campaign_id          uuid references public.campaigns(id) on delete set null,
  member_id            uuid references public.team_members(id) on delete set null,
  lead_name            text not null default '',
  channel              text not null check (channel in ('email','instagram','whatsapp','linkedin','other')),
  is_follow_up         boolean not null default false,
  direction            text not null default 'outbound' check (direction in ('outbound','inbound')),
  source               text not null default 'manual' check (source in ('manual','api')),
  provider             text check (provider in ('gmail','whatsapp_cloud','instagram')),
  provider_message_id  text,
  provider_thread_id   text,
  delivery_status      text not null default 'sent'
                         check (delivery_status in ('draft','queued','sent','delivered','read','failed','received')),
  reply_status         text not null default 'Message Sent' check (reply_status in (
                         'Not Contacted','Message Sent','Replied','Interested','Follow-up Required',
                         'Demo Shared','Meeting Booked','Converted','Not Interested')),
  counterpart_address  text,
  subject              text not null default '',
  message_content      text not null default '',
  template_used        text not null default '',
  occurred_at          timestamptz not null default now(),
  reply_date           date,
  next_follow_up_date  date,
  outcome              text not null default '',
  notes                text not null default '',
  metadata             jsonb not null default '{}'::jsonb,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workspace_id, provider, provider_message_id)
);
create index if not exists idx_outreach_ws_time on public.outreach_activities(workspace_id, occurred_at desc);
create index if not exists idx_outreach_lead on public.outreach_activities(lead_id, occurred_at desc);
create index if not exists idx_outreach_thread on public.outreach_activities(workspace_id, provider_thread_id);
create index if not exists idx_outreach_campaign on public.outreach_activities(campaign_id);
create index if not exists idx_outreach_member on public.outreach_activities(member_id);

-- ---------------------------------------------------------------------------
-- Cold calls
-- duration_seconds is NULL unless reported by a provider or entered by a human.
-- ---------------------------------------------------------------------------
create table if not exists public.cold_calls (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  lead_id            uuid references public.leads(id) on delete set null,
  campaign_id        uuid references public.campaigns(id) on delete set null,
  member_id          uuid references public.team_members(id) on delete set null,
  business_name      text not null default '',
  phone_number       text not null default '',
  called_at          timestamptz not null default now(),
  duration_seconds   integer check (duration_seconds is null or duration_seconds >= 0),
  outcome            text check (outcome in ('No Answer','Busy','Call Back Later','Interested',
                       'Not Interested','Meeting Booked','Wrong Number','Converted')),
  connected          boolean generated always as (
                       outcome in ('Call Back Later','Interested','Not Interested','Meeting Booked','Converted')
                     ) stored,
  notes              text not null default '',
  follow_up_date     date,
  next_action        text not null default '',
  source             text not null default 'manual' check (source in ('manual','api')),
  provider           text check (provider in ('twilio','aircall')),
  provider_call_id   text,
  provider_status    text,
  recording_url      text,
  recording_consent  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workspace_id, provider, provider_call_id)
);
create index if not exists idx_calls_ws_time on public.cold_calls(workspace_id, called_at desc);
create index if not exists idx_calls_lead on public.cold_calls(lead_id, called_at desc);
create index if not exists idx_calls_member on public.cold_calls(member_id, called_at desc);

-- ---------------------------------------------------------------------------
-- Notes (internal notes on leads / clients / projects)
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  lead_id          uuid references public.leads(id) on delete cascade,
  client_id        uuid references public.clients(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete cascade,
  author_member_id uuid references public.team_members(id) on delete set null,
  author_name      text not null default '',
  channel          text,             -- for client communication log entries (Email, Slack Connect, ...)
  kind             text not null default 'note' check (kind in ('note','communication')),
  content          text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (num_nonnulls(lead_id, client_id, project_id) = 1)
);
create index if not exists idx_notes_lead on public.notes(lead_id, created_at desc);
create index if not exists idx_notes_client on public.notes(client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Finance: invoices & expenses, with payments in their own table
-- ---------------------------------------------------------------------------
create table if not exists public.finance_records (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete set null,
  project_id        uuid references public.projects(id) on delete set null,
  transaction_type  text not null check (transaction_type in ('Invoice','Expense')),
  amount            numeric(12,2) not null check (amount >= 0),
  paid_amount       numeric(12,2) not null default 0 check (paid_amount >= 0),
  currency          text not null default 'USD' check (currency in ('USD','EUR','GBP','CAD','AUD','INR')),
  expense_category  text,
  issue_date        date not null default current_date,
  payment_date      date,
  due_date          date not null default current_date,
  payment_method    text not null default '',
  payment_status    text not null default 'Unpaid'
                      check (payment_status in ('Unpaid','Partially Paid','Paid','Overdue','Refunded')),
  invoice_number    text not null,
  notes             text not null default '',
  is_demo     boolean not null default false,
  legacy_id   text,
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workspace_id, invoice_number)
);
create index if not exists idx_finance_ws_type on public.finance_records(workspace_id, transaction_type);
create index if not exists idx_finance_client on public.finance_records(client_id);
create index if not exists idx_finance_status on public.finance_records(workspace_id, payment_status);

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  invoice_id    uuid not null references public.finance_records(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null,
  paid_at       date not null default current_date,
  method        text not null default '',
  notes         text not null default '',
  recorded_by   uuid references public.team_members(id) on delete set null,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_ws_date on public.payments(workspace_id, paid_at);

-- ---------------------------------------------------------------------------
-- Documents (file bytes live in Supabase Storage; only metadata here)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  title           text not null,
  file_name       text not null,
  file_size       bigint not null default 0,
  mime_type       text not null default 'application/octet-stream',
  storage_bucket  text not null default 'agency-documents',
  storage_path    text not null,
  category        text not null check (category in ('Proposals','Agreements','Invoices','Onboarding Forms',
                    'Client Content','Images & Assets','Brand Guidelines','Project Deliverables','Internal Documents')),
  folder          text not null default 'General',
  client_id       uuid references public.clients(id) on delete set null,
  project_id      uuid references public.projects(id) on delete set null,
  uploaded_by     uuid references public.team_members(id) on delete set null,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);
create index if not exists idx_documents_ws_cat on public.documents(workspace_id, category);
create index if not exists idx_documents_client on public.documents(client_id);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table if not exists public.templates (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  title            text not null,
  category         text not null check (category in ('Cold Email Templates','Instagram DM Templates',
                     'WhatsApp Templates','Follow-up Templates','Website Proposals','Service Agreements',
                     'Client Onboarding Questions','Project Checklists','Website Launch Checklists')),
  subject_or_hook  text not null default '',
  content          text not null,
  tags             text[] not null default '{}',
  usage_count      integer not null default 0,
  is_demo     boolean not null default false,
  legacy_id   text,
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_templates_ws_cat on public.templates(workspace_id, category);

-- ---------------------------------------------------------------------------
-- Notifications (one row per recipient) & activity log
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  recipient_member_id  uuid not null references public.team_members(id) on delete cascade,
  type                 text not null check (type in ('New Lead','Follow-up Due','New Client','Project Deadline',
                         'Overdue Task','Pending Payment','Project Status Change','Task Assigned',
                         'Reply Received','Payment Received','Integration Error','Import Completed')),
  title                text not null,
  message              text not null default '',
  section              text,
  entity_type          text,
  entity_id            uuid,
  dedupe_key           text,
  is_read              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (recipient_member_id, dedupe_key)
);
create index if not exists idx_notifications_recipient on public.notifications(recipient_member_id, is_read, created_at desc);

create table if not exists public.activity_logs (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  actor_member_id  uuid references public.team_members(id) on delete set null,
  actor_name       text not null default 'System',
  action           text not null check (action in ('created','edited','completed','deleted','converted','recorded','imported','connected','disconnected','sent','received')),
  entity_type      text not null,
  entity_id        uuid,
  entity_name      text not null default '',
  details          text not null default '',
  changes          jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists idx_activity_ws_time on public.activity_logs(workspace_id, created_at desc);
create index if not exists idx_activity_entity on public.activity_logs(entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrations (public status) & secrets (service-role only, encrypted)
-- ---------------------------------------------------------------------------
create table if not exists public.integrations (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  provider         text not null check (provider in ('gmail','google_sheets','google_calendar','whatsapp','instagram','twilio','aircall')),
  status           text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  account_info     jsonb not null default '{}'::jsonb,
  scopes           text[] not null default '{}',
  settings         jsonb not null default '{}'::jsonb,
  sync_cursor      text,
  last_sync_at     timestamptz,
  last_sync_error  text,
  last_error_at    timestamptz,
  connected_by     uuid references public.team_members(id) on delete set null,
  connected_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.integration_secrets (
  integration_id  uuid primary key references public.integrations(id) on delete cascade,
  ciphertext      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  event_id      text not null,
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  payload       jsonb,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text,
  unique (provider, event_id)
);

create table if not exists public.whatsapp_templates (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  language      text not null,
  category      text,
  status        text,
  components    jsonb not null default '[]'::jsonb,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, name, language)
);

create table if not exists public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  source         text not null check (source in ('csv','google_sheets')),
  source_label   text not null default '',
  mapping        jsonb not null default '{}'::jsonb,
  total_rows     integer not null default 0,
  created_count  integer not null default 0,
  updated_count  integer not null default 0,
  skipped_count  integer not null default 0,
  error_count    integer not null default 0,
  errors         jsonb not null default '[]'::jsonb,
  status         text not null default 'completed' check (status in ('completed','failed','partial')),
  created_by     uuid references public.team_members(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.error_events (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  message     text not null,
  context     jsonb,
  created_at  timestamptz not null default now()
);
