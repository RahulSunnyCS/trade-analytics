import { google } from "googleapis";
import { JWT } from "google-auth-library";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

function columnToLetter(column: number): string {
  let letter = "";
  while (column > 0) {
    const temp = (column - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    column = Math.floor((column - temp - 1) / 26);
  }
  return letter;
}

async function updateGoogleSheet(): Promise<void> {
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
    const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
    const sheetId = Number(process.env.SHEET_GID);
    const sheetName = process.env.SHEET_NAME as string;

    let lastRow = 0;
    try {
      const trackerRaw = fs.readFileSync("row_tracker.json", "utf-8");
      const trackerData = JSON.parse(trackerRaw);
      lastRow = trackerData.lastUpdatedRow || 0;
      console.log("Using last row from row_tracker.json:", lastRow);
    } catch {
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

    const lastRowValue = Number(lastRowData[0] || 0);
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

    const accountIds = process.env.ACCOUNT_IDS ? process.env.ACCOUNT_IDS.split(",") : [];

    const newRow = lastRow ? Number(lastRow) + 1 : 1;
    const newRowValue = lastRowValue ? Number(lastRowValue) + 1 : 1;
    const rowValues: Array<string | number> = [newRowValue, dayName, dateFormatted];

    accountIds.forEach((id) => {
      const acct = data.individual_account.find(
        (a: { account: string }) => a.account === id || a.account.includes(id)
      );
      rowValues.push(acct?.payin_payout_obligation || 0);
      rowValues.push((acct?.payin_payout_obligation || 0) - (acct?.final_net || 0));
    });

    const dataColumnCount = rowValues.length;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
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

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${newRow}:${columnToLetter(dataColumnCount)}${newRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });

    const formulaColsCount = Math.max(lastRowData.length - dataColumnCount, 0);

    if (formulaColsCount > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
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
      });
    }

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
