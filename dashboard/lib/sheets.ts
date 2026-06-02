// Server-only: load BrokerRecord[] from the Google Sheet, or fall back to mock if env is missing.
import "server-only";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import type { BrokerRecord, Mailbox, TradingDataSource } from "@/types";

const MONTHS_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function envOk(): boolean {
  return (
    !!process.env.GOOGLE_CREDENTIALS &&
    !!process.env.GOOGLE_SHEET_ID &&
    !!process.env.SHEET_NAME &&
    !!process.env.BROKER_ACCOUNTS_JSON
  );
}

function letterToColumn(letter: string): number {
  let col = 0;
  const up = letter.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    col = col * 26 + (up.charCodeAt(i) - 64);
  }
  return col;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseSheetDate(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return raw.getUTCFullYear() + "-" + pad2(raw.getUTCMonth() + 1) + "-" + pad2(raw.getUTCDate());
  }
  const s = String(raw).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD first
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];

  // Numeric (Sheets serial) — rare, but be defensive.
  if (/^\d+(\.\d+)?$/.test(s)) {
    // Excel/Sheets epoch is 1899-12-30 (UTC). Skip; not worth supporting unless seen.
  }

  // "DD MMM YYYY" / "DD Month YYYY" / "DD MMM YY"
  const m = s.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]+)[\s\-\/,]+(\d{2,4})$/);
  if (m) {
    const day = +m[1];
    const monKey = m[2].toLowerCase();
    const mon = MONTHS_MAP[monKey];
    if (mon == null) return null;
    let year = +m[3];
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return year + "-" + pad2(mon + 1) + "-" + pad2(day);
  }

  // Try Date.parse as a last resort (handles "May 1, 2026", ISO with time, etc.).
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }
  return null;
}

function toNum(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).replace(/[₹,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function flattenMailboxes(config: Mailbox[]) {
  const flat: Array<{ broker: string; accountId: string; sheetStartColumn: string }> = [];
  for (const mb of config) {
    for (const acc of mb.accounts || []) {
      if (!acc.broker || !acc.accountId || !acc.sheetStartColumn) continue;
      flat.push({
        broker: acc.broker,
        accountId: acc.accountId,
        sheetStartColumn: acc.sheetStartColumn,
      });
    }
  }
  return flat;
}

export async function getTradingBrokerRecords(): Promise<{
  records: BrokerRecord[];
  source: TradingDataSource;
}> {
  if (!envOk()) {
    const { MOCK_TRADING_BROKER_RECORDS } = await import("./mocks/trading");
    return { records: MOCK_TRADING_BROKER_RECORDS, source: "mock" };
  }

  try {
    const config = JSON.parse(process.env.BROKER_ACCOUNTS_JSON as string) as Mailbox[];
    if (!Array.isArray(config)) throw new Error("BROKER_ACCOUNTS_JSON must be an array");
    const accounts = flattenMailboxes(config);
    if (!accounts.length) throw new Error("BROKER_ACCOUNTS_JSON has no accounts");

    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS as string, "base64").toString("utf8")
    );
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = process.env.SHEET_NAME as string;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:ZZ`,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const rows = res.data.values || [];

    const records: BrokerRecord[] = [];

    for (const row of rows) {
      const isoDate = parseSheetDate(row?.[2]); // col C
      if (!isoDate) continue;

      for (const acc of accounts) {
        try {
          const startCol = letterToColumn(acc.sheetStartColumn) - 1; // zero-indexed
          const cells = row.slice(startCol, startCol + 5);
          const payin = toNum(cells[0]);
          const brokerage = toNum(cells[1]);
          const other = toNum(cells[2]);
          const total = toNum(cells[3]);
          const finalNet = toNum(cells[4]);
          // Skip account-rows with no usable data.
          if (
            payin == null &&
            brokerage == null &&
            other == null &&
            total == null &&
            finalNet == null
          ) {
            continue;
          }
          const payinV = payin ?? 0;
          const brokV = brokerage ?? 0;
          const otherV = other ?? 0;
          const totalV = total ?? brokV + otherV;
          const finalV = finalNet ?? payinV - totalV;
          records.push({
            date: isoDate,
            broker: acc.broker,
            accountId: acc.accountId,
            payin_payout_obligation: payinV,
            net_brokerage: brokV,
            other_charges: otherV,
            total_charges: totalV,
            final_net: finalV,
          });
        } catch (err) {
          // skip this account-row but keep going
          console.warn(
            "sheets: failed to parse account row",
            acc.accountId,
            (err as Error).message
          );
        }
      }
    }

    return { records, source: "sheet" };
  } catch (err) {
    console.warn("sheets: falling back to mock —", (err as Error).message);
    const { MOCK_TRADING_BROKER_RECORDS } = await import("./mocks/trading");
    return { records: MOCK_TRADING_BROKER_RECORDS, source: "mock" };
  }
}
