# Twofold Studio OS — Production Multi-User Agency Operating System

An enterprise-grade internal agency operating system built for **Twofold Studio** with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, **Supabase PostgreSQL / Auth / Realtime / Storage**, and **Recharts**.

---

## 1. Production Architecture

1. **Relational Database & Granular Operations (Part 1):**
   - Full PostgreSQL relational schema in [20261120000001_core_schema.sql](supabase/migrations/20261120000001_core_schema.sql) with 22 tables, UUID primary keys, foreign keys, indexes, generated normalization columns, and automatic `created_at` / `updated_at` triggers.
   - Row Level Security (RLS) policies, atomic PostgreSQL transactional RPCs (`convert_lead_to_client_tx`, `record_invoice_payment_tx`, `purge_demo_records_tx`), and Supabase Realtime publication in [20261120000002_rls_and_rpcs.sql](supabase/migrations/20261120000002_rls_and_rpcs.sql).
   - Granular record-level CRUD endpoints (`/api/records/[collection]`) and atomic transaction endpoints (`/api/transactions`). Complete JSON state replacement (`PUT /api/state`) is disabled.

2. **Multi-User Authentication & Server-Enforced RBAC (Part 2):**
   - Salted PBKDF2-SHA256 password verification + signed HTTP-only session cookies (`twofold_session`) + Supabase Auth integration in [src/lib/server-auth.ts](src/lib/server-auth.ts) and [src/app/api/auth/route.ts](src/app/api/auth/route.ts).
   - Invite team members by email (`Admin` / `Manager` / `Team Member`), complete registration via invitation token, forgot-password token generation, and password reset.
   - Server-enforced Role-Based Access Control: `Team Member` sessions are blocked with `HTTP 403 Forbidden` on `/api/records/finance` and `/api/transactions` payment endpoints, and financial rows are stripped on the server.

3. **Real-Time Multi-User Sync (Part 3):**
   - Dual real-time engine: Supabase Realtime `postgres_changes` channel subscriptions + Server-Sent Events (`/api/realtime`) backed by [src/lib/realtime-bus.ts](src/lib/realtime-bus.ts).

4. **Integrations, Encrypted Vault, OAuth 2.0 & Webhooks (Parts 4, 5, 6, 7, 8, 9):**
   - **Settings → Integrations & Connected Accounts** provides cards for **Gmail**, **Google Sheets**, **WhatsApp Business**, **Instagram Business**, **Phone / Calling Provider (Twilio / Aircall)**, and **Google Calendar**.
   - Credentials and refresh tokens are encrypted on the server using **AES-256-GCM** ([src/lib/crypto-vault.ts](src/lib/crypto-vault.ts)) and stored in `data/integration-secrets.enc.json` / `public.integration_secrets`.
   - Integrations are **never** marked connected unless live provider authentication succeeds.
   - OAuth 2.0 callback handler at `/api/integrations/oauth/callback` with HMAC-signed `state` verification.
   - Webhook receivers at `/api/webhooks/[provider]` (`gmail`, `whatsapp`, `instagram`, `calling`) with `X-Hub-Signature-256` and `X-Twilio-Signature` HMAC verification and `(provider, provider_message_id)` duplicate prevention.

---

## 2. Database Migration & Backup (Part 14)

Run the non-destructive migration & audit script at any time:

```bash
npx tsx scripts/migrate-json-to-relational.ts
```

This script:
1. Creates a timestamped backup in `data/backups/agency-db-backup-<timestamp>.json`.
2. Distinguishes seeded demo records (`is_demo = true`) from legitimate user records (`is_demo = false`).
3. Validates all foreign-key relationships across leads, clients, projects, tasks, finance, and documents.
4. Generates [supabase/migrations/20261120000003_migrated_data.sql](supabase/migrations/20261120000003_migrated_data.sql) and [data/migration-report.md](data/migration-report.md).

To remove seeded demo records after verification while keeping all legitimate records, click **Purge DEMO Data** on the Dashboard or in **Settings → Data Export & Seeded Demo Record Removal**.

---

## 3. External Integration Setup Instructions

1. **Google OAuth 2.0 (Gmail, Google Sheets, Google Calendar):**
   - In Google Cloud Console → **APIs & Services → Credentials**, create an OAuth 2.0 Web Client.
   - Add Authorized Redirect URI: `https://<your-domain>/api/integrations/oauth/callback` (and `http://localhost:3000/api/integrations/oauth/callback` for local development).
   - Enable **Gmail API**, **Google Sheets API**, and **Google Calendar API**.
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` (or Vercel Environment Variables).

2. **WhatsApp Business Cloud API & Instagram Professional API (Meta):**
   - In Meta for Developers, configure a Business App with **WhatsApp** and **Instagram Graph API**.
   - Set Webhook Callback URLs to:
     - `https://<your-domain>/api/webhooks/whatsapp`
     - `https://<your-domain>/api/webhooks/instagram`
   - Set Verify Token to `WEBHOOK_VERIFY_TOKEN` (`twofold_webhook_verify_2026`).
   - Add `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID` to your environment variables, or connect directly from **Settings → Integrations**.

3. **Calling Provider (Twilio / Aircall):**
   - In Twilio Console, copy your `Account SID`, `Auth Token`, and outbound phone number.
   - Configure Twilio Voice Status Callback URL to `https://<your-domain>/api/webhooks/calling`.
   - Connect via **Settings → Integrations → Phone / Calling Provider**.

---

## 4. Production Deployment to Vercel & Supabase (Part 15)

1. **Apply Supabase SQL Migrations:**
   - Open your Supabase project SQL Editor and run in order:
     1. `supabase/migrations/20261120000001_core_schema.sql`
     2. `supabase/migrations/20261120000002_rls_and_rpcs.sql`
     3. `supabase/migrations/20261120000003_migrated_data.sql`
   - Create a private storage bucket named `agency-documents`.

2. **Deploy to Vercel:**
   ```bash
   npx vercel deploy --prod
   ```
   Configure the environment variables listed in [.env.example](.env.example) inside your Vercel Project Settings.
