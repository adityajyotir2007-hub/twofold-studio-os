import {
  PROSPECTING_DEFAULT_MAX_ROWS,
  PROSPECTING_MAX_COLUMNS,
  PROSPECTING_MAX_FILE_BYTES,
} from "./validate";

export interface ParsedSpreadsheet {
  headers: string[];
  rows: string[][];
  fileType: "csv" | "xlsx" | "xls";
}

function detectDelimiter(text: string): "," | ";" | "\t" {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  let tabs = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      break;
    }
    if (!inQuotes) {
      if (ch === ",") commas++;
      else if (ch === ";") semis++;
      else if (ch === "\t") tabs++;
    }
  }

  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis > commas) return ";";
  return ",";
}

/**
 * RFC-4180 compliant CSV parser:
 * - Strips UTF-8 BOM
 * - Auto-detects delimiter among `,`, `;`, and `\t` on first line outside quotes
 * - Preserves embedded commas, `""` escapes, CRLF/LF, and newlines inside quotes
 * - Drops completely blank rows
 */
export function parseCsvText(rawText: string): {
  headers: string[];
  rows: string[][];
} {
  const text = rawText.replace(/^\uFEFF/, "");
  if (!text.trim()) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (cell.length === 0) {
        inQuotes = true;
      } else {
        cell += '"';
      }
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") {
        i++;
      }
      row.push(cell.trim());
      if (row.some((c) => c !== "")) {
        records.push(row);
      }
      row = [];
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c !== "")) {
        records.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c !== "")) {
    records.push(row);
  }

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = records[0];
  const maxWidth = Math.max(
    rawHeaders.length,
    ...records.slice(1).map((r) => r.length)
  );
  const headers: string[] = [];
  for (let c = 0; c < maxWidth; c++) {
    const label = (rawHeaders[c] || "").trim();
    headers.push(label || `Column ${c + 1}`);
  }

  const dataRows = records.slice(1).map((r) => {
    const padded = new Array<string>(headers.length);
    for (let c = 0; c < headers.length; c++) {
      padded[c] = (r[c] || "").trim();
    }
    return padded;
  });

  return { headers, rows: dataRows };
}

/**
 * Parses an uploaded CSV, XLSX, or XLS file client-side for column mapping and preview.
 */
export async function parseSpreadsheetFile(
  file: File,
  maxRows = PROSPECTING_DEFAULT_MAX_ROWS
): Promise<ParsedSpreadsheet> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
    throw new Error(
      `Unsupported file format ".${ext || "unknown"}". Please upload a .csv, .xlsx, or .xls file.`
    );
  }

  if (file.size === 0) {
    throw new Error("The selected file is empty.");
  }

  if (file.size > PROSPECTING_MAX_FILE_BYTES) {
    throw new Error(
      `This file is ${(file.size / (1024 * 1024)).toFixed(
        1
      )} MB; the limit is ${Math.round(
        PROSPECTING_MAX_FILE_BYTES / (1024 * 1024)
      )} MB per file.`
    );
  }

  let headers: string[] = [];
  let rows: string[][] = [];

  if (ext === "csv") {
    const text = await file.text();
    const parsed = parseCsvText(text);
    headers = parsed.headers;
    rows = parsed.rows;
  } else {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("The Excel workbook does not contain any sheets.");
    }
    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const nonEmpty = matrix
      .map((r) => (Array.isArray(r) ? r.map((v) => String(v ?? "").trim()) : []))
      .filter((r) => r.some((c) => c !== ""));

    if (nonEmpty.length === 0) {
      throw new Error("The first sheet in this workbook is empty.");
    }

    const rawHeaders = nonEmpty[0];
    const maxWidth = Math.max(
      rawHeaders.length,
      ...nonEmpty.slice(1).map((r) => r.length)
    );
    headers = Array.from({ length: maxWidth }, (_, c) => {
      const lbl = (rawHeaders[c] || "").trim();
      return lbl || `Column ${c + 1}`;
    });
    rows = nonEmpty.slice(1).map((r) =>
      headers.map((_, c) => (r[c] || "").trim())
    );
  }

  if (headers.length === 0 || rows.length === 0) {
    throw new Error("No data rows found under the header row.");
  }

  if (headers.length > PROSPECTING_MAX_COLUMNS) {
    throw new Error(
      `This file has ${headers.length} columns; the limit is ${PROSPECTING_MAX_COLUMNS} columns.`
    );
  }

  if (rows.length > maxRows) {
    throw new Error(
      `This file has ${rows.length.toLocaleString()} rows; the limit is ${maxRows.toLocaleString()} per import. Split the file.`
    );
  }

  return {
    headers,
    rows,
    fileType: ext,
  };
}
