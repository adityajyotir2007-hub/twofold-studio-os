import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { autoMapColumns } from "../src/lib/prospecting/fields";
import { parseCsvText } from "../src/lib/prospecting/parse";
import {
  DEFAULT_CRM_WORKSPACE,
  runImport,
  sendProspectsToCrm,
} from "../src/lib/prospecting/server-store";
import {
  approveAndExecuteCampaign,
  processConversationalTurn,
} from "../src/lib/prospecting/assistant-engine";
import {
  prospectDedupeKeys,
  validateProspectRow,
} from "../src/lib/prospecting/validate";

async function runTests() {
  // 1. CSV parsing: BOM, quoted commas, "" escapes, embedded newlines, CRLF
  const csvWithQuotes =
    "\uFEFFBusiness Name,Email,Notes\r\n" +
    '"Acme, ""Studio"" LLC",founder@acme.com,"Line one\r\nLine two, still notes"\r\n' +
    "Simple Co,hello@simple.co,Plain note\r\n";

  const parsedCsv = parseCsvText(csvWithQuotes);
  assert.deepEqual(parsedCsv.headers, ["Business Name", "Email", "Notes"]);
  assert.equal(parsedCsv.rows.length, 2);
  assert.equal(parsedCsv.rows[0][0], 'Acme, "Studio" LLC');
  assert.equal(parsedCsv.rows[0][1], "founder@acme.com");
  assert.equal(parsedCsv.rows[0][2], "Line one\r\nLine two, still notes");
  assert.equal(parsedCsv.rows[1][0], "Simple Co");
  console.log("PASS: CSV RFC-4180 quotes, BOM, CRLF, and embedded newlines");

  // 2. Semicolon-delimited CSV auto-detection
  const semiCsv =
    "Company;E-mail;Website\nNorthwind Labs;hi@northwind.io;northwind.io\n";
  const parsedSemi = parseCsvText(semiCsv);
  assert.deepEqual(parsedSemi.headers, ["Company", "E-mail", "Website"]);
  assert.equal(parsedSemi.rows.length, 1);
  assert.equal(parsedSemi.rows[0][2], "northwind.io");
  console.log("PASS: CSV semicolon delimiter detection");

  // 3. Auto column mapping
  const headers = [
    "Company",
    "E-mail",
    "Mobile",
    "IG",
    "Website URL",
    "City",
    "Notes",
  ];
  const map = autoMapColumns(headers);
  assert.equal(map.businessName, 0);
  assert.equal(map.email, 1);
  assert.equal(map.phone, 2);
  assert.equal(map.instagram, 3);
  assert.equal(map.website, 4);
  assert.equal(map.location, 5);
  assert.equal(map.notes, 6);
  console.log("PASS: autoMapColumns header recognition");

  // 4. Validator: clears invalid email with warning, normalizes IG handle & website domain
  const v1 = validateProspectRow({
    businessName: "Studio Test",
    email: "not-an-email",
    instagram: "https://www.instagram.com/foo/",
    website: "example.com/about",
  });
  assert.equal(v1.clean.email, "");
  assert.equal(v1.clean.instagram, "foo");
  assert.equal(v1.clean.website, "https://example.com/about");
  assert.equal(v1.websiteDomain, "example.com");
  assert.equal(v1.status, "ready");
  assert.ok(
    v1.warnings.some((w) => w.toLowerCase().includes("invalid email cleared"))
  );
  console.log("PASS: validateProspectRow email clearing & social normalization");

  // 5. Validator: notes-only row is invalid
  const vInvalid = validateProspectRow({
    notes: "Just a comment with no identifier",
  });
  assert.equal(vInvalid.status, "invalid");
  console.log("PASS: validateProspectRow notes-only row marked invalid");

  // 6. Validator: name-only without contact channel is incomplete
  const vIncomplete = validateProspectRow({
    businessName: "Brick & Mortar Co",
  });
  assert.equal(vIncomplete.status, "incomplete");
  console.log("PASS: validateProspectRow identifier without channel marked incomplete");

  // 7. Dedupe keys: email case-insensitive, www vs non-www website match, shared blocklist domain skipped
  const keysA = prospectDedupeKeys({
    email: "Founder@Acme.COM ",
    website: "https://www.x.com/team",
  });
  const keysB = prospectDedupeKeys({
    email: "founder@acme.com",
    website: "x.com/about",
  });
  assert.ok(keysA.includes("email:founder@acme.com"));
  assert.ok(keysB.includes("email:founder@acme.com"));
  assert.ok(keysA.includes("domain:x.com"));
  assert.ok(keysB.includes("domain:x.com"));

  const keysShared = prospectDedupeKeys({
    website: "https://instagram.com/somebrand",
  });
  assert.ok(!keysShared.some((k) => k.startsWith("domain:")));
  console.log("PASS: prospectDedupeKeys normalization & shared-domain exclusion");

  // 8. Server store: runImport, idempotency, and sendProspectsToCrm (with DB backup/restore)
  const dbPath = path.join(process.cwd(), "data", "agency-db.json");
  const originalDb = fs.existsSync(dbPath)
    ? fs.readFileSync(dbPath, "utf-8")
    : null;

  try {
    const actor = { id: "tm-1", name: "Rajdhar Diwedi" };
    const idem = `test-idem-${Date.now()}`;
    const imp1 = runImport(DEFAULT_CRM_WORKSPACE, actor, {
      idempotencyKey: idem,
      fileName: "unit-smoke.csv",
      fileType: "csv",
      fileSize: 256,
      duplicateStrategy: "skip",
      columnMapping: { businessName: "Company", email: "Email" },
      rows: [
        {
          rowNumber: 1,
          included: true,
          data: {
            businessName: "Unit Test Prospect Studio",
            email: "founder@unittestprospect.example",
          },
        },
        {
          rowNumber: 2,
          included: true,
          data: {
            businessName: "Duplicate Email Studio",
            email: "FOUNDER@unittestprospect.example",
          },
        },
        {
          rowNumber: 3,
          included: true,
          data: {
            notes: "Notes only — no identifier",
          },
        },
      ],
    });

    assert.equal(imp1.importRecord.importedCount, 1);
    assert.equal(imp1.importRecord.skippedCount, 1);
    assert.equal(imp1.importRecord.failedCount, 1);

    const imp2 = runImport(DEFAULT_CRM_WORKSPACE, actor, {
      idempotencyKey: idem,
      fileName: "unit-smoke.csv",
      fileType: "csv",
      fileSize: 256,
      duplicateStrategy: "skip",
      columnMapping: { businessName: "Company", email: "Email" },
      rows: [],
    });
    assert.equal(imp2.importRecord.id, imp1.importRecord.id);

    const importedProspectId = imp1.prospects[0].id;
    const crm1 = await sendProspectsToCrm(DEFAULT_CRM_WORKSPACE, actor, [
      importedProspectId,
    ]);
    assert.equal(crm1.results[0].outcome, "created");
    assert.ok(crm1.results[0].crmLeadId);

    const crm2 = await sendProspectsToCrm(DEFAULT_CRM_WORKSPACE, actor, [
      importedProspectId,
    ]);
    assert.equal(crm2.results[0].outcome, "already_linked");
    console.log(
      "PASS: server-store runImport, idempotency, and sendProspectsToCrm (created -> already_linked)"
    );

    // 9. Conversational turn + Campaign Approval workflow
    const chatRes = await processConversationalTurn(
      DEFAULT_CRM_WORKSPACE,
      actor,
      {
        prompt:
          "Start outreach for my cafe leads in Toronto. I want to offer them website development.",
        selectedChannels: ["email"],
        files: [
          {
            fileName: "toronto-cafes.csv",
            fileType: "csv",
            fileSize: 320,
            duplicateStrategy: "skip",
            columnMapping: {
              businessName: "Business",
              email: "Email",
              category: "Category",
              location: "City",
            },
            rows: [
              {
                rowNumber: 1,
                included: true,
                data: {
                  businessName: "Roast & Bloom Cafe",
                  contactPerson: "Maya",
                  email: "maya@roastbloom.example",
                  category: "Cafe",
                  location: "Toronto",
                },
              },
            ],
          },
        ],
      }
    );

    assert.equal(chatRes.conversation.messages.length, 2);
    const assistantTurn = chatRes.conversation.messages[1];
    assert.ok(assistantTurn.campaignApproval);
    assert.equal(assistantTurn.campaignApproval?.status, "pending_approval");
    assert.ok((assistantTurn.progressMetrics?.emailsPrepared || 0) >= 1);

    const approveRes = await approveAndExecuteCampaign(
      DEFAULT_CRM_WORKSPACE,
      actor,
      {
        conversationId: chatRes.conversation.id,
        messageId: assistantTurn.id,
      }
    );
    const approvedMsg = approveRes.conversation.messages.find(
      (m) => m.id === assistantTurn.id
    );
    assert.equal(
      approvedMsg?.campaignApproval?.status,
      "approved_executed"
    );
    assert.ok(
      (approvedMsg?.campaignApproval?.executionSummary?.syncedToCrmCount ||
        0) >= 1
    );
    console.log(
      "PASS: conversational AI turn, draft generation, and campaign approval -> CRM sync"
    );
  } finally {
    if (originalDb !== null) {
      fs.writeFileSync(dbPath, originalDb, "utf-8");
    }
  }

  console.log("ALL PROSPECTING TESTS PASSED");
}

runTests();
