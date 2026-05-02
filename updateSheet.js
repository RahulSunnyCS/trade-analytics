const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const dotenv = require("dotenv");
const fs = require("fs");
const { loadBrokerAccounts, flattenAccounts } = require("./brokers");

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

const ACCOUNT_COLUMN_COUNT = 5;

function buildAccountValues(match) {
  const payin = match?.payin_payout_obligation ?? 0;
  const brokerage = match?.net_brokerage ?? 0;
  const other = match?.other_charges ?? 0;
  const totalCharges = brokerage + other;
  const finalNet = match?.final_net ?? 0;
  return [payin, brokerage, other, totalCharges, finalNet];
}

async function updateGoogleSheet() {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf8")
  );

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetId = process.env.SHEET_GID;
    const sheetName = process.env.SHEET_NAME;

    let lastRow = 0;
    try {
      const trackerRaw = fs.readFileSync("row_tracker.json", "utf-8");
      const trackerData = JSON.parse(trackerRaw);
      lastRow = trackerData.lastUpdatedRow || 0;
      console.log("Using last row from row_tracker.json:", lastRow);
    } catch (err) {
      console.warn(
        "No existing row_tracker.json found. Attempting to get last row from Google Sheet."
      );
    }

    if (lastRow === 0) {
      const readResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`,
      });
      const rows = readResponse.data.values;
      lastRow = rows ? rows.length : 0;
      console.log("Using last row from Google Sheet:", lastRow);
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
            await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: `${sheetName}!A${lastRow}:ZZ${lastRow}`,
            })
          ).data.values?.[0] || []
        : [];

    const lastRowValue = lastRowData[0] || 0;
    const lastDateCell = lastRowData[2];

    if (lastDateCell === dateFormatted) {
      console.log(`Date ${dateFormatted} already exists. Skipping update.`);
      return;
    }

    const summaryPath = "daily_summary.json";
    if (!fs.existsSync(summaryPath)) {
      console.log("No daily summary found. Skipping update.");
      return;
    }
    const rawData = fs.readFileSync(summaryPath, "utf-8");
    const data = JSON.parse(rawData);
    if (!data.individual_account || data.individual_account.length === 0) {
      console.log("No account data found. Skipping update.");
      return;
    }

    const flatAccounts = flattenAccounts(loadBrokerAccounts());

    const newRow = lastRow ? parseInt(lastRow) + 1 : 1;
    const newRowValue = lastRowValue ? parseInt(lastRowValue) + 1 : 1;

    await sheets.spreadsheets.batchUpdate({
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
    });

    if (lastRow > 0 && lastRowData.length > 0) {
      await sheets.spreadsheets.batchUpdate({
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
      });
    }

    const valueUpdates = [
      {
        range: `${sheetName}!A${newRow}:C${newRow}`,
        values: [[newRowValue, dayName, dateFormatted]],
      },
    ];

    for (const acc of flatAccounts) {
      const match = data.individual_account.find(
        (a) => a.account === acc.accountId
      );
      const startColNum = letterToColumn(acc.sheetStartColumn);
      const endColLetter = columnToLetter(
        startColNum + ACCOUNT_COLUMN_COUNT - 1
      );
      valueUpdates.push({
        range: `${sheetName}!${acc.sheetStartColumn}${newRow}:${endColLetter}${newRow}`,
        values: [buildAccountValues(match)],
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: { valueInputOption: "RAW", data: valueUpdates },
    });

    console.log("✅ Sheet updated successfully!");

    fs.writeFileSync(
      "row_tracker.json",
      JSON.stringify({ lastUpdatedRow: newRow }, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("❌ Error updating Google Sheets:", error);
  }
}

updateGoogleSheet();
