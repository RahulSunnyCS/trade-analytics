# CLAUDE.md — AI Assistant Guide for trade-analytics

## Project Overview

**trade-analytics** (package name: `shoonya-contract-parser`) is a Node.js automation pipeline that:

1. Fetches trading contract note emails from Gmail via IMAP
2. Extracts and decrypts password-protected PDF attachments
3. Parses NSE FNO (Futures & Options) financial data from PDFs
4. Appends structured daily summaries to a Google Sheet

It also includes a React/TypeScript component (`PaginatedPreview.tsx`) for paginated HTML document previews using Paged.js.

---

## Repository Structure

```
trade-analytics/
├── .github/
│   └── workflows/
│       ├── daily-cron-job.yml       # Main automated daily pipeline (runs at 00:01 UTC)
│       └── update-row-tracker.yml   # Manual workflow to correct the row tracker
├── components/
│   └── PaginatedPreview.tsx         # React component for paginated print preview
├── styles/
│   └── print-shared.css             # A4 print layout styles for Paged.js
├── checkDates.js                    # Finds missing dates in the Google Sheet
├── fetchMail.js                     # Downloads PDFs from Gmail via IMAP
├── parser.js                        # Extracts NSE FNO data from decrypted PDFs
├── updateSheet.js                   # Appends parsed data rows to Google Sheets
├── package.json
├── package-lock.json
└── README.md
```

**Runtime-generated files (git-ignored, do not commit):**
- `data/` — Downloaded and decrypted PDF files
- `daily_summary.json` — Parsed output from `parser.js`
- `gap_dates.txt` — Missing date list from `checkDates.js`
- `row_tracker.json` — Persists last written Google Sheet row (also stored as a GitHub Actions artifact)

---

## Data Pipeline Architecture

```
Gmail IMAP
    └─→ fetchMail.js  (downloads PDFs, decrypts via qpdf)
            └─→ parser.js  (extracts NSE FNO metrics → daily_summary.json)
                    └─→ updateSheet.js  (appends row to Google Sheet)

checkDates.js  (standalone: queries Sheet + row_tracker.json → gap_dates.txt)
```

The CI/CD workflow loops through each date in `gap_dates.txt` and runs fetch → parse → sheet for each.

---

## Core Scripts

### `fetchMail.js`
- Connects to Gmail via IMAP (imap.gmail.com:993, SSL)
- Searches for emails matching: `Combined Contract Note for {accountId} {date}`
- Saves PDF attachments to `data/`
- Decrypts PDFs using the `qpdf` CLI tool (must be installed separately)
- Supports multiple Gmail accounts configured via environment variables

### `parser.js`
- Scans `data/` for `*_decrypted.pdf` files
- Uses regex to extract three NSE FNO metrics per account:
  - `payin_payout_obligation`
  - `final_net`
  - `net_brokerage`
- Outputs `daily_summary.json` with per-account data and aggregated totals

### `checkDates.js`
- Reads `row_tracker.json` for the last processed row
- Queries column C of the Google Sheet to find the latest date present
- Writes all gap dates (missing between last sheet date and today) to `gap_dates.txt`

### `updateSheet.js`
- Authenticates to Google Sheets via a Service Account (JWT, base64-encoded credentials)
- Reads `daily_summary.json`
- Inserts a new row with: row number, day name, formatted date, per-account values
- Copies formula cells from the previous row
- Guards against duplicate date entries
- Updates `row_tracker.json` with the new last row

---

## Environment Variables

All secrets are stored as GitHub Actions Secrets and loaded via `dotenv` locally. Required variables:

| Variable | Description |
|---|---|
| `EMAILS` | Comma-separated Gmail addresses |
| `PASSWORDS` | Comma-separated Gmail app passwords (match order with EMAILS) |
| `ACCOUNT_IDS` | Comma-separated account identifiers (used in email subject matching) |
| `PDF_PASSWORDS` | Comma-separated PDF decryption passwords |
| `GOOGLE_CREDENTIALS` | Base64-encoded Google Service Account JSON |
| `GOOGLE_SHEET_ID` | Google Sheets document ID |
| `SHEET_GID` | Numeric sheet tab ID |
| `SHEET_NAME` | Sheet tab name |
| `TARGET_DATE` | (Optional) Date to process in `YYYY-MM-DD` format; defaults to yesterday |

For local development, create a `.env` file in the project root (already git-ignored).

---

## NPM Scripts

```bash
npm start               # Runs the full pipeline: fetch → check-dates → parse → sheet
npm run fetch-parse     # Same as start
npm run fetch           # Only fetchMail.js
npm run check-dates     # Only checkDates.js
npm run parse           # Only parser.js
npm run sheet           # Only updateSheet.js
```

---

## External Dependencies

- **Node.js**: v20 (specified in GitHub Actions)
- **qpdf**: System CLI tool for PDF decryption — must be installed separately (`apt-get install qpdf`)
- **Paged.js**: Browser library for pagination (referenced in `PaginatedPreview.tsx`, loaded client-side)

---

## Google Sheets Integration

- Authentication: Google Service Account with JWT, credentials passed as base64-encoded JSON in `GOOGLE_CREDENTIALS`
- Column layout: Row number | Day name | Date | [per-account columns] | [formula columns]
- Formula columns from the previous row are automatically copied to the new row
- The script uses `columnToLetter()` to convert numeric column indices to A1 notation

---

## CI/CD Workflows

### `daily-cron-job.yml`
- **Schedule**: Runs automatically at 00:01 UTC every day
- **Manual trigger**: `workflow_dispatch`
- **Key behavior**:
  - Downloads `row_tracker.json` from the latest GitHub Actions artifact to restore state
  - Installs `qpdf` via apt
  - Runs `check-dates` to generate `gap_dates.txt`
  - Loops through each date in `gap_dates.txt`, running the full pipeline per date
  - Skips dates where no decrypted PDFs are produced (no email found)
  - Re-uploads updated `row_tracker.json` as an artifact
  - Prunes artifacts older than 2 days (retains 5 most recent)

### `update-row-tracker.yml`
- **Manual trigger only** (`workflow_dispatch`)
- Accepts a `lastUpdatedRow` input to manually correct the tracker
- Updates the artifact using `jq`

---

## React Component: PaginatedPreview

**File**: `components/PaginatedPreview.tsx`

- Framework: React with Next.js (`"use client"` directive)
- Integrates with Paged.js for browser-side print pagination
- Debounces pagination calls (120ms default) to avoid redundant re-renders
- Waits for fonts and images to fully load before paginating
- Prevents concurrent pagination runs with a ref-based guard
- Exports a memoized component and `PaginatedPreviewProps` TypeScript interface
- Paired with `styles/print-shared.css` for A4 page layout

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Script files | camelCase | `fetchMail.js`, `updateSheet.js` |
| Functions | camelCase | `fetchEmails()`, `columnToLetter()` |
| Environment variables | SCREAMING_SNAKE_CASE | `GOOGLE_SHEET_ID` |
| PDF files (raw) | `{email_underscored}_{original}.pdf` | `user_gmail_com_Contract.pdf` |
| PDF files (decrypted) | suffix `_decrypted.pdf` | `user_gmail_com_Contract_decrypted.pdf` |
| React components | PascalCase | `PaginatedPreview` |
| CSS files | kebab-case | `print-shared.css` |

---

## Key Patterns and Conventions

- **Multi-account support**: All account-specific config is comma-separated in environment variables. Scripts zip these into per-account arrays at runtime.
- **Idempotency**: `updateSheet.js` checks for duplicate dates before inserting; the CI workflow skips dates with no PDFs found.
- **State persistence**: `row_tracker.json` is the only mutable state file; it is persisted between CI runs via GitHub Actions artifacts (not committed to git).
- **Error handling**: Scripts use `console.error` for failures; the CI pipeline uses `set -e` so any unhandled error stops the job.
- **Data folder lifecycle**: The `data/` directory is created by `fetchMail.js` if absent and is cleaned between runs by the CI workflow.

---

## Local Development Setup

```bash
# Install dependencies
npm install

# Install qpdf (required for PDF decryption)
sudo apt-get install qpdf   # Debian/Ubuntu
brew install qpdf            # macOS

# Create a .env file with required environment variables (see list above)
cp .env.example .env         # if example exists, or create manually

# Run the full pipeline
npm start

# Or run individual stages
npm run fetch
npm run parse
npm run sheet
```

---

## What Not to Do

- Do not commit `row_tracker.json`, `daily_summary.json`, `gap_dates.txt`, or anything under `data/` — these are runtime artifacts.
- Do not hardcode credentials, email addresses, or PDF passwords in source files.
- Do not push directly to `master`; use feature branches.
- Do not add a test framework stub unless you are adding actual tests — the current `"test"` script is intentionally a placeholder.
- Do not modify `PaginatedPreview.tsx` without understanding the Paged.js lifecycle; the guards against concurrent pagination and incomplete resource loading are intentional.
