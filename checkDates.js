const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

async function logMissingDates() {
  console.log('Check date started');
  // Decode credentials
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
  );

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.SHEET_NAME;

    // Read the last updated row from the artifact
    const trackerRaw = fs.readFileSync('row_tracker.json', 'utf-8');
    const trackerData = JSON.parse(trackerRaw);
    const lastRow = trackerData.lastUpdatedRow;

    // Fetch date from column C at lastRow
    const cell = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!C${lastRow}`,
    });

    const lastDateStr = cell.data.values?.[0]?.[0];
    console.log('Last updated date in sheet:', lastDateStr);

    if (!lastDateStr) {
      console.log('No date found in the sheet.');
      return;
    }

    const lastDate = new Date(lastDateStr);
    const today = new Date();
    const todayStr = today
      .toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
      .replace(/ /g, '-');

    console.log('Today:\t', todayStr);

    // Collect dates between lastDate and today
    const dates = [];
    const current = new Date(lastDate);
    current.setDate(current.getDate() + 1);
    while (current <= today) {
      const formatted = current
        .toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: '2-digit',
        })
        .replace(/ /g, '-');
      dates.push(formatted);
      current.setDate(current.getDate() + 1);
    }

    if (dates.length) {
      console.log('Dates in between:');
      dates.forEach((d) => console.log(d));
    } else {
      console.log('No missing days.');
    }
  } catch (err) {
    console.error('Error checking last date:', err);
  }
}

logMissingDates();
