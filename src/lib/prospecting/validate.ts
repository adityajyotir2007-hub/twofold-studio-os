import { extractInstagramHandle } from "@/lib/auto-outreach";
import { isValidEmail, normalizeEmail } from "@/lib/validation";
import { ProspectInput } from "@/types/prospecting";
import { EMPTY_PROSPECT_INPUT } from "./fields";

export const PROSPECTING_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const PROSPECTING_MAX_COLUMNS = 60;
export const PROSPECTING_DEFAULT_MAX_ROWS = 2000;

const SHARED_DOMAIN_BLOCKLIST = new Set<string>([
  "instagram.com",
  "facebook.com",
  "fb.com",
  "linktr.ee",
  "linkedin.com",
  "google.com",
  "maps.google.com",
  "goo.gl",
  "wa.me",
  "api.whatsapp.com",
  "business.site",
  "sites.google.com",
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "protonmail.com",
]);

function capStr(value: unknown, maxLen = 500): string {
  if (value == null) return "";
  return String(value).trim().slice(0, maxLen);
}

export function normEmail(raw?: string | null): {
  value: string;
  valid: boolean;
} {
  const clean = normalizeEmail(raw);
  if (!clean) return { value: "", valid: true };
  if (!isValidEmail(clean)) return { value: "", valid: false };
  return { value: clean.slice(0, 500), valid: true };
}

export function normPhone(raw?: string | null): {
  value: string;
  digits: string;
  valid: boolean;
} {
  const trimmed = capStr(raw, 100);
  if (!trimmed) return { value: "", digits: "", valid: true };
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return { value: "", digits: "", valid: false };
  }
  return {
    value: hasPlus ? `+${digits}` : digits,
    digits,
    valid: true,
  };
}

export function normWebsite(raw?: string | null): {
  value: string;
  domain: string;
  valid: boolean;
} {
  const trimmed = capStr(raw, 500);
  if (!trimmed) return { value: "", domain: "", valid: true };
  if (trimmed.includes(" ") && !trimmed.includes("://")) {
    return { value: "", domain: "", valid: false };
  }
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (
      !parsed.hostname ||
      !parsed.hostname.includes(".") ||
      parsed.hostname.startsWith(".") ||
      parsed.hostname.endsWith(".")
    ) {
      return { value: "", domain: "", valid: false };
    }
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const cleanUrl =
      parsed.pathname === "/" && !parsed.search && !parsed.hash
        ? `${parsed.protocol}//${parsed.hostname.toLowerCase()}`
        : parsed.toString().slice(0, 500);
    return { value: cleanUrl, domain, valid: true };
  } catch {
    return { value: "", domain: "", valid: false };
  }
}

export function normInstagram(raw?: string | null): {
  value: string;
  valid: boolean;
} {
  const trimmed = capStr(raw, 500);
  if (!trimmed) return { value: "", valid: true };
  const handle = extractInstagramHandle(trimmed);
  if (!handle || !/^[a-zA-Z0-9._]{1,30}$/.test(handle)) {
    return { value: "", valid: false };
  }
  return { value: handle, valid: true };
}

export function normLinkedin(raw?: string | null): {
  value: string;
  valid: boolean;
} {
  const trimmed = capStr(raw, 500);
  if (!trimmed) return { value: "", valid: true };
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("linkedin.com")) {
      return { value: "", valid: false };
    }
    return { value: parsed.toString().slice(0, 500), valid: true };
  } catch {
    return { value: "", valid: false };
  }
}

export type RowValidationStatus = "ready" | "incomplete" | "invalid";

export interface ValidatedProspectRow {
  clean: ProspectInput;
  websiteDomain: string;
  warnings: string[];
  status: RowValidationStatus;
  reason?: string;
}

/**
 * Validates and normalizes one raw prospect row.
 * - Invalid email / phone / website / Instagram / LinkedIn are cleared and recorded as warnings.
 * - Row is "invalid" only if all identifying fields (businessName, contactPerson, email, website, instagram, linkedinUrl) are empty.
 * - Row is "incomplete" if valid (has an identifier) but has no contact channel (email, phone, instagram, linkedinUrl).
 */
export function validateProspectRow(
  input: Partial<ProspectInput>
): ValidatedProspectRow {
  const warnings: string[] = [];

  const businessName = capStr(input.businessName, 500);
  const contactPerson = capStr(input.contactPerson, 500);
  const category = capStr(input.category, 500);
  const location = capStr(input.location, 500);
  const country = capStr(input.country, 500);
  const notes = capStr(input.notes, 2000);
  const source = capStr(input.source, 500);

  const emailRes = normEmail(input.email);
  if (!emailRes.valid) {
    warnings.push(`Invalid email cleared: "${capStr(input.email, 80)}"`);
  }

  const phoneRes = normPhone(input.phone);
  if (!phoneRes.valid) {
    warnings.push(`Invalid phone cleared: "${capStr(input.phone, 80)}"`);
  }

  const websiteRes = normWebsite(input.website);
  if (!websiteRes.valid) {
    warnings.push(`Invalid website URL cleared: "${capStr(input.website, 80)}"`);
  }

  const igRes = normInstagram(input.instagram);
  if (!igRes.valid) {
    warnings.push(
      `Invalid Instagram handle/URL cleared: "${capStr(input.instagram, 80)}"`
    );
  }

  const liRes = normLinkedin(input.linkedinUrl);
  if (!liRes.valid) {
    warnings.push(
      `Invalid LinkedIn URL cleared: "${capStr(input.linkedinUrl, 80)}"`
    );
  }

  const clean: ProspectInput = {
    ...EMPTY_PROSPECT_INPUT,
    businessName,
    contactPerson,
    website: websiteRes.value,
    email: emailRes.value,
    phone: phoneRes.value,
    instagram: igRes.value,
    linkedinUrl: liRes.value,
    category,
    location,
    country,
    notes,
    source,
  };

  const hasIdentifier = Boolean(
    clean.businessName ||
      clean.contactPerson ||
      clean.email ||
      clean.website ||
      clean.instagram ||
      clean.linkedinUrl
  );

  if (!hasIdentifier) {
    return {
      clean,
      websiteDomain: "",
      warnings,
      status: "invalid",
      reason:
        "No identifying field present (needs at least business name, contact, email, website, Instagram, or LinkedIn).",
    };
  }

  const hasContactChannel = Boolean(
    clean.email || clean.phone || clean.instagram || clean.linkedinUrl
  );

  if (!hasContactChannel) {
    warnings.push("Incomplete: no email, phone, Instagram, or LinkedIn.");
    return {
      clean,
      websiteDomain: websiteRes.domain,
      warnings,
      status: "incomplete",
    };
  }

  return {
    clean,
    websiteDomain: websiteRes.domain,
    warnings,
    status: "ready",
  };
}

export function isBlockedSharedDomain(domain: string): boolean {
  const lower = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!lower) return true;
  if (SHARED_DOMAIN_BLOCKLIST.has(lower)) return true;
  return false;
}

export function prospectDedupeKeys(p: {
  businessName?: string | null;
  email?: string | null;
  website?: string | null;
  websiteDomain?: string | null;
  phone?: string | null;
  instagram?: string | null;
  country?: string | null;
}): string[] {
  const keys: string[] = [];

  const email = normalizeEmail(p.email);
  if (email && isValidEmail(email)) {
    keys.push(`email:${email}`);
  }

  const domain =
    (p.websiteDomain || "").trim().toLowerCase() ||
    normWebsite(p.website).domain;
  if (domain && !isBlockedSharedDomain(domain)) {
    keys.push(`domain:${domain}`);
  }

  const digits = (p.phone || "").replace(/[^0-9]/g, "");
  if (digits.length >= 7) {
    keys.push(`phone:${digits.slice(-10)}`);
  }

  const ig = extractInstagramHandle(p.instagram);
  if (ig) {
    keys.push(`ig:${ig.toLowerCase()}`);
  }

  const nameAlnum = (p.businessName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (nameAlnum.length >= 3) {
    const countryLower = (p.country || "").trim().toLowerCase();
    keys.push(`name:${nameAlnum}|${countryLower}`);
  }

  return keys;
}

export function findDuplicateIn<T>(
  keys: string[],
  index: Map<string, T>
): T | null {
  for (const key of keys) {
    const found = index.get(key);
    if (found !== undefined) return found;
  }
  return null;
}
