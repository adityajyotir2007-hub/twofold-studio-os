import { z } from "zod";
import { Lead } from "@/types/agency";

export function normalizeEmail(email?: string | null): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export function normalizeBusinessName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|ltd|corp|co|gmbh|studio|agency|group)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/[^0-9]/g, "");
}

export function normalizeWebsiteDomain(url?: string | null): string {
  if (!url) return "";
  const clean = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[/?#:].*$/, "");
  return clean;
}

export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return true; // optional field
  try {
    const withProto = /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;
    const parsed = new URL(withProto);
    return Boolean(parsed.hostname && parsed.hostname.includes("."));
  } catch {
    return false;
  }
}

export interface DuplicateMatch {
  existingLeadId: string;
  existingBusinessName: string;
  existingEmail: string;
  matchedOn: ("businessName" | "email" | "websiteDomain" | "phoneNumber")[];
}

/**
 * Checks a candidate lead against existing CRM leads using normalized:
 * 1. Business Name
 * 2. Email Address
 * 3. Website Domain
 * 4. Phone Number
 */
export function detectLeadDuplicate(
  candidate: {
    businessName?: string;
    businessEmail?: string;
    websiteUrl?: string;
    phoneNumber?: string;
  },
  existingLeads: Lead[]
): DuplicateMatch | null {
  const cName = normalizeBusinessName(candidate.businessName);
  const cEmail = normalizeEmail(candidate.businessEmail);
  const cDomain = normalizeWebsiteDomain(candidate.websiteUrl);
  const cPhone = normalizePhone(candidate.phoneNumber);

  for (const lead of existingLeads) {
    const matchedOn: DuplicateMatch["matchedOn"] = [];
    const lName = normalizeBusinessName(lead.businessName);
    const lEmail = normalizeEmail(lead.businessEmail);
    const lDomain = normalizeWebsiteDomain(lead.websiteUrl);
    const lPhone = normalizePhone(lead.phoneNumber);

    if (cName && lName && cName === lName) matchedOn.push("businessName");
    if (cEmail && lEmail && cEmail === lEmail) matchedOn.push("email");
    if (cDomain && lDomain && cDomain === lDomain)
      matchedOn.push("websiteDomain");
    if (cPhone && cPhone.length >= 7 && lPhone && cPhone === lPhone)
      matchedOn.push("phoneNumber");

    if (matchedOn.length > 0) {
      return {
        existingLeadId: lead.id,
        existingBusinessName: lead.businessName,
        existingEmail: lead.businessEmail,
        matchedOn,
      };
    }
  }
  return null;
}

export const LeadInputSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  contactPerson: z.string().default(""),
  industry: z.string().default("SaaS & Technology"),
  country: z.string().default("United States"),
  city: z.string().default(""),
  businessEmail: z
    .string()
    .default("")
    .refine((v) => !v || isValidEmail(v), "Invalid email format"),
  phoneNumber: z.string().default(""),
  websiteUrl: z
    .string()
    .default("")
    .refine((v) => !v || isValidUrl(v), "Invalid website URL"),
  instagramUrl: z.string().default(""),
  facebookUrl: z.string().default(""),
  linkedinUrl: z.string().default(""),
  googleMapsUrl: z.string().default(""),
  leadSource: z
    .enum([
      "Google Maps",
      "Yelp",
      "Instagram",
      "Facebook",
      "LinkedIn",
      "Referrals",
      "Website",
      "Other",
    ])
    .default("Other"),
  businessDescription: z.string().default(""),
  websiteStatus: z
    .enum([
      "No Website",
      "Outdated Website",
      "Slow / Poor UX",
      "Needs Redesign",
      "Modern Website",
    ])
    .default("Outdated Website"),
  rating: z.number().min(0).max(5).default(4.5),
  numberOfReviews: z.number().int().min(0).default(0),
  personalizationNotes: z.string().default(""),
  potentialOpportunity: z.string().default(""),
  estimatedProjectValue: z.number().min(0).default(0),
  leadPriority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  status: z
    .enum([
      "New",
      "Qualified",
      "Contacted",
      "Replied",
      "Interested",
      "Meeting Scheduled",
      "Proposal Sent",
      "Converted",
      "Not Interested",
      "Lost",
    ])
    .default("New"),
  assignedTeamMemberId: z.string().default(""),
  dateAdded: z.string().default(() => new Date().toISOString().slice(0, 10)),
  lastContacted: z.string().default(""),
  nextFollowUpDate: z.string().default(""),
  whatsappOptIn: z.boolean().optional(),
  isDemo: z.boolean().optional(),
});

export const ColdCallInputSchema = z.object({
  leadId: z.string().min(1, "Lead is required"),
  businessName: z.string().min(1, "Business name is required"),
  phoneNumber: z.string().min(3, "Phone number is required"),
  callingTeamMemberId: z.string().min(1),
  callDate: z.string().min(1),
  callTime: z.string().min(1),
  durationSeconds: z.number().int().min(0).nullable().default(null),
  outcome: z.enum([
    "No Answer",
    "Busy",
    "Call Back Later",
    "Interested",
    "Not Interested",
    "Meeting Booked",
    "Wrong Number",
    "Converted",
  ]),
  notes: z.string().default(""),
  followUpDate: z.string().default(""),
  nextAction: z.string().default(""),
  campaignId: z.string().optional(),
  recordingConsent: z.boolean().default(false),
  recordingUrl: z.string().optional(),
  source: z.enum(["manual", "api"]).default("manual"),
  provider: z.enum(["twilio", "aircall"]).optional(),
  providerCallId: z.string().optional(),
});

export const CampaignInputSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  targetIndustry: z.string().default(""),
  targetCountry: z.string().default(""),
  targetCity: z.string().default(""),
  assignedTeamMembers: z.array(z.string()).default([]),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  leadIds: z.array(z.string()).default([]),
  communicationChannels: z.array(z.string()).default([]),
  status: z.enum(["Draft", "Active", "Paused", "Completed"]).default("Active"),
});
