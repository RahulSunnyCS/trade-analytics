const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const dotenv = require("dotenv");
const fs = require("fs");
const { requireEnv } = require("./utils/validate");
const { withRetry } = require("./utils/retry");
const logger = require("./utils/logger");

dotenv.config();

const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseDateCell(str) {
  // Handles both "26 May 26" (space-separated, written by updateSheet.js) and "01-May-25" (dash-separated)
  const [dd, mon, yy] = str.split(/[\s-]+/);
  const month = MONTHS[mon];
  if (month === undefined) throw new Error(`Unknown month abbreviation: "${mon}"`);
  return new Date(Date.UTC(2000 + parseInt(yy, 10), month, parseInt(dd, 10)));
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function findMissingDates(lastDateStr, today) {
  const lastDate = parseDateCell(lastDateStr);
  const current = new Date(lastDate);
  current.setUTCDate(current.getUTCDate() + 1);

  const missing = [];
  while (current < today) {
    missing.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return missing;
}

async function processMissingDates() {
  requireEnv(["GOOGLE_CREDENTIALS", "GOOGLE_SHEET_ID", "SHEET_NAME"]);
  logger.info("Check dates started");

  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf8")
  );
  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.SHEET_NAME;

  let lastRow = 0;
  try {
    const trackerRaw = fs.readFileSync("row_tracker.json", "utf-8");
    lastRow = JSON.parse(trackerRaw).lastUpdatedRow || 0;
    logger.info("Last row from tracker", { lastRow });
  } catch {
    logger.warn("No row_tracker.json — falling back to sheet for last row");
    const resp = await withRetry(
      () => sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:A` }),
      { attempts: 3, baseDelayMs: 1000 }
    );
    const rows = resp.data.values;
    lastRow = rows ? rows.length : 0;
    logger.info("Last row from sheet", { lastRow });
  }

  if (!lastRow) {
    logger.warn("Could not determine last row — writing empty gap_dates.txt");
    fs.writeFileSync("gap_dates.txt", "", "utf-8");
    return;
  }

  const cell = await withRetry(
    () =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!C${lastRow}`,
      }),
    { attempts: 3, baseDelayMs: 1000 }
  );

  const lastDateStr = cell.data.values?.[0]?.[0];
  logger.info("Last date in sheet", { date: lastDateStr });

  if (!lastDateStr) {
    logger.warn("No date found in sheet — writing empty gap_dates.txt");
    fs.writeFileSync("gap_dates.txt", "", "utf-8");
    return;
  }

  const today = todayUTC();
  const missingDates = findMissingDates(lastDateStr, today);

  if (!missingDates.length) {
    logger.info("No missing dates");
  } else {
    logger.info("Missing dates found", { count: missingDates.length });
    missingDates.forEach((d) => logger.info("  gap", { date: d.toISOString().slice(0, 10) }));
  }

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const isoDates = [
    ...missingDates.map((d) => d.toISOString().slice(0, 10)),
    tomorrow.toISOString().slice(0, 10),
  ];
  fs.writeFileSync("gap_dates.txt", isoDates.join("\n"), "utf-8");
  logger.info("gap_dates.txt written", { entries: isoDates.length });
}

if (require.main === module) {
  processMissingDates().catch((err) => {
    logger.error("checkDates failed", err);
    process.exit(1);
  });
}

module.exports = { findMissingDates, parseDateCell, todayUTC };
