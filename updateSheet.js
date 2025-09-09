const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const dotenv = require("dotenv");
const fs = require("fs");

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

async function updateGoogleSheet() {
  // Decode credentials
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

    // --- Step 1: Get the last row from row_tracker.json (if it exists)
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

    // --- Step 2: If no row found in row_tracker.json, get the last row from the sheet
    if (lastRow === 0) {
      const readResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`, // Read data from column A to check the last filled row
      });

      const rows = readResponse.data.values;
      lastRow = rows ? rows.length : 0; // Calculate the last row based on column A
      console.log("Using last row from Google Sheet:", lastRow);
    }

    // --- Step 3: Determine target date and check for duplicates
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
          ).data.values[0]
        : [];

    const lastRowValue = lastRowData[0] || 0;
    const lastDateCell = lastRowData[2];

    if (lastDateCell === dateFormatted) {
      console.log(`Date ${dateFormatted} already exists. Skipping update.`);
      return;
    }
    // --- Step 4: Read daily_summary.json and prepare account values
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

    const accountIds = process.env.ACCOUNT_IDS
      ? process.env.ACCOUNT_IDS.split(",")
      : [];

    const newRow = lastRow ? parseInt(lastRow) + 1 : 1;
    const newRowValue = lastRowValue ? parseInt(lastRowValue) + 1 : 1;
    const rowValues = [newRowValue, dayName, dateFormatted];

    accountIds.forEach((id) => {
      const acct = data.individual_account.find(
        (a) => a.account === id || a.account.includes(id)
      );
      rowValues.push(acct?.payin_payout_obligation || 0);
      rowValues.push(acct?.net_brokerage || 0);
    });

    const dataColumnCount = rowValues.length;

    // Insert a new row before writing values
    const insertRequest = {
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
    };

    await sheets.spreadsheets.batchUpdate(insertRequest);

    // Insert values covering only the data columns
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${newRow}:${columnToLetter(dataColumnCount)}${newRow}`,
      valueInputOption: "RAW",
      resource: { values: [rowValues] },
    });

    // --- Step 6: Copy formulas from the previous row (if any)
    const formulaColsCount = Math.max(lastRowData.length - dataColumnCount, 0);

    if (formulaColsCount > 0) {
      const copyRequest = {
        spreadsheetId,
        resource: {
          requests: [
            {
              copyPaste: {
                source: {
                  sheetId,
                  startRowIndex: lastRow - 1,
                  endRowIndex: lastRow,
                  startColumnIndex: dataColumnCount,
                  endColumnIndex: dataColumnCount + formulaColsCount,
                },
                destination: {
                  sheetId,
                  startRowIndex: newRow - 1,
                  endRowIndex: newRow,
                  startColumnIndex: dataColumnCount,
                  endColumnIndex: dataColumnCount + formulaColsCount,
                },
                pasteType: "PASTE_FORMULA",
              },
            },
          ],
        },
      };

      await sheets.spreadsheets.batchUpdate(copyRequest);
    }

    console.log("✅ Sheet updated successfully!");

    // --- Step 7: Save new lastUpdatedRow to row_tracker.json
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
