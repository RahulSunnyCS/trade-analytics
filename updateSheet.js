const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const dotenv = require("dotenv");
const fs = require("fs");
const { loadBrokerAccounts, flattenAccounts } = require("./brokers");
const { requireEnv } = require("./utils/validate");
const { withRetry } = require("./utils/retry");
const logger = require("./utils/logger");

dotenv.config();

function columnToLetter(column) {
  let letter = "";
  while (column > 0) {
    const temp = (column - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    column = Math.floor((column - temp - 1) / 26);
  }
  return letter;
}

function letterToColumn(letter) {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col;
}

const ACCOUNT_COLUMN_COUNT = 4;

function buildAccountValues(match) {
  const payin = match?.payin_payout_obligation ?? 0;
  const brokerage = match?.net_brokerage ?? 0;
  const other = match?.other_charges ?? 0;
  const totalCharges = brokerage + other;
  return [payin, brokerage, other, totalCharges];
}

const sheetsRetryOpts = {
  attempts: 3,
  baseDelayMs: 1000,
  retryIf: (err) => {
    const code = err?.code || err?.status;
    return code >= 500 || code === 429;
  },
  onRetry: (err, attempt, delay) =>
    logger.warn("Sheets API retry", { attempt, delayMs: delay, error: err.message }),
};

async function updateGoogleSheet() {
  requireEnv(["GOOGLE_CREDENTIALS", "GOOGLE_SHEET_ID", "SHEET_GID", "SHEET_NAME"]);

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
  const sheetId = process.env.SHEET_GID;
  const sheetName = process.env.SHEET_NAME;

  let lastRow = 0;
  try {
    const trackerRaw = fs.readFileSync("row_tracker.json", "utf-8");
    const trackerData = JSON.parse(trackerRaw);
    lastRow = trackerData.lastUpdatedRow || 0;
    logger.info("Row from tracker", { lastRow });
  } catch {
    logger.warn("No row_tracker.json found — falling back to sheet");
  }

  if (lastRow === 0) {
    const readResponse = await withRetry(
      () => sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:A` }),
      sheetsRetryOpts
    );
    const rows = readResponse.data.values;
    lastRow = rows ? rows.length : 0;
    logger.info("Row from sheet", { lastRow });
  }

  const targetDate = process.env.TARGET_DATE
    ? new Date(process.env.TARGET_DATE)
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
      })();

  const dayName = targetDate.toLocaleDateString("en-GB", { weekday: "long" });
  const dateFormatted = targetDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

  const lastRowData =
    lastRow > 0
      ? (
          await withRetry(
            () =>
              sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A${lastRow}:ZZ${lastRow}`,
              }),
            sheetsRetryOpts
          )
        ).data.values?.[0] || []
      : [];

  const lastRowValue = lastRowData[0] || 0;
  const lastDateCell = lastRowData[2];

  if (lastDateCell === dateFormatted) {
    logger.info("Date already exists in sheet, skipping", { date: dateFormatted });
    return;
  }

  const summaryPath = "daily_summary.json";
  if (!fs.existsSync(summaryPath)) {
    logger.warn("No daily_summary.json found, skipping update");
    return;
  }
  const data = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
  if (!data.individual_account || data.individual_account.length === 0) {
    logger.warn("No account data in daily_summary.json, skipping update");
    return;
  }

  const flatAccounts = flattenAccounts(loadBrokerAccounts());

  const newRow = lastRow ? parseInt(lastRow, 10) + 1 : 2;
  const newRowValue = lastRowValue ? parseInt(lastRowValue, 10) + 1 : 1;

  await withRetry(
    () =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: newRow - 1,
                  endIndex: newRow,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      }),
    sheetsRetryOpts
  );

  if (lastRow > 0 && lastRowData.length > 0) {
    await withRetry(
      () =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                copyPaste: {
                  source: {
                    sheetId,
                    startRowIndex: lastRow - 1,
                    endRowIndex: lastRow,
                    startColumnIndex: 0,
                    endColumnIndex: lastRowData.length,
                  },
                  destination: {
                    sheetId,
                    startRowIndex: newRow - 1,
                    endRowIndex: newRow,
                    startColumnIndex: 0,
                    endColumnIndex: lastRowData.length,
                  },
                  pasteType: "PASTE_FORMULA",
                },
              },
            ],
          },
        }),
      sheetsRetryOpts
    );
  }

  const valueUpdates = [
    {
      range: `${sheetName}!A${newRow}:C${newRow}`,
      values: [[newRowValue, dayName, dateFormatted]],
    },
  ];

  for (const acc of flatAccounts) {
    const match = data.individual_account.find((a) => a.account === acc.accountId);
    const startColNum = letterToColumn(acc.sheetStartColumn);
    const endColLetter = columnToLetter(startColNum + ACCOUNT_COLUMN_COUNT - 1);
    valueUpdates.push({
      range: `${sheetName}!${acc.sheetStartColumn}${newRow}:${endColLetter}${newRow}`,
      values: [buildAccountValues(match)],
    });
  }

  await withRetry(
    () =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: { valueInputOption: "RAW", data: valueUpdates },
      }),
    sheetsRetryOpts
  );

  logger.info("Sheet updated successfully", { row: newRow, date: dateFormatted });

  fs.writeFileSync(
    "row_tracker.json",
    JSON.stringify({ lastUpdatedRow: newRow }, null, 2),
    "utf-8"
  );
}

if (require.main === module) {
  updateGoogleSheet().catch((err) => {
    logger.error("updateGoogleSheet failed", err);
    process.exit(1);
  });
}

module.exports = { columnToLetter, letterToColumn, buildAccountValues, updateGoogleSheet };
