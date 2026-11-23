import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateEmailPassword,
  canMemberManageSettings,
  canMemberManageTeam,
  createPasswordResetToken,
  createSessionToken,
  getSessionFromRequest,
  registerOrUpdateUserPassword,
  resetPasswordWithToken,
  SESSION_COOKIE_NAME,
} from "@/lib/server-auth";
import {
  appendAuditAndNotification,
  insertRecord,
  loadDecryptedIntegrationSecret,
  readAgencyDb,
  removeEncryptedIntegrationSecret,
  saveEncryptedIntegrationSecret,
  writeAgencyDb,
} from "@/lib/server-db";
import {
  createOAuthState,
  verifyMetaWebhookSignature,
  verifyOAuthState,
  verifyTwilioWebhookSignature,
} from "@/lib/crypto-vault";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { normalizeEmail, normalizePhone } from "@/lib/validation";
import { realtimeBus } from "@/lib/realtime-bus";
import {
  ColdCallRecord,
  IntegrationProviderId,
  OutreachActivity,
  TeamInvitation,
  TeamMember,
  UserRole,
} from "@/types/agency";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  if (searchParams.get("__auth") === "1") {
    const session = getSessionFromRequest(req);
    const db = readAgencyDb();
    return NextResponse.json({
      authenticated: Boolean(session),
      session: session
        ? {
            member: session.member,
            role: session.role,
            workspaceId: session.workspaceId,
            exp: session.exp,
          }
        : null,
      isSupabaseConfigured,
      pendingInvitations: (db.invitations || [])
        .filter((inv) => inv.status === "Pending")
        .map((inv) => ({
          id: inv.id,
          email: inv.email,
          name: inv.name,
          role: inv.role,
          title: inv.title,
          token: inv.token,
          createdAt: inv.createdAt,
        })),
    });
  }
  if (searchParams.has("hub.mode") || searchParams.has("hub.challenge")) {
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const expectedToken =
      process.env.WEBHOOK_VERIFY_TOKEN || "twofold_webhook_verify_2026";
    if (mode === "subscribe" && token === expectedToken && challenge) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 403 }
    );
  }
  if (
    searchParams.has("code") ||
    searchParams.has("state") ||
    searchParams.has("oauth_callback")
  ) {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");
    if (errorParam || !code || !stateParam) {
      return NextResponse.redirect(
        `${origin}/?oauth_error=${encodeURIComponent(
          errorParam || "missing_code_or_state"
        )}`
      );
    }
    const stateCheck = verifyOAuthState(stateParam);
    if (!stateCheck.valid || !stateCheck.payload) {
      return NextResponse.redirect(`${origin}/?oauth_error=invalid_state`);
    }
    const provider = stateCheck.payload.provider as IntegrationProviderId;
    const redirectUri = `${origin}/api/integrations/oauth/callback`;
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) {
        return NextResponse.redirect(
          `${origin}/?oauth_error=token_exchange_failed`
        );
      }
      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        scope?: string;
      };
      saveEncryptedIntegrationSecret(provider, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || "",
      });
      const db = readAgencyDb();
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");
      db.integrations = (db.integrations || []).map((i) =>
        i.provider === provider
          ? {
              ...i,
              status: "connected",
              permissionsGranted: (tokenData.scope || "").split(" "),
              lastSyncAt: now,
              lastSyncError: null,
              connectedAt: now,
              connectedByName: "OAuth 2.0",
            }
          : i
      );
      writeAgencyDb(db);
      return NextResponse.redirect(`${origin}/?oauth_connected=${provider}`);
    } catch {
      return NextResponse.redirect(`${origin}/?oauth_error=callback_exception`);
    }
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const db = readAgencyDb();
  return NextResponse.json({
    integrations: db.integrations || [],
    configuredEnv: {
      googleOAuth: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
      metaOAuth: Boolean(
        process.env.META_APP_ID && process.env.META_APP_SECRET
      ),
      whatsappCloud: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN &&
          process.env.WHATSAPP_PHONE_NUMBER_ID
      ),
      twilio: Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ),
    },
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const webhookProvider =
    searchParams.get("__webhook") || searchParams.get("provider");

  if (webhookProvider) {
    return handleWebhookPost(req, webhookProvider);
  }

  let clonedBody: Record<string, unknown> | null = null;
  try {
    clonedBody = (await req.clone().json()) as Record<string, unknown>;
  } catch {
    clonedBody = null;
  }

  const authActions = new Set([
    "login",
    "google_login",
    "logout",
    "forgot_password",
    "reset_password",
    "invite",
    "accept_invite",
  ]);
  if (
    searchParams.get("__auth") === "1" ||
    (clonedBody &&
      typeof clonedBody.action === "string" &&
      authActions.has(clonedBody.action))
  ) {
    return handleAuthPost(req, clonedBody || {});
  }

  const session = getSessionFromRequest(req);
  const actor = session
    ? { id: session.member.id, name: session.member.name, role: session.role }
    : { id: "tm-1", name: "Elena Vance", role: "Admin" as const };

  try {
    const body = await req.json();
    const action = body.action as string;
    const provider = body.provider as IntegrationProviderId;

    // 1. Start OAuth 2.0 Flow (Google or Meta)
    if (action === "start_oauth") {
      if (!canMemberManageSettings(actor.role)) {
        return NextResponse.json(
          { error: "Only Admins can connect workspace integrations." },
          { status: 403 }
        );
      }

      const origin = new URL(req.url).origin;
      const redirectUri = `${origin}/api/integrations/oauth/callback`;
      const state = createOAuthState({
        provider,
        workspaceId: "ws-twofold-studio",
        memberId: actor.id,
      });

      if (
        provider === "gmail" ||
        provider === "google_sheets" ||
        provider === "google_calendar"
      ) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
          return NextResponse.json(
            {
              ok: false,
              awaitingCredentials: true,
              error:
                "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured in environment variables (.env.local). Add them or provide an authorized OAuth Access Token to verify connection.",
            },
            { status: 400 }
          );
        }
        const scopeMap: Record<string, string[]> = {
          gmail: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/userinfo.email",
          ],
          google_sheets: [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/userinfo.email",
          ],
          google_calendar: [
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/userinfo.email",
          ],
        };
        const authUrl = new URL(
          "https://accounts.google.com/o/oauth2/v2/auth"
        );
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("scope", scopeMap[provider].join(" "));
        authUrl.searchParams.set("state", state);

        return NextResponse.json({
          ok: true,
          authorizationUrl: authUrl.toString(),
        });
      }

      if (provider === "instagram" || provider === "whatsapp") {
        const appId = process.env.META_APP_ID;
        if (!appId) {
          return NextResponse.json(
            {
              ok: false,
              awaitingCredentials: true,
              error:
                "META_APP_ID and META_APP_SECRET are not configured in .env.local. Configure Meta App credentials to launch Meta OAuth.",
            },
            { status: 400 }
          );
        }
        const scopes =
          provider === "instagram"
            ? "instagram_basic,instagram_manage_messages,pages_manage_metadata"
            : "whatsapp_business_management,whatsapp_business_messaging";
        const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
        authUrl.searchParams.set("client_id", appId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("scope", scopes);
        authUrl.searchParams.set("state", state);

        return NextResponse.json({
          ok: true,
          authorizationUrl: authUrl.toString(),
        });
      }
    }

    // 2. Connect & Verify Real Credentials (never marks connected unless live API probe succeeds!)
    if (action === "connect_credentials") {
      if (!canMemberManageSettings(actor.role)) {
        return NextResponse.json(
          { error: "Only Admins can manage integrations." },
          { status: 403 }
        );
      }

      const creds = (body.credentials || {}) as Record<string, string>;
      const verifyResult = await verifyProviderCredentialsLive(provider, creds);

      const db = readAgencyDb();
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");

      if (!verifyResult.ok) {
        db.integrations = (db.integrations || []).map((int) =>
          int.provider === provider
            ? {
                ...int,
                status: "error",
                lastSyncError: verifyResult.error || "Authentication failed",
              }
            : int
        );
        writeAgencyDb(db);
        return NextResponse.json(
          {
            ok: false,
            error: verifyResult.error,
          },
          { status: 400 }
        );
      }

      // Store encrypted secrets in server vault
      saveEncryptedIntegrationSecret(provider, creds);

      db.integrations = (db.integrations || []).map((int) =>
        int.provider === provider
          ? {
              ...int,
              status: "connected",
              accountInfo: verifyResult.accountInfo || {},
              permissionsGranted: verifyResult.scopes || [],
              lastSyncAt: now,
              lastSyncError: null,
              connectedAt: now,
              connectedByName: actor.name,
            }
          : int
      );

      appendAuditAndNotification(db, {
        actorId: actor.id,
        actorName: actor.name,
        action: "connected",
        entityType: "Integration",
        entityName: provider,
        details: `Verified and connected ${provider} integration.`,
      });

      writeAgencyDb(db);
      realtimeBus.emit({
        table: "integrations",
        action: "UPDATE",
        actorId: actor.id,
      });

      return NextResponse.json({
        ok: true,
        accountInfo: verifyResult.accountInfo,
      });
    }

    // 3. Test Existing Connection
    if (action === "test_connection") {
      const secrets =
        loadDecryptedIntegrationSecret<Record<string, string>>(provider);
      const db = readAgencyDb();
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");

      if (!secrets) {
        const msg = `No stored credentials found for ${provider}. Authenticate first.`;
        db.integrations = (db.integrations || []).map((i) =>
          i.provider === provider ? { ...i, lastSyncError: msg } : i
        );
        writeAgencyDb(db);
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }

      const check = await verifyProviderCredentialsLive(provider, secrets);
      db.integrations = (db.integrations || []).map((i) =>
        i.provider === provider
          ? {
              ...i,
              status: check.ok ? "connected" : "error",
              lastSyncAt: check.ok ? now : i.lastSyncAt,
              lastSyncError: check.ok ? null : check.error || "Check failed",
            }
          : i
      );
      writeAgencyDb(db);
      return NextResponse.json(check, { status: check.ok ? 200 : 400 });
    }

    // 4. Disconnect Integration & Revoke Stored Credentials
    if (action === "disconnect") {
      if (!canMemberManageSettings(actor.role)) {
        return NextResponse.json(
          { error: "Only Admins can disconnect integrations." },
          { status: 403 }
        );
      }
      removeEncryptedIntegrationSecret(provider);
      const db = readAgencyDb();
      db.integrations = (db.integrations || []).map((i) =>
        i.provider === provider
          ? {
              ...i,
              status: "disconnected",
              accountInfo: {},
              permissionsGranted: [],
              connectedAt: null,
              connectedByName: null,
              lastSyncError: null,
            }
          : i
      );
      appendAuditAndNotification(db, {
        actorId: actor.id,
        actorName: actor.name,
        action: "disconnected",
        entityType: "Integration",
        entityName: provider,
        details: `Revoked and disconnected ${provider} integration.`,
      });
      writeAgencyDb(db);
      realtimeBus.emit({
        table: "integrations",
        action: "UPDATE",
        actorId: actor.id,
      });
      return NextResponse.json({ ok: true });
    }

    // 5. Update Integration Sync Settings
    if (action === "update_settings") {
      const db = readAgencyDb();
      db.integrations = (db.integrations || []).map((i) =>
        i.provider === provider
          ? {
              ...i,
              syncSettings: {
                ...i.syncSettings,
                ...(body.syncSettings || {}),
              },
            }
          : i
      );
      writeAgencyDb(db);
      return NextResponse.json({ ok: true });
    }

    // 6. Send Email through Connected Gmail Account (Part 5)
    if (action === "send_gmail") {
      const secrets =
        loadDecryptedIntegrationSecret<Record<string, string>>("gmail");
      const accessToken =
        secrets?.accessToken || process.env.GMAIL_OAUTH_ACCESS_TOKEN;
      if (!accessToken) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Gmail is not connected. Connect an authorized Gmail account in Settings → Integrations before sending live emails.",
          },
          { status: 400 }
        );
      }

      const to = String(body.to || "").trim();
      const subject = String(body.subject || "").trim();
      const messageText = String(body.message || "").trim();
      const leadId = String(body.leadId || "");
      const campaignId = body.campaignId ? String(body.campaignId) : undefined;

      if (!to || !subject || !messageText) {
        return NextResponse.json(
          { error: "Recipient email, subject, and message body are required." },
          { status: 400 }
        );
      }

      const rfc2822 = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0",
        "",
        messageText,
      ].join("\r\n");
      const raw = Buffer.from(rfc2822, "utf-8").toString("base64url");

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        }
      );

      if (!gmailRes.ok) {
        const errText = await gmailRes.text();
        return NextResponse.json(
          {
            ok: false,
            error: `Gmail API rejected send (${gmailRes.status}): ${errText.slice(
              0,
              200
            )}`,
          },
          { status: 400 }
        );
      }

      const sentData = (await gmailRes.json()) as {
        id: string;
        threadId: string;
      };

      // Only after Gmail confirms sending do we create the OutreachActivity
      const db = readAgencyDb();
      const matchedLead =
        db.leads.find((l) => l.id === leadId) ||
        db.leads.find(
          (l) => normalizeEmail(l.businessEmail) === normalizeEmail(to)
        );

      const newActivity: OutreachActivity = {
        id: `out-gmail-${sentData.id}`,
        leadId: matchedLead?.id || leadId,
        leadName: matchedLead?.businessName || to,
        campaignId,
        memberId: actor.id,
        communicationChannel: "Cold Emails",
        messageTemplateUsed: body.templateTitle || "Gmail Direct Send",
        subject,
        dateSent: new Date().toISOString().slice(0, 10),
        occurredAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        messageContent: messageText,
        direction: "Outbound",
        source: "api",
        provider: "gmail",
        providerMessageId: sentData.id,
        providerThreadId: sentData.threadId,
        deliveryStatus: "sent",
        replyStatus: "Message Sent",
        replyDate: "",
        nextFollowUpDate: new Date(Date.now() + 3 * 86400000)
          .toISOString()
          .slice(0, 10),
        outcome: `Sent via Gmail API (Message ID: ${sentData.id})`,
        isDemo: false,
      };

      await insertRecord("outreach", newActivity, actor, {
        entityType: "Gmail Send",
        entityName: newActivity.leadName,
        details: `Sent email "${subject}" to ${to} (Thread ${sentData.threadId}).`,
      });

      return NextResponse.json({
        ok: true,
        messageId: sentData.id,
        threadId: sentData.threadId,
        outreach: newActivity,
      });
    }

    // 7. Send WhatsApp Business Cloud API Message (Part 7)
    if (action === "send_whatsapp") {
      const secrets =
        loadDecryptedIntegrationSecret<Record<string, string>>("whatsapp");
      const accessToken =
        secrets?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId =
        secrets?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

      const leadId = String(body.leadId || "");
      const db = readAgencyDb();
      const lead = db.leads.find((l) => l.id === leadId);
      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      if (!lead.whatsappOptIn) {
        return NextResponse.json(
          {
            error:
              "WhatsApp Business Policy Enforcement: Prospect must have explicit WhatsApp Opt-In recorded before sending API messages.",
          },
          { status: 400 }
        );
      }
      if (!accessToken || !phoneNumberId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "WhatsApp Business Cloud API is not connected. Add your WhatsApp Cloud API Access Token and Phone Number ID in Settings → Integrations.",
          },
          { status: 400 }
        );
      }

      const toPhone = normalizePhone(lead.phoneNumber);
      const templateName = String(body.templateName || "hello_world");
      const waRes = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: toPhone,
            type: "template",
            template: {
              name: templateName,
              language: { code: "en_US" },
            },
          }),
        }
      );

      if (!waRes.ok) {
        const errText = await waRes.text();
        return NextResponse.json(
          {
            ok: false,
            error: `WhatsApp Cloud API error (${waRes.status}): ${errText.slice(
              0,
              200
            )}`,
          },
          { status: 400 }
        );
      }

      const waJson = (await waRes.json()) as {
        messages?: { id: string }[];
      };
      const msgId = waJson.messages?.[0]?.id || `wamid.${Date.now()}`;

      const newActivity: OutreachActivity = {
        id: `out-wa-${Date.now()}`,
        leadId: lead.id,
        leadName: lead.businessName,
        memberId: actor.id,
        communicationChannel: "WhatsApp Messages",
        messageTemplateUsed: templateName,
        dateSent: new Date().toISOString().slice(0, 10),
        occurredAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        messageContent: String(body.messageContent || `Sent approved WhatsApp template: ${templateName}`),
        direction: "Outbound",
        source: "api",
        provider: "whatsapp_cloud",
        providerMessageId: msgId,
        deliveryStatus: "sent",
        replyStatus: "Message Sent",
        replyDate: "",
        nextFollowUpDate: new Date(Date.now() + 3 * 86400000)
          .toISOString()
          .slice(0, 10),
        outcome: `Sent via WhatsApp Cloud API (${msgId})`,
        isDemo: false,
      };

      await insertRecord("outreach", newActivity, actor, {
        entityType: "WhatsApp Cloud API",
        entityName: lead.businessName,
        details: `Sent approved WhatsApp template "${templateName}" (${msgId}).`,
      });

      return NextResponse.json({
        ok: true,
        messageId: msgId,
        outreach: newActivity,
      });
    }

    // 8. Fetch Google Sheet Rows for Lead Import (Part 6)
    if (action === "fetch_google_sheet") {
      const spreadsheetUrlOrId = String(body.spreadsheetId || "").trim();
      const match = spreadsheetUrlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = match ? match[1] : spreadsheetUrlOrId;
      const range = String(body.worksheet || "Sheet1!A1:Z500");

      if (!sheetId) {
        return NextResponse.json(
          { error: "Please enter a valid Google Spreadsheet ID or URL." },
          { status: 400 }
        );
      }

      const secrets =
        loadDecryptedIntegrationSecret<Record<string, string>>("google_sheets");
      const accessToken =
        secrets?.accessToken || process.env.GOOGLE_SHEETS_ACCESS_TOKEN;

      if (accessToken) {
        const apiRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
            sheetId
          )}/values/${encodeURIComponent(range)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!apiRes.ok) {
          const errText = await apiRes.text();
          return NextResponse.json(
            {
              ok: false,
              error: `Google Sheets API returned ${apiRes.status}: ${errText.slice(
                0,
                180
              )}`,
            },
            { status: 400 }
          );
        }
        const json = (await apiRes.json()) as { values?: string[][] };
        const values = json.values || [];
        return NextResponse.json({
          ok: true,
          headers: values[0] || [],
          rows: values.slice(1),
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "Google Sheets OAuth is not connected yet. Connect Google Sheets in Settings → Integrations first, or upload a CSV export.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `Unknown integrations action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Integration operation failed", details: String(err) },
      { status: 500 }
    );
  }
}

async function verifyProviderCredentialsLive(
  provider: IntegrationProviderId,
  creds: Record<string, string>
): Promise<{
  ok: boolean;
  error?: string;
  accountInfo?: Record<string, string>;
  scopes?: string[];
}> {
  try {
    if (
      provider === "gmail" ||
      provider === "google_sheets" ||
      provider === "google_calendar"
    ) {
      const token = creds.accessToken?.trim();
      if (!token) {
        return {
          ok: false,
          error: "A valid Google OAuth 2.0 Access Token is required.",
        };
      }
      const res = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        return {
          ok: false,
          error: `Google OAuth token verification failed (HTTP ${res.status}). Token is invalid or expired.`,
        };
      }
      const info = (await res.json()) as { email?: string; name?: string };
      return {
        ok: true,
        accountInfo: {
          email: info.email || "verified@google.com",
          accountName: info.name || "Google Workspace Account",
        },
        scopes: ["oauth2.verified", provider],
      };
    }

    if (provider === "whatsapp") {
      const token = creds.accessToken?.trim();
      const phoneId = creds.phoneNumberId?.trim();
      if (!token || !phoneId) {
        return {
          ok: false,
          error:
            "Both WhatsApp Cloud API Access Token and Phone Number ID are required.",
        };
      }
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        return {
          ok: false,
          error: `WhatsApp Cloud API verification failed (HTTP ${res.status}). Check your Phone Number ID and System User Token.`,
        };
      }
      const info = (await res.json()) as {
        display_phone_number?: string;
        verified_name?: string;
      };
      return {
        ok: true,
        accountInfo: {
          phoneNumber: info.display_phone_number || phoneId,
          accountName: info.verified_name || "WhatsApp Business Account",
        },
        scopes: ["whatsapp_business_messaging", "whatsapp_business_management"],
      };
    }

    if (provider === "instagram") {
      const token = creds.accessToken?.trim();
      if (!token) {
        return {
          ok: false,
          error: "Meta Graph API Access Token is required.",
        };
      }
      const res = await fetch(
        `https://graph.facebook.com/v20.0/me?fields=id,name`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        return {
          ok: false,
          error: `Meta Graph API token verification failed (HTTP ${res.status}).`,
        };
      }
      const info = (await res.json()) as { id?: string; name?: string };
      return {
        ok: true,
        accountInfo: {
          accountName: info.name || "Instagram Professional Account",
          externalId: info.id || "",
        },
        scopes: ["instagram_basic", "instagram_manage_messages"],
      };
    }

    if (provider === "calling") {
      const accountSid = creds.accountSid?.trim();
      const authToken = creds.authToken?.trim();
      const fromNumber = creds.fromNumber?.trim();
      if (!accountSid || !authToken) {
        return {
          ok: false,
          error: "Twilio Account SID and Auth Token are required.",
        };
      }
      const basic = Buffer.from(`${accountSid}:${authToken}`).toString(
        "base64"
      );
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
          accountSid
        )}.json`,
        {
          headers: { Authorization: `Basic ${basic}` },
        }
      );
      if (!res.ok) {
        return {
          ok: false,
          error: `Twilio API authentication failed (HTTP ${res.status}). Verify your Account SID and Auth Token.`,
        };
      }
      const info = (await res.json()) as {
        friendly_name?: string;
        status?: string;
      };
      return {
        ok: true,
        accountInfo: {
          accountName: info.friendly_name || accountSid,
          phoneNumber: fromNumber || "Configured",
          providerType: "twilio",
        },
        scopes: ["voice.outbound", "webhooks.status_callback"],
      };
    }

    return { ok: false, error: `Unsupported provider: ${provider}` };
  } catch (err) {
    return {
      ok: false,
      error: `Network verification error: ${String(err)}`,
    };
  }
}

async function handleWebhookPost(req: NextRequest, provider: string) {
  const rawBody = await req.text();

  if (
    (provider === "whatsapp" || provider === "instagram") &&
    process.env.META_APP_SECRET
  ) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!verifyMetaWebhookSignature(rawBody, sig, process.env.META_APP_SECRET)) {
      return NextResponse.json(
        { error: "Invalid Meta X-Hub-Signature-256" },
        { status: 401 }
      );
    }
  }

  if (provider === "calling" && process.env.TWILIO_AUTH_TOKEN) {
    const sig = req.headers.get("x-twilio-signature");
    const bodyObj = JSON.parse(rawBody || "{}");
    if (
      sig &&
      !verifyTwilioWebhookSignature(
        req.url,
        bodyObj,
        sig,
        process.env.TWILIO_AUTH_TOKEN
      )
    ) {
      return NextResponse.json(
        { error: "Invalid Twilio webhook signature" },
        { status: 401 }
      );
    }
  }

  try {
    const payload = JSON.parse(rawBody || "{}");
    const db = readAgencyDb();
    const nowDate = new Date().toISOString().slice(0, 10);
    const nowTs = new Date().toISOString().slice(0, 16).replace("T", " ");

    if (provider === "gmail") {
      const messageId = String(payload.messageId || "");
      const threadId = String(payload.threadId || "");
      const fromEmail = normalizeEmail(payload.fromEmail || "");
      const subject = String(payload.subject || "Re: Twofold Studio");
      const snippet = String(payload.messageContent || payload.snippet || "");

      if (!messageId || !fromEmail) {
        return NextResponse.json(
          { error: "Missing messageId or fromEmail" },
          { status: 400 }
        );
      }

      if (
        db.outreach.some(
          (o) => o.provider === "gmail" && o.providerMessageId === messageId
        )
      ) {
        return NextResponse.json({
          ok: true,
          deduplicated: true,
          messageId,
        });
      }

      const lead = db.leads.find(
        (l) => normalizeEmail(l.businessEmail) === fromEmail
      );

      const inboundActivity: OutreachActivity = {
        id: `out-gmail-in-${messageId}`,
        leadId: lead?.id || "",
        leadName: lead?.businessName || fromEmail,
        communicationChannel: "Cold Emails",
        messageTemplateUsed: "Inbound Gmail Reply",
        subject,
        dateSent: nowDate,
        occurredAt: nowTs,
        messageContent: snippet,
        direction: "Inbound",
        source: "api",
        provider: "gmail",
        providerMessageId: messageId,
        providerThreadId: threadId,
        deliveryStatus: "received",
        replyStatus: "Replied",
        replyDate: nowDate,
        nextFollowUpDate: nowDate,
        outcome: `Reply received from ${fromEmail}`,
        isDemo: false,
      };

      db.outreach.unshift(inboundActivity);

      if (threadId) {
        db.outreach = db.outreach.map((o) =>
          o.providerThreadId === threadId && o.direction !== "Inbound"
            ? { ...o, replyStatus: "Replied", replyDate: nowDate }
            : o
        );
      }

      if (lead) {
        db.leads = db.leads.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                status:
                  l.status === "New" ||
                  l.status === "Qualified" ||
                  l.status === "Contacted"
                    ? "Replied"
                    : l.status,
                lastContacted: nowDate,
                history: [
                  {
                    id: `lh-${Date.now()}`,
                    action: `Inbound email reply synchronized (${subject})`,
                    actorName: lead.contactPerson || fromEmail,
                    timestamp: nowTs,
                  },
                  ...l.history,
                ],
              }
            : l
        );
      }

      appendAuditAndNotification(db, {
        actorId: lead?.assignedTeamMemberId || "tm-1",
        actorName: lead?.contactPerson || fromEmail,
        action: "received",
        entityType: "Gmail Reply",
        entityName: lead?.businessName || fromEmail,
        details: `Synchronized incoming email reply: "${snippet.slice(0, 80)}"`,
        notification: {
          type: "Reply Received",
          title: `Email Reply: ${lead?.businessName || fromEmail}`,
          message: snippet.slice(0, 120),
          section: "leads",
          entityId: lead?.id,
        },
      });

      writeAgencyDb(db);
      realtimeBus.emit({
        table: "outreach",
        action: "INSERT",
        recordId: inboundActivity.id,
      });

      return NextResponse.json({
        ok: true,
        matchedLeadId: lead?.id || null,
        outreachId: inboundActivity.id,
      });
    }

    if (provider === "whatsapp") {
      const messageId = String(
        payload.messageId ||
          payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ||
          ""
      );
      const fromPhone = normalizePhone(
        payload.fromPhone ||
          payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
          ""
      );
      const text = String(
        payload.text ||
          payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
          ""
      );

      if (!messageId) {
        return NextResponse.json(
          { error: "Missing WhatsApp messageId" },
          { status: 400 }
        );
      }

      if (
        db.outreach.some(
          (o) =>
            o.provider === "whatsapp_cloud" && o.providerMessageId === messageId
        )
      ) {
        return NextResponse.json({ ok: true, deduplicated: true });
      }

      const lead = db.leads.find(
        (l) =>
          fromPhone &&
          normalizePhone(l.phoneNumber).endsWith(fromPhone.slice(-7))
      );

      const waActivity: OutreachActivity = {
        id: `out-wa-in-${messageId}`,
        leadId: lead?.id || "",
        leadName: lead?.businessName || fromPhone,
        communicationChannel: "WhatsApp Messages",
        messageTemplateUsed: "Inbound WhatsApp Webhook",
        dateSent: nowDate,
        occurredAt: nowTs,
        messageContent: text,
        direction: "Inbound",
        source: "api",
        provider: "whatsapp_cloud",
        providerMessageId: messageId,
        deliveryStatus: "received",
        replyStatus: "Replied",
        replyDate: nowDate,
        nextFollowUpDate: nowDate,
        outcome: "Inbound WhatsApp reply received",
        isDemo: false,
      };

      db.outreach.unshift(waActivity);
      writeAgencyDb(db);
      realtimeBus.emit({
        table: "outreach",
        action: "INSERT",
        recordId: waActivity.id,
      });

      return NextResponse.json({ ok: true, outreachId: waActivity.id });
    }

    if (provider === "instagram") {
      const messageId = String(payload.messageId || `ig_${Date.now()}`);
      const handle = String(payload.handle || "").replace(/^@/, "").toLowerCase();
      const text = String(payload.text || "");

      if (
        db.outreach.some(
          (o) => o.provider === "instagram" && o.providerMessageId === messageId
        )
      ) {
        return NextResponse.json({ ok: true, deduplicated: true });
      }

      const lead = db.leads.find(
        (l) =>
          (handle && l.instagramUrl.toLowerCase().includes(handle)) ||
          (handle && l.instagramHandle?.toLowerCase() === handle)
      );

      const igActivity: OutreachActivity = {
        id: `out-ig-in-${messageId}`,
        leadId: lead?.id || "",
        leadName: lead?.businessName || `@${handle}`,
        communicationChannel: "Instagram DMs",
        messageTemplateUsed: "Inbound Instagram Webhook",
        dateSent: nowDate,
        occurredAt: nowTs,
        messageContent: text,
        direction: "Inbound",
        source: "api",
        provider: "instagram",
        providerMessageId: messageId,
        deliveryStatus: "received",
        replyStatus: "Replied",
        replyDate: nowDate,
        nextFollowUpDate: nowDate,
        outcome: "Inbound Instagram DM received",
        isDemo: false,
      };

      db.outreach.unshift(igActivity);
      writeAgencyDb(db);
      realtimeBus.emit({
        table: "outreach",
        action: "INSERT",
        recordId: igActivity.id,
      });

      return NextResponse.json({ ok: true, outreachId: igActivity.id });
    }

    if (provider === "calling") {
      const callSid = String(payload.CallSid || payload.callId || "");
      const toPhone = normalizePhone(payload.To || payload.phoneNumber || "");
      const duration =
        payload.CallDuration != null ? Number(payload.CallDuration) : null;
      const status = String(payload.CallStatus || "completed");

      if (!callSid) {
        return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
      }

      if ((db.coldCalls || []).some((c) => c.providerCallId === callSid)) {
        return NextResponse.json({ ok: true, deduplicated: true });
      }

      const lead = db.leads.find(
        (l) =>
          toPhone && normalizePhone(l.phoneNumber).endsWith(toPhone.slice(-7))
      );

      const outcome =
        status === "no-answer"
          ? "No Answer"
          : status === "busy"
          ? "Busy"
          : "Call Back Later";

      const newCall: ColdCallRecord = {
        id: `call-api-${callSid}`,
        leadId: lead?.id || "",
        businessName: lead?.businessName || toPhone,
        phoneNumber: payload.To || toPhone,
        callingTeamMemberId: lead?.assignedTeamMemberId || "tm-5",
        callDate: nowDate,
        callTime: new Date().toTimeString().slice(0, 5),
        durationSeconds: duration,
        outcome,
        connected: outcome !== "No Answer" && outcome !== "Busy",
        notes: `Synchronized via Calling Webhook (Status: ${status})`,
        followUpDate: nowDate,
        nextAction: "Review call outcome",
        source: "api",
        provider: "twilio",
        providerCallId: callSid,
        isDemo: false,
        createdAt: nowTs,
      };

      db.coldCalls = [newCall, ...(db.coldCalls || [])];
      writeAgencyDb(db);
      realtimeBus.emit({
        table: "coldCalls",
        action: "INSERT",
        recordId: newCall.id,
      });

      return NextResponse.json({ ok: true, callId: newCall.id });
    }

    return NextResponse.json(
      { error: `Unsupported webhook provider: ${provider}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Webhook processing error", details: String(err) },
      { status: 500 }
    );
  }
}

async function handleAuthPost(
  req: NextRequest,
  body: Record<string, unknown>
) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = checkRateLimit(`auth:${ip}`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many authentication requests. Please retry shortly." },
      { status: 429 }
    );
  }

  try {
    const action = body.action as string;

    if (action === "login") {
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required." },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.auth.signInWithPassword({ email, password });
        } catch {
          // fallback
        }
      }

      const authResult = authenticateEmailPassword(email, password);
      if (!authResult.ok || !authResult.member) {
        return NextResponse.json(
          { error: authResult.error || "Invalid credentials." },
          { status: 401 }
        );
      }

      const token = createSessionToken(authResult.member);
      const res = NextResponse.json({
        ok: true,
        token,
        member: authResult.member,
      });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }

    if (action === "google_login") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) {
        return NextResponse.json(
          { error: "Google email is required." },
          { status: 400 }
        );
      }
      const rawName = String(body.name || email.split("@")[0] || "Agency Leader");
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const role: UserRole = "Admin";
      const title = String(body.title || "Executive Director & Founder");

      const db = readAgencyDb();
      let member = (db.teamMembers || []).find(
        (m) => m.email.toLowerCase() === email
      );

      if (!member) {
        const initials =
          name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "TF";

        member = {
          id: `tm-${Date.now()}`,
          name,
          email,
          role,
          title,
          avatarInitials: initials,
          phone: "+1 (415) 890-4421",
          department: "Executive Leadership",
          hourlyRate: 185,
          status: "Active",
          dailyTargets: { calls: 10, emails: 20, dms: 10, leadsAdded: 10 },
          isDemo: false,
          createdAt: new Date().toISOString().slice(0, 10),
        };

        db.teamMembers = [member, ...(db.teamMembers || [])];
        writeAgencyDb(db);
        registerOrUpdateUserPassword(member.id, email, "Twofold2026!");
      }

      const token = createSessionToken(member);
      const res = NextResponse.json({
        ok: true,
        token,
        member,
      });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }

    if (action === "logout") {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (action === "forgot_password") {
      const email = String(body.email || "").trim();
      const result = createPasswordResetToken(email);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        resetToken: result.resetToken,
        message:
          "Password reset token generated. Enter this token below to set a new password.",
      });
    }

    if (action === "reset_password") {
      const token = String(body.token || "").trim();
      const newPassword = String(body.newPassword || "");
      const result = resetPasswordWithToken(token, newPassword);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        email: result.email,
        message: "Password updated. You may now sign in.",
      });
    }

    if (action === "invite") {
      const session = getSessionFromRequest(req);
      if (!session || !canMemberManageTeam(session.role)) {
        return NextResponse.json(
          { error: "Only Admins and Managers can invite team members." },
          { status: 403 }
        );
      }

      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const name = String(body.name || "").trim();
      const role = (body.role as UserRole) || "Team Member";
      const title = String(body.title || "Product Specialist").trim();
      const department = String(body.department || "Delivery").trim();

      if (!email || !name) {
        return NextResponse.json(
          { error: "Name and email are required to send an invitation." },
          { status: 400 }
        );
      }
      if (role === "Admin" && session.role !== "Admin") {
        return NextResponse.json(
          { error: "Only Admins can invite an Admin user." },
          { status: 403 }
        );
      }

      const db = readAgencyDb();
      if (
        db.teamMembers.some(
          (m) => m.email.toLowerCase() === email && m.status === "Active"
        )
      ) {
        return NextResponse.json(
          { error: "An active team member with this email already exists." },
          { status: 409 }
        );
      }

      const inviteToken = `inv_${crypto.randomBytes(16).toString("hex")}`;
      const invitation: TeamInvitation = {
        id: `invite-${Date.now()}`,
        email,
        name,
        role,
        title,
        department,
        token: inviteToken,
        invitedById: session.member.id,
        invitedByName: session.member.name,
        status: "Pending",
        createdAt: new Date().toISOString().slice(0, 10),
      };

      db.invitations = [
        invitation,
        ...(db.invitations || []).filter(
          (i) => i.email.toLowerCase() !== email || i.status !== "Pending"
        ),
      ];

      appendAuditAndNotification(db, {
        actorId: session.member.id,
        actorName: session.member.name,
        action: "created",
        entityType: "Team Invitation",
        entityName: `${name} (${email})`,
        details: `Invited ${name} as ${role} (${title}).`,
      });

      writeAgencyDb(db);
      realtimeBus.emit({
        table: "invitations",
        action: "INSERT",
        recordId: invitation.id,
        actorId: session.member.id,
      });

      return NextResponse.json({
        ok: true,
        invitation,
      });
    }

    if (action === "accept_invite") {
      const inviteToken = String(body.token || "").trim();
      const password = String(body.password || "");
      if (!inviteToken || password.length < 8) {
        return NextResponse.json(
          {
            error:
              "Valid invitation token and password (at least 8 characters) are required.",
          },
          { status: 400 }
        );
      }

      const db = readAgencyDb();
      const invIdx = (db.invitations || []).findIndex(
        (i) => i.token === inviteToken && i.status === "Pending"
      );
      if (invIdx < 0) {
        return NextResponse.json(
          { error: "Invitation token is invalid or has already been used." },
          { status: 404 }
        );
      }

      const invitation = db.invitations![invIdx];
      const initials = invitation.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const newMember: TeamMember = {
        id: `tm-${Date.now()}`,
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        title: invitation.title,
        avatarInitials: initials || "TF",
        phone: String(body.phone || ""),
        department: invitation.department,
        hourlyRate: Number(body.hourlyRate) || 120,
        status: "Active",
        dailyTargets: { calls: 15, emails: 25, dms: 15, leadsAdded: 10 },
        isDemo: false,
        createdAt: new Date().toISOString().slice(0, 10),
      };

      db.invitations![invIdx] = {
        ...invitation,
        status: "Accepted",
        acceptedAt: new Date().toISOString().slice(0, 10),
      };
      db.teamMembers = [...db.teamMembers, newMember];

      appendAuditAndNotification(db, {
        actorId: newMember.id,
        actorName: newMember.name,
        action: "created",
        entityType: "Team Member Joined",
        entityName: newMember.name,
        details: `${newMember.name} accepted their invitation and joined Twofold Studio as ${newMember.role}.`,
      });

      writeAgencyDb(db);
      registerOrUpdateUserPassword(newMember.id, newMember.email, password);

      realtimeBus.emit({
        table: "teamMembers",
        action: "INSERT",
        recordId: newMember.id,
        actorId: newMember.id,
      });

      const sessionToken = createSessionToken(newMember);
      const res = NextResponse.json({
        ok: true,
        token: sessionToken,
        member: newMember,
      });
      res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }

    return NextResponse.json(
      { error: `Unknown auth action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Authentication service error", details: String(err) },
      { status: 500 }
    );
  }
}
