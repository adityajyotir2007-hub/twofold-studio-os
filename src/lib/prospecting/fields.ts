import { ProspectInput } from "@/types/prospecting";

export interface ProspectFieldDefinition {
  key: keyof ProspectInput;
  label: string;
  aliases: string[];
  placeholder?: string;
}

export const PROSPECT_IMPORT_FIELDS: ProspectFieldDefinition[] = [
  {
    key: "businessName",
    label: "Business name",
    aliases: [
      "business name",
      "business",
      "company",
      "company name",
      "organisation",
      "organization",
      "org",
      "brand",
      "brand name",
      "account",
      "account name",
      "name",
    ],
  },
  {
    key: "contactPerson",
    label: "Contact person",
    aliases: [
      "contact person",
      "contact name",
      "contact",
      "owner",
      "founder",
      "ceo",
      "first name",
      "full name",
      "person",
      "lead name",
      "decision maker",
    ],
  },
  {
    key: "website",
    label: "Website",
    aliases: [
      "website",
      "website url",
      "url",
      "site",
      "web",
      "domain",
      "homepage",
      "web address",
    ],
  },
  {
    key: "email",
    label: "Email",
    aliases: [
      "email",
      "e-mail",
      "mail",
      "email address",
      "business email",
      "work email",
      "contact email",
    ],
  },
  {
    key: "phone",
    label: "Phone number",
    aliases: [
      "phone",
      "phone number",
      "telephone",
      "tel",
      "mobile",
      "mobile number",
      "whatsapp",
      "whatsapp number",
      "cell",
      "contact number",
    ],
  },
  {
    key: "instagram",
    label: "Instagram URL or username",
    aliases: [
      "instagram",
      "instagram url",
      "instagram handle",
      "instagram username",
      "ig",
      "insta",
      "ig handle",
      "ig url",
    ],
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    aliases: [
      "linkedin",
      "linkedin url",
      "linkedin profile",
      "company linkedin",
      "li url",
    ],
  },
  {
    key: "category",
    label: "Business category",
    aliases: [
      "category",
      "business category",
      "industry",
      "niche",
      "business type",
      "sector",
      "vertical",
      "type",
    ],
  },
  {
    key: "location",
    label: "Location",
    aliases: [
      "location",
      "city",
      "address",
      "area",
      "state",
      "region",
      "town",
      "city state",
    ],
  },
  {
    key: "country",
    label: "Country",
    aliases: ["country", "nation", "country code"],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: [
      "notes",
      "note",
      "comments",
      "comment",
      "description",
      "remarks",
      "observations",
      "details",
    ],
  },
  {
    key: "source",
    label: "Source",
    aliases: ["source", "lead source", "origin", "list source", "channel"],
  },
];

export const EMPTY_PROSPECT_INPUT: ProspectInput = {
  businessName: "",
  contactPerson: "",
  website: "",
  email: "",
  phone: "",
  instagram: "",
  linkedinUrl: "",
  category: "",
  location: "",
  country: "",
  notes: "",
  source: "",
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Automatically maps spreadsheet column headers to supported prospect fields.
 * Exact normalized alias matches take precedence over substring matches, and each
 * column index is assigned to at most one prospect field.
 * "name" alone maps to businessName only if no stronger business/company header exists.
 */
export function autoMapColumns(
  headers: string[]
): Record<keyof ProspectInput, number> {
  const mapping: Record<keyof ProspectInput, number> = {
    businessName: -1,
    contactPerson: -1,
    website: -1,
    email: -1,
    phone: -1,
    instagram: -1,
    linkedinUrl: -1,
    category: -1,
    location: -1,
    country: -1,
    notes: -1,
    source: -1,
  };

  const normalizedHeaders = headers.map((h) => normalizeHeader(h || ""));
  const usedCols = new Set<number>();

  // Pass 1: exact alias matches (excluding ambiguous standalone "name" on first sweep)
  for (const field of PROSPECT_IMPORT_FIELDS) {
    const exactAliases = field.aliases
      .map(normalizeHeader)
      .filter((a) => a && a !== "name");
    const colIdx = normalizedHeaders.findIndex(
      (h, idx) => !usedCols.has(idx) && h && exactAliases.includes(h)
    );
    if (colIdx >= 0) {
      mapping[field.key] = colIdx;
      usedCols.add(colIdx);
    }
  }

  // Pass 2: if businessName still unmapped, allow exact "name" alias
  if (mapping.businessName === -1) {
    const nameCol = normalizedHeaders.findIndex(
      (h, idx) => !usedCols.has(idx) && h === "name"
    );
    if (nameCol >= 0) {
      mapping.businessName = nameCol;
      usedCols.add(nameCol);
    }
  }

  // Pass 3: substring (`includes`) matches for remaining unmapped fields
  for (const field of PROSPECT_IMPORT_FIELDS) {
    if (mapping[field.key] !== -1) continue;
    const aliases = field.aliases
      .map(normalizeHeader)
      .filter((a) => a.length >= 2 && a !== "name");
    const colIdx = normalizedHeaders.findIndex(
      (h, idx) =>
        !usedCols.has(idx) &&
        h &&
        aliases.some((alias) => h.includes(alias) || alias.includes(h))
    );
    if (colIdx >= 0) {
      mapping[field.key] = colIdx;
      usedCols.add(colIdx);
    }
  }

  return mapping;
}
