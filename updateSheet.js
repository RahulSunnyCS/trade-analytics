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
    const sheetId = 1554155583;
    const sheetName = "Trade Book Dup";

    // --- Step 1: Read the tracker file
    let lastRow = 20;
    try {
      const trackerRaw = fs.readFileSync("row_tracker.json", "utf-8");
      const trackerData = JSON.parse(trackerRaw);
      lastRow = trackerData.lastUpdatedRow || 20;
    } catch (err) {
      console.warn("No existing row_tracker.json found. Starting from row 20.");
    }

    const newRow = lastRow + 1;

    // --- Step 2: Read your daily_summary.json
    const rawData = fs.readFileSync("daily_summary.json", "utf-8");
    const data = JSON.parse(rawData);

    // --- Step 3: Prepare values for new row
    const sellAlgo =
      data?.total?.payin_payout_obligation + data?.total?.net_brokerage;
    const brokerage =
      data?.total?.payin_payout_obligation -
      data?.total?.final_net +
      data?.total?.net_brokerage;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const dayName = yesterday.toLocaleDateString("en-GB", { weekday: "long" });
    const dateFormatted = yesterday.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });

    const values = [
      [
        newRow - 19, // Sl No (if you started from row 20)
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

    // --- Step 4: Insert values in A to E columns
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${newRow}:K${newRow}`,
      valueInputOption: "RAW",
      resource: { values },
    });

    // --- Step 5: Copy formulas from previous row F to K
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
                startColumnIndex: 5,
                endColumnIndex: 11,
              },
              destination: {
                sheetId,
                startRowIndex: newRow - 1,
                endRowIndex: newRow,
                startColumnIndex: 5,
                endColumnIndex: 11,
              },
              pasteType: "PASTE_FORMULA",
            },
          },
        ],
      },
    };

    await sheets.spreadsheets.batchUpdate(copyRequest);

    console.log("✅ Sheet updated successfully!");

    // --- Step 6: Save new lastUpdatedRow
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
