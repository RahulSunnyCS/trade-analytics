# Trade Mail Parser

## Overview

This project consists of three main scripts:

- **fetchMail.js**  
  Fetches emails from multiple Gmail accounts using the provided credentials and filters the emails based on specific criteria (e.g., subject line, sender).

- **parse.js**  
  Parses the fetched email content to extract relevant trade-related data in a structured format (like trade entries, exits, quantities, etc.).

- **sheetUpdate.js**  
  Updates a Google Sheet with the parsed data, appending new rows or updating existing ones based on the extracted information.

---

## Environment Variables

Before running the scripts, you need to set up a `.env` file with the following variables:

```env
EMAILS=email1@gmail.com,email2@gmail.com
PASSWORDS=password1,password2
ACCOUNT_IDS=accountid1,accountid2
GOOGLE_CREDENTIALS=Base64_Encoded_Google_Credentials_JSON
GOOGLE_SHEET_ID=your_google_sheet_id
SHEET_GID=your_sheet_gid
SHEET_NAME=your_sheet_name
```

### Explanation:

| Variable             | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `EMAILS`             | Comma-separated list of Gmail addresses to fetch mails from.                                |
| `PASSWORDS`          | Corresponding comma-separated passwords for the above emails (use app passwords if needed). |
| `ACCOUNT_IDS`        | Comma-separated account IDs to match with extracted trades.                                 |
| `GOOGLE_CREDENTIALS` | Base64 encoded service account JSON credentials for Google Sheets API access.               |
| `GOOGLE_SHEET_ID`    | ID of the target Google Sheet where data should be updated.                                 |
| `SHEET_GID`          | GID of the specific sheet/tab inside the Google Sheet.                                      |
| `SHEET_NAME`         | Name of the specific sheet/tab inside the Google Sheet.                                     |

---

## Helpful Links

- **How to Create Google Service Account and Get Credentials:**  
  [Guide: Creating Service Account and Enabling Google Sheets API](https://cloud.google.com/iam/docs/creating-managing-service-account-keys)

- **How to Get Google Sheet ID and GID:**

  - **Sheet ID**: It's the long string in the URL between `/d/` and `/edit`.  
    Example: `https://docs.google.com/spreadsheets/d/your_google_sheet_id/edit#gid=0`
  - **GID**: It’s the value after `gid=` in the URL.

- **Base64 Encode your Credentials:**
  You can encode your service account JSON file using:
  ```bash
  base64 service-account.json
  ```

---

## Example `.env` (Generic)

```env
EMAILS=user1@gmail.com,user2@gmail.com
PASSWORDS=yourpassword1,yourpassword2
ACCOUNT_IDS=accountid1,accountid2
GOOGLE_CREDENTIALS=your_base64_encoded_service_account_json
GOOGLE_SHEET_ID=your_google_sheet_id_here
SHEET_GID=your_sheet_gid_here
SHEET_NAME=your_sheet_name_here
```

---

## Adding Environment Variables to GitHub Actions

To use this project with **GitHub Actions**, make sure you add the environment variables as **GitHub Secrets**:

### Steps:

1. Go to your GitHub repository.
2. Navigate to **Settings** → **Secrets and variables** → **Actions**.
3. Click **"New repository secret"**.
4. Add each of the following as separate secrets:

| GitHub Secret Name   | Corresponds to .env Variable |
| -------------------- | ---------------------------- |
| `EMAILS`             | `EMAILS`                     |
| `PASSWORDS`          | `PASSWORDS`                  |
| `ACCOUNT_IDS`        | `ACCOUNT_IDS`                |
| `GOOGLE_CREDENTIALS` | `GOOGLE_CREDENTIALS`         |
| `GOOGLE_SHEET_ID`    | `GOOGLE_SHEET_ID`            |
| `SHEET_GID`          | `SHEET_GID`                  |
| `SHEET_NAME`         | `SHEET_NAME`                 |

### Notes:

- Make sure your GitHub Actions workflow is configured to load these secrets using the `secrets` context.
- You can access the secrets in your workflow like this:

```yaml
env:
  EMAILS: ${{ secrets.EMAILS }}
  PASSWORDS: ${{ secrets.PASSWORDS }}
  ACCOUNT_IDS: ${{ secrets.ACCOUNT_IDS }}
  GOOGLE_CREDENTIALS: ${{ secrets.GOOGLE_CREDENTIALS }}
  GOOGLE_SHEET_ID: ${{ secrets.GOOGLE_SHEET_ID }}
  SHEET_GID: ${{ secrets.SHEET_GID }}
  SHEET_NAME: ${{ secrets.SHEET_NAME }}
```
