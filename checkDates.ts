import { google } from "googleapis";
import { JWT } from "google-auth-library";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

function formatForSheet(date: Date): string {
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })
    .replace(/ /g, "-");
}

async function processMissingDates(): Promise<void> {
  console.log("Check date started");

  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS || "", "base64").toString("utf8")
  );

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.SHEET_NAME;

    const trackerRaw = fs.readFileSync("row_tracker.json", "utf-8");
    const trackerData = JSON.parse(trackerRaw);
    const lastRow = trackerData.lastUpdatedRow;

    const cell = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!C${lastRow}`,
    });

    const lastDateStr = cell.data.values?.[0]?.[0];
    console.log("Last updated date in sheet:", lastDateStr);

    if (!lastDateStr) {
      console.log("No date found in the sheet.");
      return;
    }

    const lastDate = new Date(lastDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const current = new Date(lastDate);
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);

    const missingDates: Date[] = [];
    while (current < today) {
      missingDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    if (!missingDates.length) {
      console.log("No missing days.");
    } else {
      console.log("Missing dates:");
      missingDates.forEach((d) => console.log(formatForSheet(d)));
    }

    const isoDates = missingDates.map((d) => d.toISOString().slice(0, 10));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    isoDates.push(tomorrow.toISOString().slice(0, 10));
    fs.writeFileSync("gap_dates.txt", isoDates.join("\n"), "utf-8");
  } catch (err) {
    console.error("Error checking last date:", err);
  }
}

processMissingDates();
