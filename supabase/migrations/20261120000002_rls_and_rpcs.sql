-- =============================================================================
-- Twofold Studio OS — 0002 Triggers, Row Level Security (RLS), Transactional
-- RPCs, and Supabase Realtime Publication
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Automatic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'workspaces','team_members','leads','clients','projects',
    'project_checklist_items','tasks','calendar_events','campaigns',
    'daily_targets','outreach_activities','cold_calls','notes',
    'finance_records','payments','documents','templates','notifications',
    'integrations','integration_secrets','whatsapp_templates','import_jobs'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', tbl);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at();',
      tbl
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Auth & RBAC helper functions (used by RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.team_members
  where user_id = auth.uid()
    and status = 'active'
  order by created_at asc
  limit 1;
$$;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.team_members
  where user_id = auth.uid()
    and status = 'active'
  order by created_at asc
  limit 1;
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.team_members
  where user_id = auth.uid()
    and status = 'active'
  order by created_at asc
  limit 1;
$$;

create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

create or replace function public.is_workspace_manager_or_admin(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('admin','manager')
  );
$$;

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Enable Row Level Security on all tables
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.team_members enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_checklist_items enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_leads enable row level security;
alter table public.daily_targets enable row level security;
alter table public.outreach_activities enable row level security;
alter table public.cold_calls enable row level security;
alter table public.notes enable row level security;
alter table public.finance_records enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.templates enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.webhook_events enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.import_jobs enable row level security;
alter table public.error_events enable row level security;

-- Workspaces: members can read; only admins can update
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (public.is_workspace_admin(id));

-- Team members: all active members in workspace can read; admin/manager can insert/update; only admin can delete
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
  for insert with check (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members
  for update using (
    public.is_workspace_admin(workspace_id)
    or user_id = auth.uid()
  );

drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members
  for delete using (public.is_workspace_admin(workspace_id));

-- Leads: Admin & Manager see all; Team Member sees assigned or workspace leads for activity logging; only Admin can delete
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update using (
    public.is_workspace_manager_or_admin(workspace_id)
    or assigned_member_id = public.current_member_id()
  );

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete using (public.is_workspace_admin(workspace_id));

-- Clients: Admin & Manager have full access; Team Member can read permitted clients (clients of assigned projects)
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (
    public.is_workspace_manager_or_admin(workspace_id)
    or account_manager_id = public.current_member_id()
    or exists (
      select 1
      from public.projects p
      join public.project_members pm on pm.project_id = p.id
      where p.client_id = clients.id
        and pm.member_id = public.current_member_id()
    )
  );

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert with check (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update using (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete using (public.is_workspace_admin(workspace_id));

-- Projects: Admin & Manager see all; Team Member sees assigned projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (
    public.is_workspace_manager_or_admin(workspace_id)
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id
        and pm.member_id = public.current_member_id()
    )
  );

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert with check (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (
    public.is_workspace_manager_or_admin(workspace_id)
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id
        and pm.member_id = public.current_member_id()
    )
  );

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete using (public.is_workspace_admin(workspace_id));

-- Project members & checklist items
drop policy if exists project_members_all on public.project_members;
create policy project_members_all on public.project_members
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists checklist_select on public.project_checklist_items;
create policy checklist_select on public.project_checklist_items
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists checklist_write on public.project_checklist_items;
create policy checklist_write on public.project_checklist_items
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Tasks: Admin/Manager see all; Team Member sees assigned tasks or tasks on assigned projects
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    public.is_workspace_manager_or_admin(workspace_id)
    or assigned_member_id = public.current_member_id()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = tasks.related_project_id
        and pm.member_id = public.current_member_id()
    )
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (
    public.is_workspace_manager_or_admin(workspace_id)
    or assigned_member_id = public.current_member_id()
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete using (public.is_workspace_manager_or_admin(workspace_id));

-- Finance records & payments: STRICTLY restricted to Admin (and Manager read where enabled; Admin full write/delete)
drop policy if exists finance_select on public.finance_records;
create policy finance_select on public.finance_records
  for select using (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists finance_insert on public.finance_records;
create policy finance_insert on public.finance_records
  for insert with check (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists finance_update on public.finance_records;
create policy finance_update on public.finance_records
  for update using (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists finance_delete on public.finance_records;
create policy finance_delete on public.finance_records
  for delete using (public.is_workspace_admin(workspace_id));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (public.is_workspace_manager_or_admin(workspace_id));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert with check (public.is_workspace_manager_or_admin(workspace_id));

-- Outreach, Cold Calls, Notes, Calendar Events, Campaigns, Documents, Templates, Activity Logs
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'calendar_events','campaigns','campaign_members','campaign_leads',
    'daily_targets','outreach_activities','cold_calls','notes',
    'documents','templates','activity_logs','whatsapp_templates','import_jobs'
  ] loop
    execute format('drop policy if exists %I_member_select on public.%I;', tbl, tbl);
    execute format(
      'create policy %I_member_select on public.%I for select using (public.is_workspace_member(workspace_id));',
      tbl, tbl
    );
    execute format('drop policy if exists %I_member_insert on public.%I;', tbl, tbl);
    execute format(
      'create policy %I_member_insert on public.%I for insert with check (public.is_workspace_member(workspace_id));',
      tbl, tbl
    );
    execute format('drop policy if exists %I_member_update on public.%I;', tbl, tbl);
    execute format(
      'create policy %I_member_update on public.%I for update using (public.is_workspace_member(workspace_id));',
      tbl, tbl
    );
    execute format('drop policy if exists %I_admin_delete on public.%I;', tbl, tbl);
    execute format(
      'create policy %I_admin_delete on public.%I for delete using (public.is_workspace_manager_or_admin(workspace_id));',
      tbl, tbl
    );
  end loop;
end $$;

-- Notifications: recipient or admin
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (
    recipient_member_id = public.current_member_id()
    or public.is_workspace_admin(workspace_id)
  );

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (
    recipient_member_id = public.current_member_id()
    or public.is_workspace_admin(workspace_id)
  );

-- Integrations: members can view connection status; only Admin can modify; integration_secrets has NO client policies (service_role only!)
drop policy if exists integrations_select on public.integrations;
create policy integrations_select on public.integrations
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists integrations_admin_write on public.integrations;
create policy integrations_admin_write on public.integrations
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- 4. Transactional RPCs for Multi-Table Atomic Operations
-- ---------------------------------------------------------------------------

-- Atomic Lead -> Client (+ Optional Project + 14-item Checklist) Conversion
create or replace function public.convert_lead_to_client_tx(
  p_workspace_id uuid,
  p_lead_id uuid,
  p_actor_member_id uuid,
  p_actor_name text,
  p_services text[],
  p_create_project boolean,
  p_project_name text,
  p_project_type text,
  p_project_budget numeric,
  p_project_deadline date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_client public.clients%rowtype;
  v_project public.projects%rowtype;
  v_labels text[] := array[
    'Proposal prepared','Agreement signed','Onboarding completed','Content received',
    'Images received','Design completed','Development completed','Mobile responsiveness checked',
    'SEO foundation checked','Client review completed','Revisions completed',
    'Final approval received','Website launched','Handover completed'
  ];
  v_idx int;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Lead % not found in workspace %', p_lead_id, p_workspace_id;
  end if;

  insert into public.clients (
    workspace_id, client_name, business_name, industry, contact_person,
    email, phone, country, city, website, social_media_links,
    client_since, services_purchased, total_project_value, payment_status,
    account_manager_id, internal_notes, origin_lead_id, created_by
  ) values (
    p_workspace_id,
    coalesce(nullif(v_lead.contact_person, ''), v_lead.business_name),
    v_lead.business_name,
    v_lead.industry,
    v_lead.contact_person,
    v_lead.business_email,
    v_lead.phone_number,
    v_lead.country,
    v_lead.city,
    v_lead.website_url,
    jsonb_build_object(
      'instagram', nullif(v_lead.instagram_url, ''),
      'linkedin', nullif(v_lead.linkedin_url, ''),
      'facebook', nullif(v_lead.facebook_url, '')
    ),
    current_date,
    coalesce(p_services, array['Custom Website Design (UI/UX)','Next.js Full-Stack Development']),
    coalesce(p_project_budget, v_lead.estimated_project_value, 0),
    'Pending',
    coalesce(v_lead.assigned_member_id, p_actor_member_id),
    coalesce(nullif(v_lead.personalization_notes, ''), v_lead.potential_opportunity),
    v_lead.id,
    p_actor_member_id
  )
  returning * into v_client;

  update public.leads
  set status = 'Converted',
      converted_client_id = v_client.id
  where id = v_lead.id;

  if coalesce(p_create_project, false) then
    insert into public.projects (
      workspace_id, client_id, project_name, project_type, project_description,
      project_budget, start_date, deadline, project_status, progress_percentage,
      website_demo_url, live_website_url, internal_notes, created_by
    ) values (
      p_workspace_id,
      v_client.id,
      coalesce(nullif(p_project_name, ''), v_lead.business_name || ' — Digital Platform'),
      coalesce(nullif(p_project_type, ''), 'Next.js Full-Stack Development'),
      coalesce(nullif(v_lead.potential_opportunity, ''), 'End-to-end website design and engineering.'),
      coalesce(p_project_budget, v_lead.estimated_project_value, 0),
      current_date,
      coalesce(p_project_deadline, current_date + 45),
      'Agreement Signed',
      14,
      '',
      v_lead.website_url,
      'Project automatically provisioned on lead conversion.',
      p_actor_member_id
    )
    returning * into v_project;

    if v_lead.assigned_member_id is not null then
      insert into public.project_members (project_id, member_id, workspace_id)
      values (v_project.id, v_lead.assigned_member_id, p_workspace_id)
      on conflict do nothing;
    end if;

    for v_idx in 1..array_length(v_labels, 1) loop
      insert into public.project_checklist_items (
        workspace_id, project_id, label, completed, assigned_member_id, position, completed_at
      ) values (
        p_workspace_id,
        v_project.id,
        v_labels[v_idx],
        v_idx <= 2,
        coalesce(v_lead.assigned_member_id, p_actor_member_id),
        v_idx,
        case when v_idx <= 2 then now() else null end
      );
    end loop;
  end if;

  insert into public.activity_logs (
    workspace_id, actor_member_id, actor_name, action, entity_type, entity_id, entity_name, details
  ) values (
    p_workspace_id,
    p_actor_member_id,
    coalesce(p_actor_name, 'Team Member'),
    'converted',
    'Lead',
    v_lead.id,
    v_lead.business_name,
    'Converted lead into client ' || v_client.business_name
  );

  return jsonb_build_object(
    'client_id', v_client.id,
    'project_id', v_project.id
  );
end;
$$;

-- Atomic Payment Recording (inserts payment row, updates invoice paid_amount & status, updates client payment_status, logs activity)
create or replace function public.record_invoice_payment_tx(
  p_workspace_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_notes text,
  p_actor_member_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.finance_records%rowtype;
  v_payment public.payments%rowtype;
  v_new_paid numeric;
  v_new_status text;
begin
  select * into v_inv
  from public.finance_records
  where id = p_invoice_id and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;

  insert into public.payments (
    workspace_id, invoice_id, amount, currency, paid_at, method, notes, recorded_by
  ) values (
    p_workspace_id,
    v_inv.id,
    p_amount,
    v_inv.currency,
    current_date,
    coalesce(nullif(p_method, ''), v_inv.payment_method, 'Wire Transfer'),
    coalesce(p_notes, ''),
    p_actor_member_id
  )
  returning * into v_payment;

  v_new_paid := least(v_inv.amount, v_inv.paid_amount + p_amount);
  v_new_status := case
    when v_new_paid >= v_inv.amount then 'Paid'
    when v_new_paid > 0 then 'Partially Paid'
    else v_inv.payment_status
  end;

  update public.finance_records
  set paid_amount = v_new_paid,
      payment_status = v_new_status,
      payment_date = current_date,
      payment_method = coalesce(nullif(p_method, ''), payment_method)
  where id = v_inv.id;

  if v_inv.client_id is not null then
    update public.clients
    set payment_status = case when v_new_status = 'Paid' then 'Paid' else 'Partially Paid' end
    where id = v_inv.client_id;
  end if;

  insert into public.activity_logs (
    workspace_id, actor_member_id, actor_name, action, entity_type, entity_id, entity_name, details
  ) values (
    p_workspace_id,
    p_actor_member_id,
    coalesce(p_actor_name, 'Admin'),
    'recorded',
    'Payment',
    v_inv.id,
    v_inv.invoice_number,
    format('Recorded payment of %s %s (status: %s)', v_inv.currency, p_amount, v_new_status)
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'paid_amount', v_new_paid,
    'payment_status', v_new_status
  );
end;
$$;

-- Safe Demo Data Removal (deletes only records with is_demo = true, preserving all legitimate user data)
create or replace function public.purge_demo_records_tx(
  p_workspace_id uuid,
  p_actor_member_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_payments int;
  c_finance int;
  c_tasks int;
  c_projects int;
  c_clients int;
  c_outreach int;
  c_leads int;
  c_docs int;
  c_templates int;
begin
  delete from public.payments where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_payments = row_count;

  delete from public.finance_records where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_finance = row_count;

  delete from public.tasks where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_tasks = row_count;

  delete from public.projects where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_projects = row_count;

  delete from public.outreach_activities where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_outreach = row_count;

  update public.leads set converted_client_id = null where workspace_id = p_workspace_id and is_demo = true;
  delete from public.clients where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_clients = row_count;

  delete from public.leads where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_leads = row_count;

  delete from public.documents where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_docs = row_count;

  delete from public.templates where workspace_id = p_workspace_id and is_demo = true;
  get diagnostics c_templates = row_count;

  insert into public.activity_logs (
    workspace_id, actor_member_id, actor_name, action, entity_type, entity_name, details
  ) values (
    p_workspace_id,
    p_actor_member_id,
    coalesce(p_actor_name, 'Admin'),
    'deleted',
    'Demo Records',
    'Purged Seed Demo Data',
    format('Removed %s demo leads, %s demo clients, %s demo projects, %s demo finance rows',
           c_leads, c_clients, c_projects, c_finance)
  );

  return jsonb_build_object(
    'leads_removed', c_leads,
    'clients_removed', c_clients,
    'projects_removed', c_projects,
    'tasks_removed', c_tasks,
    'outreach_removed', c_outreach,
    'finance_removed', c_finance,
    'payments_removed', c_payments,
    'documents_removed', c_docs,
    'templates_removed', c_templates
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Enable Supabase Realtime publication for live multi-user sync
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array[
      'team_members','leads','clients','projects','project_checklist_items',
      'tasks','calendar_events','campaigns','outreach_activities','cold_calls',
      'notes','finance_records','payments','documents','templates',
      'notifications','activity_logs','integrations'
    ] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I;', tbl);
      exception when duplicate_object then
        null;
      end;
    end loop;
  end if;
end $$;
