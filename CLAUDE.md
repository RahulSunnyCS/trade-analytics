# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies (also installs qpdf system dep via CI: sudo apt-get install -y qpdf)

npm run fetch        # Fetch contract note PDFs from Gmail via IMAP → saves to data/
npm run parse        # Parse decrypted PDFs in data/ → writes daily_summary.json
npm run sheet        # Update Google Sheet from daily_summary.json
npm run check-dates  # Detect date gaps in the sheet → writes gap_dates.txt

npm start            # Run the full pipeline: fetch → check-dates → parse → sheet
```

To process a specific date instead of yesterday:
```bash
TARGET_DATE=2025-04-30 npm run fetch
TARGET_DATE=2025-04-30 npm run parse
TARGET_DATE=2025-04-30 npm run sheet
```

## Architecture

This is a Node.js automation pipeline that processes daily equity/FNO contract notes from Angel One (broker) and records P&L summaries into a Google Sheet. It runs on a daily GitHub Actions schedule.

### Pipeline Flow

```
Gmail (IMAP) → fetchMail.js → data/*.pdf (encrypted)
                             ↓ qpdf decrypt
                           data/*_decrypted.pdf
                             ↓
                          parser.js → daily_summary.json
                             ↓
                        updateSheet.js → Google Sheet row
```

**`fetchMail.js`** — Connects to each Gmail account over IMAP, searches for emails whose subject matches `Combined Contract Note for {accountId} {dd-mm-yyyy}`, saves PDF attachments to `data/`, then decrypts them using the system `qpdf` binary with a per-account password from `PDF_PASSWORDS`.

**`parser.js`** — Reads all `*_decrypted.pdf` files from `data/`, extracts the NSE FNO summary line using a regex, and writes `daily_summary.json` with per-account and total values for `payin_payout_obligation`, `final_net`, and `net_brokerage`.

**`checkDates.js`** — Reads `row_tracker.json` for the last-updated sheet row, fetches the date in column C of that row from the Google Sheet, and writes `gap_dates.txt` listing all missing trading dates plus tomorrow. The CI workflow loops over this file to backfill gaps.

**`updateSheet.js`** — Reads `daily_summary.json`, resolves the next empty row via `row_tracker.json` (falling back to the sheet itself), inserts a new row with serial number / day name / date / per-account P&L values, and copies formula columns from the previous row. Persists the new row number to `row_tracker.json`.

**`row_tracker.json`** — Persisted between CI runs as a GitHub Actions artifact named `row-tracker`. It stores `{ "lastUpdatedRow": N }` to avoid a live sheet read on every run.

### Multi-Account Support

`EMAILS`, `PASSWORDS`, `ACCOUNT_IDS`, and `PDF_PASSWORDS` are comma-separated lists of equal length. Each index represents one brokerage account. `parser.js` matches filenames by account ID; `updateSheet.js` maps account IDs to columns in the sheet in the order they appear in `ACCOUNT_IDS`.

### Components

`components/PaginatedPreview.tsx` is a standalone React component (Next.js `"use client"`) that renders HTML content paginated via `window.Paged.Previewer` (Paged.js). It is not wired into the Node.js pipeline — it appears to be a UI component for a separate front-end that previews paginated documents. It uses stable DOM refs to avoid re-mounts, debounces re-renders, and guards against concurrent pagination runs.

### Required Environment Variables

| Variable | Description |
|---|---|
| `EMAILS` | Comma-separated Gmail addresses |
| `PASSWORDS` | Gmail app passwords (same order as EMAILS) |
| `ACCOUNT_IDS` | Broker account IDs (same order) |
| `PDF_PASSWORDS` | Per-account PDF decryption passwords (same order) |
| `GOOGLE_CREDENTIALS` | Base64-encoded Google service account JSON |
| `GOOGLE_SHEET_ID` | Google Sheet ID from URL |
| `SHEET_GID` | Numeric GID of the target tab |
| `SHEET_NAME` | Name of the target tab |

`TARGET_DATE` (optional) overrides the default of yesterday (`YYYY-MM-DD` format).

### CI Workflows

`.github/workflows/` contains two workflows:
- **Daily Trading Data Processing** — runs at 00:01 UTC daily; downloads the `row-tracker` artifact, calls `check-dates`, loops over `gap_dates.txt` processing each missing date, uploads the updated artifact.
- **Update Last Updated Row** — manual `workflow_dispatch` to correct `lastUpdatedRow` in the artifact when the sheet is manually edited.
