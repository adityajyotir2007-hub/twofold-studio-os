import { AgencyTemplate, Lead } from "@/types/agency";
import { isValidEmail, normalizeEmail, normalizePhone } from "./validation";

export type SocialOutreachChannel = "instagram" | "email" | "whatsapp";

export interface PersonalizedLeadMessages {
  instagramHandle: string;
  instagramMessage: string;
  emailAddress: string;
  emailSubject: string;
  emailBody: string;
  whatsappPhone: string;
  whatsappMessage: string;
}

export interface AutoOutreachChannelResult {
  channel: SocialOutreachChannel;
  label: string;
  target: string;
  sentViaApi: boolean;
  mode: "api" | "deep_link";
  messagePreview: string;
  subject?: string;
  launchUrl?: string;
  secondaryUrl?: string;
  outreachId: string;
  apiNote?: string;
}

export interface AutoOutreachDispatchResponse {
  ok: boolean;
  leadId: string;
  businessName: string;
  results: AutoOutreachChannelResult[];
}

/**
 * Extracts a clean Instagram username/handle from "@handle", "handle",
 * or full Instagram profile URLs like "https://www.instagram.com/handle/".
 */
export function extractInstagramHandle(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Handle full URLs
  if (/instagram\.com/i.test(trimmed)) {
    try {
      const withProto = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(withProto);
      const segments = parsed.pathname
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      const first = segments[0] || "";
      if (
        !first ||
        ["p", "reel", "reels", "stories", "explore", "direct"].includes(
          first.toLowerCase()
        )
      ) {
        return "";
      }
      return first.replace(/^@+/, "").replace(/[^a-zA-Z0-9._]/g, "");
    } catch {
      // fall through
    }
  }

  return trimmed
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .split(/[/?#]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, "");
}

export function formatInstagramProfileUrl(raw?: string | null): string {
  const handle = extractInstagramHandle(raw);
  if (!handle) return raw?.trim() || "";
  return `https://instagram.com/${handle}`;
}

export function cleanWhatsAppPhone(raw?: string | null): string {
  return normalizePhone(raw);
}

function interpolateTemplateTokens(
  rawText: string,
  lead: Partial<Lead>,
  senderName: string,
  agencyName: string
): string {
  const firstName =
    (lead.contactPerson || "").trim().split(/\s+/)[0] || "there";
  const businessName = lead.businessName?.trim() || "your team";
  const industry = lead.industry?.trim() || "your industry";
  const city = lead.city?.trim() || lead.country?.trim() || "your area";
  const rating = lead.rating != null ? String(lead.rating) : "4.9";
  const reviews =
    lead.numberOfReviews != null ? String(lead.numberOfReviews) : "40+";
  const website = lead.websiteUrl?.trim() || `${businessName}'s online presence`;

  const observation =
    lead.personalizationNotes?.trim() ||
    lead.potentialOpportunity?.trim() ||
    (lead.websiteStatus === "No Website"
      ? "you don't currently have a dedicated conversion website linked for high-intent visitors"
      : lead.websiteStatus === "Slow / Poor UX"
      ? "a few mobile speed and booking flow bottlenecks that cause visitors to drop off"
      : "a quick opportunity to upgrade your mobile conversion flow and visual positioning");

  return rawText
    .replace(/\{\{Business_Name\}\}/g, businessName)
    .replace(/\{\{Contact_Person\}\}/g, firstName)
    .replace(/\{\{Client_Name\}\}/g, lead.contactPerson?.trim() || firstName)
    .replace(/\{\{Industry\}\}/g, industry)
    .replace(/\{\{City\}\}/g, city)
    .replace(/\{\{Rating\}\}/g, rating)
    .replace(/\{\{Reviews\}\}/g, reviews)
    .replace(/\{\{Website_URL\}\}/g, website)
    .replace(/\{\{Personalization_Observation\}\}/g, observation)
    .replace(/\{\{Sender_Name\}\}/g, senderName || agencyName);
}

/**
 * Generates personalized outreach copy across Instagram DM, Email, and WhatsApp
 * using workspace templates (when present) + lead-specific context.
 */
export function buildPersonalizedOutreachMessages(
  lead: Partial<Lead>,
  templates: AgencyTemplate[] = [],
  senderName = "Twofold Studio",
  agencyName = "Twofold Studio"
): PersonalizedLeadMessages {
  const instagramHandle = extractInstagramHandle(
    lead.instagramUrl || lead.instagramHandle
  );
  const emailAddress = normalizeEmail(lead.businessEmail);
  const whatsappPhone = cleanWhatsAppPhone(lead.phoneNumber);

  const igTpl = templates.find((t) => t.category === "Instagram DM Templates");
  const emailTpl = templates.find((t) => t.category === "Cold Email Templates");
  const waTpl = templates.find((t) => t.category === "WhatsApp Templates");

  const defaultIg = `Hey {{Contact_Person}}! Huge fan of {{Business_Name}}'s work in {{City}}. I noticed {{Personalization_Observation}} — we put together a clean, high-converting mobile concept tailored for {{Business_Name}} at ${agencyName}. Mind if I drop the private preview link here?`;

  const defaultEmailSubject = `Quick idea for {{Business_Name}}`;
  const defaultEmailBody = `Hi {{Contact_Person}},\n\nI came across {{Business_Name}} while researching leading {{Industry}} brands in {{City}}.\n\nWhile checking your digital presence ({{Website_URL}}), I noticed {{Personalization_Observation}}.\n\nOur team at ${agencyName} mocked up a tailored concept showing 3 surgical UX & conversion upgrades for {{Business_Name}}. Happy to send over the private preview link — no pitch deck attached.\n\nBest,\n{{Sender_Name}}\n${agencyName}`;

  const defaultWa = `Hi {{Contact_Person}}! Hope your week in {{City}} is going well. Came across {{Business_Name}} and noticed {{Personalization_Observation}}. Put together a quick modern homepage preview tailored to your brand at ${agencyName} — would you like me to share the link here?`;

  const instagramMessage = interpolateTemplateTokens(
    igTpl?.content || defaultIg,
    lead,
    senderName,
    agencyName
  );

  const emailSubject = interpolateTemplateTokens(
    emailTpl?.subjectOrHook || defaultEmailSubject,
    lead,
    senderName,
    agencyName
  );

  const emailBody = interpolateTemplateTokens(
    emailTpl?.content || defaultEmailBody,
    lead,
    senderName,
    agencyName
  );

  const whatsappMessage = interpolateTemplateTokens(
    waTpl?.content || defaultWa,
    lead,
    senderName,
    agencyName
  );

  return {
    instagramHandle,
    instagramMessage,
    emailAddress,
    emailSubject,
    emailBody,
    whatsappPhone,
    whatsappMessage,
  };
}

export function buildDirectChannelLinks(msgs: PersonalizedLeadMessages) {
  const instagramDmUrl = msgs.instagramHandle
    ? `https://ig.me/m/${encodeURIComponent(msgs.instagramHandle)}`
    : "";
  const instagramProfileUrl = msgs.instagramHandle
    ? `https://instagram.com/${encodeURIComponent(msgs.instagramHandle)}`
    : "";
  const whatsappUrl =
    msgs.whatsappPhone.length >= 7
      ? `https://wa.me/${msgs.whatsappPhone}?text=${encodeURIComponent(
          msgs.whatsappMessage
        )}`
      : "";
  const gmailComposeUrl = isValidEmail(msgs.emailAddress)
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        msgs.emailAddress
      )}&su=${encodeURIComponent(msgs.emailSubject)}&body=${encodeURIComponent(
        msgs.emailBody
      )}`
    : "";
  const mailtoUrl = isValidEmail(msgs.emailAddress)
    ? `mailto:${encodeURIComponent(
        msgs.emailAddress
      )}?subject=${encodeURIComponent(
        msgs.emailSubject
      )}&body=${encodeURIComponent(msgs.emailBody)}`
    : "";

  return {
    instagramDmUrl,
    instagramProfileUrl,
    whatsappUrl,
    gmailComposeUrl,
    mailtoUrl,
  };
}

/**
 * Determines which social/contact channels were newly added on a lead
 * (all present channels for a new lead, or newly populated/changed channels on edit).
 */
export function detectNewlyAddedSocialChannels(
  prevLead: Lead | null | undefined,
  nextLead: Partial<Lead>
): SocialOutreachChannel[] {
  const channels: SocialOutreachChannel[] = [];

  const nextIg = extractInstagramHandle(
    nextLead.instagramUrl || nextLead.instagramHandle
  );
  const prevIg = prevLead
    ? extractInstagramHandle(prevLead.instagramUrl || prevLead.instagramHandle)
    : "";
  if (nextIg && nextIg !== prevIg) {
    channels.push("instagram");
  }

  const nextEmail = normalizeEmail(nextLead.businessEmail);
  const prevEmail = prevLead ? normalizeEmail(prevLead.businessEmail) : "";
  if (nextEmail && isValidEmail(nextEmail) && nextEmail !== prevEmail) {
    channels.push("email");
  }

  const nextPhone = cleanWhatsAppPhone(nextLead.phoneNumber);
  const prevPhone = prevLead ? cleanWhatsAppPhone(prevLead.phoneNumber) : "";
  if (nextPhone.length >= 7 && nextPhone !== prevPhone) {
    channels.push("whatsapp");
  }

  return channels;
}
