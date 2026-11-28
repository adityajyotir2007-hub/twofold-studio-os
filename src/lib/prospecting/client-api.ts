import {
  DuplicateCheckResultItem,
  Prospect,
  ProspectImport,
  ProspectInput,
  ProspectingCapabilities,
  ProspectStatus,
  SendToCrmItemResult,
} from "@/types/prospecting";

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchProspectingState(): Promise<{
  prospects: Prospect[];
  imports: ProspectImport[];
  capabilities: ProspectingCapabilities;
}> {
  const res = await fetch("/api/prospecting", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });
  return parseJsonOrThrow(res);
}

export async function checkProspectDuplicates(
  rows: Partial<ProspectInput>[]
): Promise<DuplicateCheckResultItem[]> {
  const res = await fetch("/api/prospecting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "check_duplicates", rows }),
  });
  const data = await parseJsonOrThrow<{ duplicates: DuplicateCheckResultItem[] }>(
    res
  );
  return data.duplicates;
}

export async function importProspectsBatch(payload: {
  idempotencyKey: string;
  fileName: string;
  fileType: "csv" | "xlsx" | "xls";
  fileSize: number;
  duplicateStrategy: "skip" | "update";
  columnMapping: Record<string, string>;
  rows: { rowNumber: number; included: boolean; data: Partial<ProspectInput> }[];
}): Promise<{
  importRecord: ProspectImport;
  prospects: Prospect[];
  imports: ProspectImport[];
}> {
  const res = await fetch("/api/prospecting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "import", ...payload }),
  });
  return parseJsonOrThrow(res);
}

export async function updateProspectRecord(
  id: string,
  patch: Partial<
    Pick<
      Prospect,
      | "businessName"
      | "contactPerson"
      | "website"
      | "email"
      | "phone"
      | "instagram"
      | "linkedinUrl"
      | "category"
      | "location"
      | "country"
      | "notes"
      | "source"
      | "status"
      | "campaignId"
    >
  >
): Promise<{ prospect: Prospect }> {
  const res = await fetch("/api/prospecting", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id, patch }),
  });
  return parseJsonOrThrow(res);
}

export async function bulkUpdateProspectsStatus(
  ids: string[],
  status: ProspectStatus
): Promise<{ prospects: Prospect[] }> {
  const res = await fetch("/api/prospecting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "bulk_update_status", ids, status }),
  });
  return parseJsonOrThrow(res);
}

export async function deleteProspectRecords(
  ids: string[]
): Promise<{ deletedCount: number; prospects: Prospect[] }> {
  const res = await fetch("/api/prospecting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "bulk_delete", ids }),
  });
  return parseJsonOrThrow(res);
}

export async function sendProspectsToCrmApi(ids: string[]): Promise<{
  results: SendToCrmItemResult[];
  prospects: Prospect[];
}> {
  const res = await fetch("/api/prospecting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "send_to_crm", ids }),
  });
  return parseJsonOrThrow(res);
}
