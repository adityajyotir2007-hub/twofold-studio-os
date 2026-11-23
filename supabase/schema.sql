-- =============================================================================
-- TWOFOLD STUDIO - AGENCY OPERATING SYSTEM
-- Complete PostgreSQL / Supabase Database Schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TEAM MEMBERS & RBAC PROFILES
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Manager', 'Team Member')),
  title TEXT NOT NULL DEFAULT 'Product Designer',
  avatar_initials TEXT NOT NULL DEFAULT 'TF',
  phone TEXT,
  department TEXT DEFAULT 'Delivery',
  hourly_rate NUMERIC(10, 2) DEFAULT 95.00,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Away', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LEADS & CRM
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  industry TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  business_email TEXT NOT NULL,
  phone_number TEXT,
  website_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  google_maps_url TEXT,
  lead_source TEXT NOT NULL CHECK (lead_source IN (
    'Google Maps', 'Yelp', 'Instagram', 'Facebook', 'LinkedIn', 'Referrals', 'Website', 'Other'
  )),
  business_description TEXT,
  website_status TEXT DEFAULT 'Outdated Website',
  rating NUMERIC(3, 1) DEFAULT 4.5,
  number_of_reviews INTEGER DEFAULT 0,
  personalization_notes TEXT,
  potential_opportunity TEXT,
  estimated_project_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  lead_priority TEXT NOT NULL DEFAULT 'Medium' CHECK (lead_priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN (
    'New', 'Qualified', 'Contacted', 'Replied', 'Interested',
    'Meeting Scheduled', 'Proposal Sent', 'Converted', 'Not Interested', 'Lost'
  )),
  assigned_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  last_contacted DATE,
  next_follow_up_date DATE,
  internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  converted_client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  website TEXT,
  social_media_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_since DATE NOT NULL DEFAULT CURRENT_DATE,
  services_purchased TEXT[] NOT NULL DEFAULT '{}',
  total_project_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'Good Standing' CHECK (payment_status IN ('Paid', 'Partially Paid', 'Pending', 'Overdue', 'Good Standing')),
  assigned_account_manager_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  internal_notes TEXT,
  communication_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  meeting_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  origin_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_type TEXT NOT NULL DEFAULT 'Custom Web Application',
  project_description TEXT,
  project_budget NUMERIC(12, 2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE NOT NULL,
  project_status TEXT NOT NULL DEFAULT 'Proposal Sent' CHECK (project_status IN (
    'Proposal Sent',
    'Agreement Signed',
    'Client Onboarding',
    'Content & Assets Collection',
    'Website Design',
    'Website Development',
    'Internal Review',
    'Client Review',
    'Revisions',
    'Final Approval',
    'Website Launch',
    'Completed'
  )),
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  assigned_team_members UUID[] NOT NULL DEFAULT '{}',
  website_demo_url TEXT,
  live_website_url TEXT,
  reference_websites TEXT[] NOT NULL DEFAULT '{}',
  internal_notes TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_title TEXT NOT NULL,
  description TEXT,
  related_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  related_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assigned_person_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Under Review', 'Completed')),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_pattern TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. OUTREACH MANAGER
CREATE TABLE IF NOT EXISTS outreach_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  communication_channel TEXT NOT NULL CHECK (communication_channel IN (
    'Cold Emails', 'Instagram DMs', 'WhatsApp Messages', 'LinkedIn Messages', 'Follow-up Messages'
  )),
  message_template_used TEXT,
  date_sent DATE NOT NULL DEFAULT CURRENT_DATE,
  message_content TEXT NOT NULL,
  reply_status TEXT NOT NULL DEFAULT 'Message Sent' CHECK (reply_status IN (
    'Not Contacted', 'Message Sent', 'Replied', 'Interested',
    'Follow-up Required', 'Demo Shared', 'Meeting Booked', 'Converted', 'Not Interested'
  )),
  reply_date DATE,
  next_follow_up_date DATE,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. FINANCE & INVOICES
CREATE TABLE IF NOT EXISTS finance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Invoice', 'Payment', 'Expense', 'Retainer')),
  expense_category TEXT,
  payment_date DATE,
  due_date DATE NOT NULL,
  payment_method TEXT DEFAULT 'Wire Transfer',
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN (
    'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Refunded'
  )),
  invoice_number TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DOCUMENTS & FILE STORAGE METADATA
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  storage_path TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Proposals',
    'Agreements',
    'Invoices',
    'Onboarding Forms',
    'Client Content',
    'Images & Assets',
    'Brand Guidelines',
    'Project Deliverables',
    'Internal Documents'
  )),
  folder TEXT NOT NULL DEFAULT 'General',
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  uploaded_by_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TEMPLATES & RESOURCES
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Cold Email Templates',
    'Instagram DM Templates',
    'WhatsApp Templates',
    'Follow-up Templates',
    'Website Proposals',
    'Service Agreements',
    'Client Onboarding Questions',
    'Project Checklists',
    'Website Launch Checklists'
  )),
  subject_or_hook TEXT,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN (
    'New Lead', 'Follow-up Due', 'New Client', 'Project Deadline',
    'Overdue Task', 'Pending Payment', 'Project Status Change'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. ACTIVITY LOG
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'edited', 'completed', 'deleted', 'converted', 'recorded')),
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. AGENCY SETTINGS
CREATE TABLE IF NOT EXISTS agency_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_name TEXT NOT NULL DEFAULT 'Twofold Studio',
  tagline TEXT DEFAULT 'Digital Product & Web Engineering Studio',
  logo_url TEXT,
  contact_email TEXT NOT NULL DEFAULT 'hello@twofold.studio',
  contact_phone TEXT DEFAULT '+1 (415) 890-4421',
  address TEXT DEFAULT '548 Market St, Suite 42100, San Francisco, CA',
  website TEXT DEFAULT 'https://twofold.studio',
  default_currency TEXT NOT NULL DEFAULT 'USD',
  date_format TEXT NOT NULL DEFAULT 'MMM DD, YYYY',
  theme_preference TEXT NOT NULL DEFAULT 'light',
  notification_preferences JSONB NOT NULL DEFAULT '{
    "newLeads": true,
    "followUpsDue": true,
    "newClients": true,
    "projectDeadlines": true,
    "overdueTasks": true,
    "pendingPayments": true,
    "projectStatusChanges": true
  }'::jsonb,
  role_permissions JSONB NOT NULL DEFAULT '{
    "Admin": {"finance": true, "settings": true, "team": true, "deleteRecords": true},
    "Manager": {"finance": true, "settings": false, "team": true, "deleteRecords": true},
    "Team Member": {"finance": false, "settings": false, "team": false, "deleteRecords": false}
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(project_status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(related_project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_finance_client ON finance_records(client_id);
CREATE INDEX IF NOT EXISTS idx_finance_status ON finance_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
