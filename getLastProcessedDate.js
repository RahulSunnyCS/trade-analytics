const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const fs = require("fs");

async function main() {
  try {
    const trackerRaw = fs.readFileSync("row_tracker.json", "utf-8");
    const trackerData = JSON.parse(trackerRaw);
    const lastRow = trackerData.lastUpdatedRow;

    if (!lastRow) {
      console.error("No lastUpdatedRow found in row_tracker.json");
      process.exit(1);
    }

    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf8")
    );

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.SHEET_NAME;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!C${lastRow}:C${lastRow}`,
    });

    const value = res.data.values?.[0]?.[0];
    if (!value) {
      console.error("No date value found in sheet");
      process.exit(1);
    }

    const parsed = new Date(value);
    if (isNaN(parsed)) {
      console.error("Unable to parse date value: " + value);
      process.exit(1);
    }

    const iso = parsed.toISOString().split("T")[0];
    console.log(iso);
  } catch (err) {
    console.error("Error computing last processed date:", err);
    process.exit(1);
  }
}

main();
