import { AgencyDatabaseState } from "@/types/agency";
import {
  DEFAULT_INTEGRATIONS,
  DEFAULT_PROJECT_CHECKLIST_LABELS,
} from "./constants";

function makeChecklist(completedCount: number, assigneeId = "tm-2") {
  return DEFAULT_PROJECT_CHECKLIST_LABELS.map((label, idx) => ({
    id: `chk-${idx + 1}`,
    label,
    completed: idx < completedCount,
    assignedToId: assigneeId,
    updatedAt: idx < completedCount ? "2026-11-15" : undefined,
  }));
}

export const SEED_DEMO_IDS = {
  teamMembers: new Set<string>([]),
  leads: new Set<string>([]),
  outreach: new Set<string>([]),
  clients: new Set<string>([]),
  projects: new Set<string>([]),
  tasks: new Set<string>([]),
  finance: new Set<string>([]),
  documents: new Set<string>([]),
  templates: new Set<string>([]),
};

export const INITIAL_AGENCY_DATA: AgencyDatabaseState = {
  teamMembers: [
    {
      id: "tm-1",
      name: "Elena Vance",
      email: "elena@twofold.studio",
      role: "Admin",
      title: "Founder & Executive Director",
      avatarInitials: "EV",
      phone: "+1 (415) 890-4421",
      department: "Leadership & Strategy",
      hourlyRate: 185,
      status: "Active",
      dailyTargets: { calls: 10, emails: 15, dms: 10, leadsAdded: 10 },
      isDemo: false,
      createdAt: "2025-01-10",
    },
    {
      id: "tm-2",
      name: "Marcus Sterling",
      email: "marcus@twofold.studio",
      role: "Manager",
      title: "Head of Delivery & Client Success",
      avatarInitials: "MS",
      phone: "+1 (415) 890-4422",
      department: "Operations & PM",
      hourlyRate: 145,
      status: "Active",
      dailyTargets: { calls: 12, emails: 20, dms: 10, leadsAdded: 8 },
      isDemo: false,
      createdAt: "2025-02-14",
    },
    {
      id: "tm-3",
      name: "Sora Takahashi",
      email: "sora@twofold.studio",
      role: "Team Member",
      title: "Principal Design Architect",
      avatarInitials: "ST",
      phone: "+1 (415) 890-4425",
      department: "Design Systems",
      hourlyRate: 135,
      status: "Active",
      dailyTargets: { calls: 0, emails: 5, dms: 5, leadsAdded: 0 },
      isDemo: false,
      createdAt: "2025-03-01",
    },
    {
      id: "tm-4",
      name: "Liam O'Connor",
      email: "liam@twofold.studio",
      role: "Team Member",
      title: "Lead Full-Stack Engineer",
      avatarInitials: "LO",
      phone: "+44 20 7946 0921",
      department: "Engineering",
      hourlyRate: 140,
      status: "Active",
      dailyTargets: { calls: 0, emails: 5, dms: 0, leadsAdded: 0 },
      isDemo: false,
      createdAt: "2025-04-12",
    },
    {
      id: "tm-5",
      name: "Aria Chen",
      email: "aria@twofold.studio",
      role: "Manager",
      title: "Growth & Outreach Lead",
      avatarInitials: "AC",
      phone: "+1 (415) 890-4429",
      department: "Growth & Sales",
      hourlyRate: 120,
      status: "Active",
      dailyTargets: { calls: 25, emails: 40, dms: 25, leadsAdded: 20 },
      isDemo: false,
      createdAt: "2025-06-01",
    },
  ],
  invitations: [],
  leads: [],
  outreach: [],
  coldCalls: [],
  campaigns: [],
  clients: [],
  projects: [],
  tasks: [],
  finance: [],
  payments: [],
  documents: [],
    templates: [
    {
      id: "tpl-1",
      title: "Founder 90-Second UX & Conversion Teardown",
      category: "Cold Email Templates",
      subjectOrHook: "Quick 90s UX teardown for {{Business_Name}}",
      content: `Hi {{Contact_Person}},

I came across {{Business_Name}} while researching leading {{Industry}} teams in {{City}} (congrats on the {{Rating}}★ rating across {{Reviews}} reviews).

While walking through your site ({{Website_URL}}), I noticed {{Personalization_Observation}} — which typically causes high-intent mobile visitors to drop off before booking.

I recorded a private 90-second video walking through 3 surgical fixes that lifted conversions by 34% for a similar client last quarter:
→ [Loom Video Link]

If it's helpful, happy to share the Figma prototype file directly. No pitch deck attached.

Best,
{{Sender_Name}}
Twofold Studio`,
      tags: ["Cold Email", "Loom Audit", "High Reply Rate"],
      usageCount: 48,
      updatedAt: "2026-11-12",
      isDemo: false,
    },
    {
      id: "tpl-2",
      title: "Editorial Brand & Mobile Speed Audit DM",
      category: "Instagram DM Templates",
      subjectOrHook: "Instagram Bio Link UX & Prototype Note",
      content: `Hey {{Contact_Person}}! Huge fan of {{Business_Name}}'s visual direction on here.

Clicked your bio link on mobile and noticed the reservation/product page takes ~6 seconds to load on 5G. Our design team at Twofold Studio mocked up a clean, instant-loading mobile concept tailored to your aesthetic — mind if I drop the private preview link here?`,
      tags: ["Instagram", "Visual Concept", "Hospitality & DTC"],
      usageCount: 31,
      updatedAt: "2026-11-10",
      isDemo: false,
    },
    {
      id: "tpl-3",
      title: "Google Maps Broken SSL / Outdated Site Alert",
      category: "WhatsApp Templates",
      subjectOrHook: "Quick heads up on {{Business_Name}}'s website link",
      content: `Hi {{Contact_Person}}, hope your week in {{City}} is going great! I found {{Business_Name}} on Google Maps ({{Rating}}★ rating!) and noticed your website link currently throws a layout/SSL issue on mobile.

Wanted to flag it for your team — we also put together a quick modern homepage preview for {{Business_Name}} if you'd like me to send the link over!`,
      tags: ["WhatsApp", "Local High-Ticket", "Google Maps"],
      usageCount: 22,
      updatedAt: "2026-11-08",
      isDemo: false,
    },
    {
      id: "tpl-4",
      title: "Value-First Follow-Up (Day 4 After Audit)",
      category: "Follow-up Templates",
      subjectOrHook: "Re: Quick 90s UX teardown for {{Business_Name}}",
      content: `Hi {{Contact_Person}},

Floating this back to the top of your inbox in case the interactive Figma prototype link got buried.

Even if you handle development in-house, feel free to share the 3 conversion notes with your engineering team. Let me know if a 15-minute architecture chat next Tuesday works!`,
      tags: ["Follow-up", "No-Pressure", "Step 2"],
      usageCount: 64,
      updatedAt: "2026-11-15",
      isDemo: false,
    },
    {
      id: "tpl-5",
      title: "Twofold Studio — Enterprise Web & Design System Proposal",
      category: "Website Proposals",
      subjectOrHook: "Executive Scope, Architecture & Investment Breakdown",
      content: `# Proposal: {{Project_Name}}
**Prepared for:** {{Client_Name}} ({{Business_Name}})
**Prepared by:** Twofold Studio

## 1. Executive Objective
Transform {{Business_Name}}'s digital presence into a high-converting, category-defining web platform engineered on Next.js, Tailwind CSS, and an atomic Figma Design System.

## 2. Scope of Work & Phases
- **Phase 1 (Weeks 1–2):** Brand Architecture, UX Wireframing & Interactive Prototypes
- **Phase 2 (Weeks 3–4):** High-Fidelity Design System & Responsive Breakpoints
- **Phase 3 (Weeks 5–7):** Next.js Full-Stack Engineering, CMS & Performance Optimization
- **Phase 4 (Week 8):** QA, Technical SEO, Core Web Vitals Verification & Zero-Downtime Launch

## 3. Investment & Milestones
- **Total Investment:** {{Project_Budget}}
- **50% Kickoff Deposit:** Due upon agreement execution
- **25% Design & Staging Approval:** Due upon interactive staging delivery
- **25% Final Launch Settlement:** Due prior to production DNS cutover`,
      tags: ["Proposal", "Next.js", "Enterprise"],
      usageCount: 19,
      updatedAt: "2026-11-14",
      isDemo: false,
    },
    {
      id: "tpl-6",
      title: "Master Digital Agency Services Agreement (MSA)",
      category: "Service Agreements",
      subjectOrHook: "Standard Twofold Studio MSA & IP Assignment Clauses",
      content: `# MASTER SERVICES AGREEMENT — TWOFOLD STUDIO

This Master Services Agreement ("Agreement") is entered into as of {{Date}} between **Twofold Studio LLC** ("Agency") and **{{Business_Name}}** ("Client").

1. **Deliverables & Milestones:** Agency shall design, develop, and test the custom digital platform as detailed in Statement of Work #1.
2. **Intellectual Property Transfer:** Upon full payment of all fees, Client receives 100% ownership and exclusive title to all custom source code, Figma design systems, and brand assets.
3. **Payment Terms:** Net 7 days from invoice issuance. Late balances accrue 1.5% monthly administrative fee.
4. **Confidentiality:** Both parties agree to strict mutual NDA protections regarding proprietary business metrics and architecture.`,
      tags: ["Legal", "MSA", "Contract"],
      usageCount: 15,
      updatedAt: "2026-10-30",
      isDemo: false,
    },
    {
      id: "tpl-7",
      title: "New Client Kickoff & Technical Onboarding Questionnaire",
      category: "Client Onboarding Questions",
      subjectOrHook: "12 Essential Questions Before Kickoff Call",
      content: `1. What is the #1 measurable business action you want visitors to take within 30 seconds of landing on your new site?
2. Who are your top 3 direct competitors, and how do you outperform them?
3. List 3 websites (inside or outside your industry) whose visual restraint, typography, or interactions you admire.
4. Do you have vector brand guidelines (SVG logos, font licenses, color tokens)?
5. Which CRM, analytics, or booking tools must integrate with the new platform (e.g., HubSpot, Attio, Cal.com, Stripe)?
6. Who is the single final decision-maker for design and copy sign-off?`,
      tags: ["Onboarding", "Discovery", "Client Intake"],
      usageCount: 27,
      updatedAt: "2026-11-01",
      isDemo: false,
    },
    {
      id: "tpl-8",
      title: "14-Point End-to-End Agency Delivery Checklist",
      category: "Project Checklists",
      subjectOrHook: "Standard Twofold Studio Project Quality Gate",
      content: `- [ ] 1. Proposal prepared & scope ratified
- [ ] 2. Master Services Agreement signed & deposit cleared
- [ ] 3. Client Onboarding intake & Slack channel provisioned
- [ ] 4. Core copywriting & value proposition architecture received
- [ ] 5. High-resolution photography & vector assets verified
- [ ] 6. High-fidelity Figma UI/UX & Design System signed off
- [ ] 7. Next.js frontend & backend development completed
- [ ] 8. Mobile, tablet & 4K responsive breakpoints tested
- [ ] 9. Technical SEO, OpenGraph, sitemap.xml & schema markup verified
- [ ] 10. Internal QA & Client staging walkthrough completed
- [ ] 11. Client revision round consolidated & resolved
- [ ] 12. Final executive approval received in writing
- [ ] 13. Production SSL, DNS cutover & website launched
- [ ] 14. Team CMS training & documentation handover completed`,
      tags: ["Delivery", "SOP", "QA"],
      usageCount: 34,
      updatedAt: "2026-11-05",
      isDemo: false,
    },
    {
      id: "tpl-9",
      title: "Production Go-Live & Zero-Downtime Launch Checklist",
      category: "Website Launch Checklists",
      subjectOrHook:
        "Pre-Flight Technical & SEO Verification Before DNS Switch",
      content: `### Pre-Launch Technical Verification
- [ ] Lighthouse Performance >= 95, Accessibility = 100, SEO = 100
- [ ] Custom 404, 500, and loading skeleton states verified
- [ ] Favicon, Apple Touch Icon, and dynamic OG social cards tested
- [ ] All forms & webhook notifications tested in production mode
- [ ] 301 redirects mapped for all legacy URLs to preserve SEO equity
- [ ] SSL certificate auto-renewal & HSTS headers active`,
      tags: ["Launch", "DevOps", "SEO"],
      usageCount: 29,
      updatedAt: "2026-11-11",
      isDemo: false,
    },
  ],
  notifications: [],
  activityLog: [],
    integrations: DEFAULT_INTEGRATIONS,
  importHistory: [],
  settings: {
    agencyName: "Twofold Studio",
    tagline: "Digital Product, Brand & Web Engineering Studio",
    logoText: "TF",
    contactEmail: "hello@twofold.studio",
    contactPhone: "+1 (415) 890-4421",
    address: "548 Market St, Suite 42100, San Francisco, CA 94104",
    website: "https://twofold.studio",
    defaultCurrency: "USD",
    dateFormat: "MMM DD, YYYY",
    themePreference: "light",
    includeDemoDataInAnalytics: true,
    notificationPreferences: {
      newLeads: true,
      followUpsDue: true,
      newClients: true,
      projectDeadlines: true,
      overdueTasks: true,
      pendingPayments: true,
      projectStatusChanges: true,
    },
    rolePermissions: {
      Admin: {
        finance: true,
        settings: true,
        team: true,
        deleteRecords: true,
      },
      Manager: {
        finance: true,
        settings: false,
        team: true,
        deleteRecords: true,
      },
      "Team Member": {
        finance: false,
        settings: false,
        team: false,
        deleteRecords: false,
      },
    },
  },
};
