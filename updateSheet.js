const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config();

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

    const targetDate = process.env.TARGET_DATE
      ? new Date(process.env.TARGET_DATE)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return d;
        })();

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

    // --- Step 3: Get the value of the last row in Column A
    const lastRowValue =
      lastRow > 0
        ? (
            await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: `${sheetName}!A${lastRow}:${lastRow}`,
            })
          ).data.values[0][0]
        : 0;

    // --- Step 4: Set newRow as the previous row value + 1
    const newRow = lastRow ? parseInt(lastRow) + 1 : 1;
    const newRowValue = lastRowValue ? parseInt(lastRowValue) + 1 : 1;

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

    // --- Step 5: Read your daily_summary.json
    const rawData = fs.readFileSync("daily_summary.json", "utf-8");
    const data = JSON.parse(rawData);

    // --- Step 6: Prepare values for new row
    const sellAlgo =
      data?.total?.payin_payout_obligation + data?.total?.net_brokerage;
    const brokerage =
      data?.total?.payin_payout_obligation -
      data?.total?.final_net +
      data?.total?.net_brokerage;

    const dayName = targetDate.toLocaleDateString("en-GB", { weekday: "long" });
    const dateFormatted = targetDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });

    const values = [
      [
        newRowValue,
        dayName,
        dateFormatted,
        sellAlgo,
        brokerage,
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ];

    // --- Step 7: Insert values in A to K columns (with new row)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${newRow}:K${newRow}`,
      valueInputOption: "RAW",
      resource: { values },
    });

    // --- Step 8: Copy formulas from the previous row (F to K)
    const copyRequest = {
      spreadsheetId,
      resource: {
        requests: [
          {
            copyPaste: {
              source: {
                sheetId,
                startRowIndex: lastRow - 1, // Last row (zero-based index)
                endRowIndex: lastRow,
                startColumnIndex: 5, // Column F (zero-based index)
                endColumnIndex: 11, // Column K
              },
              destination: {
                sheetId,
                startRowIndex: newRow - 1, // New row (zero-based index)
                endRowIndex: newRow,
                startColumnIndex: 5, // Column F
                endColumnIndex: 11, // Column K
              },
              pasteType: "PASTE_FORMULA",
            },
          },
        ],
      },
    };

    await sheets.spreadsheets.batchUpdate(copyRequest);

    console.log("✅ Sheet updated successfully!");

    // --- Step 9: Save trackers
    fs.writeFileSync(
      "row_tracker.json",
      JSON.stringify({ lastUpdatedRow: newRow }, null, 2),
      "utf-8"
    );
    fs.writeFileSync(
      "row_tracker_updated.json",
      JSON.stringify({ lastUpdatedRow: targetDate.toISOString().slice(0, 10) }, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("❌ Error updating Google Sheets:", error);
  }
}

updateGoogleSheet();
