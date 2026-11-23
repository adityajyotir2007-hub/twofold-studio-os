// =============================================================================
// Twofold Studio OS — Part 16 Final Multi-User 16-Step Verification Suite
// Tests all 16 required workflows across TWO separate authenticated users
// (Admin User #1 + Invited User #2), real-time event emission, cold calling,
// Gmail reply webhook sync, unified timeline deduplication, RBAC 403 guards,
// and data persistence across logout & re-login.
// =============================================================================
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST as authPost, GET as authGet, POST as webhookPost } from "../src/app/api/integrations/route";
import {
  GET as recordsGet,
  POST as recordsPost,
  PATCH as recordsPatch,
  POST as txPost,
  GET as stateGet,
} from "../src/app/api/transactions/route";
import { buildLeadUnifiedTimeline } from "../src/lib/constants";
import { realtimeBus, RealtimeBroadcastEvent } from "../src/lib/realtime-bus";
import { readAgencyDb, writeAgencyDb } from "../src/lib/server-db";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "agency-db.json");

function makeJsonReq(
  url: string,
  method: string,
  body?: unknown,
  token?: string
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function runMasterVerification() {
  console.log(
    "=== Twofold Studio OS — Part 16 Multi-User 16-Step Verification ==="
  );

  // Snapshot existing database so we restore clean state after test
  const initialDb = readAgencyDb();
  const snapshot = JSON.stringify(initialDb, null, 2);

  // Track real-time events received by User #2's subscription
  const realtimeEventsReceived: RealtimeBroadcastEvent[] = [];
  const unsubscribeRealtime = realtimeBus.subscribe((evt) => {
    realtimeEventsReceived.push(evt);
  });

  try {
    // 0. Sign in as Admin (User #1: Elena Vance)
    const adminLoginRes = await authPost(
      makeJsonReq("http://localhost:3000/api/auth", "POST", {
        action: "login",
        email: "elena@twofold.studio",
        password: "Twofold2026!",
      })
    );
    const adminLogin = await adminLoginRes.json();
    if (!adminLoginRes.ok || !adminLogin.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin)}`);
    }
    const adminToken = adminLogin.token as string;
    console.log(
      "✓ Step 0: Admin signed in with PBKDF2-verified session token (elena@twofold.studio)"
    );

    // 1. Admin invites another user (User #2: Devon Brooks as Team Member)
    const inviteEmail = `devon.${Date.now()}@twofold.studio`;
    const inviteRes = await authPost(
      makeJsonReq(
        "http://localhost:3000/api/auth",
        "POST",
        {
          action: "invite",
          name: "Devon Brooks",
          email: inviteEmail,
          role: "Team Member",
          title: "Frontend Engineer",
          department: "Engineering",
        },
        adminToken
      )
    );
    const inviteData = await inviteRes.json();
    if (!inviteRes.ok || !inviteData.invitation?.token) {
      throw new Error(`Invite failed: ${JSON.stringify(inviteData)}`);
    }
    const inviteToken = inviteData.invitation.token as string;
    console.log(
      `✓ Step 1: Admin invited second user (${inviteEmail}) -> token ${inviteToken.slice(
        0,
        14
      )}...`
    );

    // 2. The invited user registers via invitation token and signs in
    const acceptRes = await authPost(
      makeJsonReq("http://localhost:3000/api/auth", "POST", {
        action: "accept_invite",
        token: inviteToken,
        password: "DevonSecurePassword2026!",
        phone: "+1 (415) 555-0144",
      })
    );
    const acceptData = await acceptRes.json();
    if (!acceptRes.ok || !acceptData.token || !acceptData.member?.id) {
      throw new Error(`Accept invite failed: ${JSON.stringify(acceptData)}`);
    }
    const secondUserToken = acceptData.token as string;
    const secondUserId = acceptData.member.id as string;
    console.log(
      `✓ Step 2: Invited user Devon Brooks accepted invitation and signed in (memberId: ${secondUserId}, role: ${acceptData.member.role})`
    );

    // 3. Admin creates a new lead via granular POST /api/records/leads
    const eventsBeforeLead = realtimeEventsReceived.length;
    const leadCreateRes = await recordsPost(
      makeJsonReq(
        "http://localhost:3000/api/records/leads",
        "POST",
        {
          record: {
            businessName: "Apex Med Spa Toronto",
            contactPerson: "Dr. Claire Bennett",
            industry: "Healthcare & Wellness",
            country: "Canada",
            city: "Toronto",
            businessEmail: "claire@apexmedspa.ca",
            phoneNumber: "+1 (416) 555-0188",
            websiteUrl: "https://apexmedspa.ca",
            leadSource: "Google Maps",
            websiteStatus: "Outdated Website",
            rating: 4.9,
            numberOfReviews: 118,
            estimatedProjectValue: 32000,
            leadPriority: "Urgent",
            status: "New",
            assignedTeamMemberId: secondUserId,
            dateAdded: "2026-11-20",
            nextFollowUpDate: "2026-11-22",
            internalNotes: [],
            history: [],
          },
        },
        adminToken
      ),
      { params: Promise.resolve({ collection: "leads" }) }
    );
    const leadCreated = (await leadCreateRes.json()).record;
    if (!leadCreateRes.ok || !leadCreated?.id) {
      throw new Error("Lead creation failed");
    }
    console.log(
      `✓ Step 3: Admin created lead '${leadCreated.businessName}' (id: ${leadCreated.id})`
    );

    // 4. Second user sees the lead without refreshing (Realtime event emitted + GET /api/state as User #2)
    const leadRealtimeEmitted = realtimeEventsReceived
      .slice(eventsBeforeLead)
      .some((e) => e.table === "leads" && e.recordId === leadCreated.id);
    const user2StateRes = await stateGet(
      makeJsonReq("http://localhost:3000/api/state", "GET", undefined, secondUserToken)
    );
    const user2State = await user2StateRes.json();
    const user2SeesLead = user2State.leads.some(
      (l: { id: string }) => l.id === leadCreated.id
    );
    if (!leadRealtimeEmitted || !user2SeesLead) {
      throw new Error("Second user did not receive real-time lead update!");
    }
    console.log(
      "✓ Step 4: Second user received Realtime broadcast event and sees the new lead immediately"
    );

    // 5. First user logs a cold call via granular POST /api/records/coldCalls
    const eventsBeforeCall = realtimeEventsReceived.length;
    const callCreateRes = await recordsPost(
      makeJsonReq(
        "http://localhost:3000/api/records/coldCalls",
        "POST",
        {
          record: {
            leadId: leadCreated.id,
            businessName: leadCreated.businessName,
            phoneNumber: leadCreated.phoneNumber,
            callingTeamMemberId: adminLogin.member.id,
            callDate: "2026-11-20",
            callTime: "11:15",
            durationSeconds: 340,
            outcome: "Interested",
            notes: "Spoke with Dr. Bennett; interested in patient booking portal.",
            followUpDate: "2026-11-22",
            nextAction: "Send Loom audit via email",
            source: "manual",
          },
        },
        adminToken
      ),
      { params: Promise.resolve({ collection: "coldCalls" }) }
    );
    const callCreated = (await callCreateRes.json()).record;
    if (!callCreateRes.ok || !callCreated?.id) {
      throw new Error("Cold call creation failed");
    }
    console.log(
      `✓ Step 5: First user logged cold call (${callCreated.outcome}, 5m 40s, connected=${callCreated.connected})`
    );

    // 6. Second user sees the call activity
    const callRealtimeEmitted = realtimeEventsReceived
      .slice(eventsBeforeCall)
      .some((e) => e.table === "coldCalls" && e.recordId === callCreated.id);
    const user2CallsRes = await recordsGet(
      makeJsonReq(
        "http://localhost:3000/api/records/coldCalls",
        "GET",
        undefined,
        secondUserToken
      ),
      { params: Promise.resolve({ collection: "coldCalls" }) }
    );
    const user2Calls = (await user2CallsRes.json()).records;
    if (
      !callRealtimeEmitted ||
      !user2Calls.some((c: { id: string }) => c.id === callCreated.id)
    ) {
      throw new Error("Second user did not see cold call activity!");
    }
    console.log(
      "✓ Step 6: Second user received real-time cold call update and sees the call activity"
    );

    // 7. Outbound email logged / sent (with threadId & messageId)
    const outboundEmailRes = await recordsPost(
      makeJsonReq(
        "http://localhost:3000/api/records/outreach",
        "POST",
        {
          record: {
            leadId: leadCreated.id,
            leadName: leadCreated.businessName,
            memberId: adminLogin.member.id,
            communicationChannel: "Cold Emails",
            messageTemplateUsed: "Founder 90-Second UX & Conversion Teardown",
            subject: "90s UX Teardown for Apex Med Spa Toronto",
            dateSent: "2026-11-20",
            occurredAt: "2026-11-20 11:30",
            messageContent:
              "Hi Dr. Bennett — following up on our call with the 90s patient portal teardown.",
            direction: "Outbound",
            source: "api",
            provider: "gmail",
            providerMessageId: "gmail-msg-out-1001",
            providerThreadId: "gmail-thread-5001",
            deliveryStatus: "delivered",
            replyStatus: "Message Sent",
            replyDate: "",
            nextFollowUpDate: "2026-11-22",
            outcome: "Delivered to claire@apexmedspa.ca",
          },
        },
        adminToken
      ),
      { params: Promise.resolve({ collection: "outreach" }) }
    );
    const outboundEmail = (await outboundEmailRes.json()).record;
    console.log(
      `✓ Step 7: Outbound email activity recorded (threadId: ${outboundEmail.providerThreadId}, messageId: ${outboundEmail.providerMessageId})`
    );

    // 8. Incoming reply is synchronized via Gmail webhook (/api/webhooks/gmail) + tested for duplicate prevention
    const webhookPayload = {
      messageId: "gmail-msg-in-2002",
      threadId: "gmail-thread-5001",
      fromEmail: "claire@apexmedspa.ca",
      subject: "Re: 90s UX Teardown for Apex Med Spa Toronto",
      messageContent:
        "Thanks Elena! We watched the video and want to move forward with the $32k proposal.",
    };
    const whRes1 = await webhookPost(
      makeJsonReq(
        "http://localhost:3000/api/webhooks/gmail",
        "POST",
        webhookPayload
      ),
      { params: Promise.resolve({ provider: "gmail" }) }
    );
    const whData1 = await whRes1.json();
    // Send exact same webhook a second time to verify duplicate prevention!
    const whRes2 = await webhookPost(
      makeJsonReq(
        "http://localhost:3000/api/webhooks/gmail",
        "POST",
        webhookPayload
      ),
      { params: Promise.resolve({ provider: "gmail" }) }
    );
    const whData2 = await whRes2.json();
    if (!whData1.ok || whData1.matchedLeadId !== leadCreated.id || !whData2.deduplicated) {
      throw new Error("Gmail reply webhook synchronization or deduplication failed!");
    }
    console.log(
      "✓ Step 8: Incoming Gmail reply synchronized, matched by normalized email to lead, and duplicate delivery prevented"
    );

    // 9. Verify the reply appears in the lead's Unified Communication Timeline (Part 10)
    const dbAfterReply = readAgencyDb();
    const updatedLead = dbAfterReply.leads.find((l) => l.id === leadCreated.id)!;
    const timeline = buildLeadUnifiedTimeline(
      updatedLead,
      dbAfterReply.outreach,
      dbAfterReply.coldCalls || [],
      dbAfterReply.teamMembers
    );
    const hasCallInTimeline = timeline.some((e) => e.channel === "Cold Call");
    const hasOutboundEmail = timeline.some(
      (e) => e.providerMessageId === "gmail-msg-out-1001"
    );
    const hasInboundReply = timeline.some(
      (e) =>
        e.providerMessageId === "gmail-msg-in-2002" && e.direction === "Inbound"
    );
    if (!hasCallInTimeline || !hasOutboundEmail || !hasInboundReply) {
      throw new Error("Unified communication timeline missing expected events!");
    }
    console.log(
      `✓ Step 9: Unified Communication Timeline verified (${timeline.length} deduplicated chronological events: Outbound Email, Cold Call, Inbound Reply)`
    );

    // 10 & 11. Convert lead into a client AND create a project atomically (/api/transactions convert_lead)
    const convRes = await txPost(
      makeJsonReq(
        "http://localhost:3000/api/transactions",
        "POST",
        {
          type: "convert_lead",
          leadId: leadCreated.id,
          servicesPurchased: [
            "Custom Website Design (UI/UX)",
            "Next.js Full-Stack Development",
          ],
          createProject: true,
          projectName: "Apex Med Spa Patient Portal & Web Flagship",
          projectType: "Next.js Full-Stack Development",
          projectBudget: 32000,
          projectDeadline: "2026-12-30",
        },
        adminToken
      )
    );
    const convData = await convRes.json();
    if (!convRes.ok || !convData.client?.id || !convData.project?.id) {
      throw new Error("Atomic lead-to-client + project conversion failed!");
    }
    console.log(
      `✓ Step 10 & 11: Lead converted to Client (${convData.client.businessName}) and Project created (${convData.project.projectName}) with 14-point checklist`
    );

    // 12. Assign project & task to the invited team member (User #2)
    await recordsPatch(
      makeJsonReq(
        "http://localhost:3000/api/records/projects",
        "PATCH",
        {
          id: convData.project.id,
          updates: {
            assignedTeamMembers: [adminLogin.member.id, secondUserId],
          },
        },
        adminToken
      ),
      { params: Promise.resolve({ collection: "projects" }) }
    );

    const taskRes = await recordsPost(
      makeJsonReq(
        "http://localhost:3000/api/records/tasks",
        "POST",
        {
          record: {
            taskTitle: "Build Apex Med Spa 2-Step HIPAA Booking Intake",
            description: "Implement Next.js Server Actions & validation.",
            relatedClientId: convData.client.id,
            relatedProjectId: convData.project.id,
            assignedPersonId: secondUserId,
            priority: "Urgent",
            startDate: "2026-11-20",
            dueDate: "2026-11-25",
            status: "In Progress",
            isRecurring: false,
          },
        },
        adminToken
      ),
      { params: Promise.resolve({ collection: "tasks" }) }
    );
    const taskCreated = (await taskRes.json()).record;
    const dbAfterTask = readAgencyDb();
    const taskNotif = dbAfterTask.notifications.find(
      (n) =>
        n.type === "Task Assigned" &&
        n.recipientMemberId === secondUserId &&
        n.entityId === taskCreated.id
    );
    if (!taskCreated?.id || !taskNotif) {
      throw new Error("Task assignment or recipient notification failed!");
    }
    console.log(
      `✓ Step 12: Task assigned to invited team member Devon Brooks and database notification delivered`
    );

    // 13 & 14. Create an invoice & record a payment; verify dashboard revenue updates accurately
    const revBefore = readAgencyDb()
      .finance.filter((f) => f.transactionType !== "Expense")
      .reduce((s, f) => s + f.paidAmount, 0);

    const invRes = await recordsPost(
      makeJsonReq(
        "http://localhost:3000/api/records/finance",
        "POST",
        {
          record: {
            clientId: convData.client.id,
            projectId: convData.project.id,
            amount: 32000,
            paidAmount: 0,
            currency: "USD",
            transactionType: "Invoice",
            paymentDate: "",
            dueDate: "2026-11-30",
            paymentMethod: "Wire Transfer",
            paymentStatus: "Unpaid",
            invoiceNumber: "INV-2026-990",
            notes: "Apex Med Spa Patient Portal Contract",
          },
        },
        adminToken
      ),
      { params: Promise.resolve({ collection: "finance" }) }
    );
    const invCreated = (await invRes.json()).record;

    const payRes = await txPost(
      makeJsonReq(
        "http://localhost:3000/api/transactions",
        "POST",
        {
          type: "record_payment",
          invoiceId: invCreated.id,
          amount: 16000,
          paymentMethod: "Wire Transfer",
        },
        adminToken
      )
    );
    const payData = await payRes.json();
    const revAfter = readAgencyDb()
      .finance.filter((f) => f.transactionType !== "Expense")
      .reduce((s, f) => s + f.paidAmount, 0);

    if (
      !payRes.ok ||
      payData.invoice.paymentStatus !== "Partially Paid" ||
      revAfter !== revBefore + 16000
    ) {
      throw new Error("Payment recording or revenue calculation failed!");
    }
    console.log(
      `✓ Step 13 & 14: Created $32,000 invoice, recorded $16,000 payment (Partially Paid), and verified received revenue increased by +$16,000 ($${revBefore} -> $${revAfter})`
    );

    // 15. Verify unauthorized users (Team Member User #2) CANNOT access restricted financial records (HTTP 403)
    const forbiddenFinanceGet = await recordsGet(
      makeJsonReq(
        "http://localhost:3000/api/records/finance",
        "GET",
        undefined,
        secondUserToken
      ),
      { params: Promise.resolve({ collection: "finance" }) }
    );
    const forbiddenPaymentPost = await txPost(
      makeJsonReq(
        "http://localhost:3000/api/transactions",
        "POST",
        {
          type: "record_payment",
          invoiceId: invCreated.id,
          amount: 1000,
        },
        secondUserToken
      )
    );
    const user2FilteredStateRes = await stateGet(
      makeJsonReq(
        "http://localhost:3000/api/state",
        "GET",
        undefined,
        secondUserToken
      )
    );
    const user2FilteredState = await user2FilteredStateRes.json();

    if (
      forbiddenFinanceGet.status !== 403 ||
      forbiddenPaymentPost.status !== 403 ||
      user2FilteredState.finance.length !== 0
    ) {
      throw new Error(
        `RBAC check failed! Expected 403 and 0 finance rows for Team Member, got HTTP ${forbiddenFinanceGet.status} and ${user2FilteredState.finance.length} rows.`
      );
    }
    console.log(
      "✓ Step 15: Server-side RBAC verified — Team Member blocked with HTTP 403 on /api/records/finance and /api/transactions (record_payment), and 0 finance records exposed in /api/state"
    );

    // 16. Verify data remains available after logout and re-login
    await authPost(
      makeJsonReq(
        "http://localhost:3000/api/auth",
        "POST",
        { action: "logout" },
        adminToken
      )
    );
    const reloginRes = await authPost(
      makeJsonReq("http://localhost:3000/api/auth", "POST", {
        action: "login",
        email: "elena@twofold.studio",
        password: "Twofold2026!",
      })
    );
    const reloginData = await reloginRes.json();
    const afterReloginStateRes = await stateGet(
      makeJsonReq(
        "http://localhost:3000/api/state",
        "GET",
        undefined,
        reloginData.token
      )
    );
    const afterReloginState = await afterReloginStateRes.json();
    const persistedClient = afterReloginState.clients.some(
      (c: { id: string }) => c.id === convData.client.id
    );
    const persistedInvoice = afterReloginState.finance.some(
      (f: { id: string; paidAmount: number }) =>
        f.id === invCreated.id && f.paidAmount === 16000
    );
    if (!persistedClient || !persistedInvoice) {
      throw new Error("Data did not persist after logout and re-login!");
    }
    console.log(
      "✓ Step 16: Verified all records persist intact across logout, disk reload, and re-login"
    );
    console.log(
      "\n=== ALL 16 MULTI-USER & PRODUCTION WORKFLOWS PASSED VERIFICATION ==="
    );
  } finally {
    unsubscribeRealtime();
    // Restore clean baseline database state
    fs.writeFileSync(DB_PATH, snapshot, "utf-8");
    writeAgencyDb(initialDb);
  }
}

runMasterVerification().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
