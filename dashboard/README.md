# Trade Analytics — Dashboard (Next.js)

Next.js 14 (App Router) + TypeScript dashboard for the Trade Analytics pipeline. Replaces the
standalone HTML/JS prototype that previously lived in this folder.

## Quickstart

```bash
cd dashboard
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

## Environment

Copy `.env.example` to `.env.local` and fill the values. All env vars are server-side only;
nothing is shipped to the browser.

| Var | Purpose |
|---|---|
| `GOOGLE_CREDENTIALS`     | Base64-encoded service-account JSON (same value the pipeline uses) |
| `GOOGLE_SHEET_ID`        | Spreadsheet ID (from the sheet URL)                                |
| `SHEET_GID`              | Numeric GID of the target tab                                      |
| `SHEET_NAME`             | Tab name as it appears in the spreadsheet                          |
| `BROKER_ACCOUNTS_JSON`   | JSON array of mailboxes + accounts (same shape as the pipeline)    |

**Live vs mock fallback.** If any of `GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID`, `SHEET_NAME`, or
`BROKER_ACCOUNTS_JSON` is missing — or the Sheets call fails for any reason — `/api/trading`
and the server pages silently fall back to the deterministic mock generator in
`lib/mocks/trading.ts`. The Trading and Overview views show a banner when this happens.

The Investment view is mock-only for now (`lib/mocks/investment.ts`); it has no live source yet.
The Settings page is localStorage-only.

## Project layout

```
dashboard/
  app/
    layout.tsx                 # root layout: ThemeProvider + AppShell + globals.css
    page.tsx                   # / Overview (server: loads sheet → mock fallback)
    trading/page.tsx           # /trading
    investment/page.tsx        # /investment
    settings/page.tsx          # /settings  (client-only)
    globals.css                # ported from styles/dashboard.css
    api/
      trading/route.ts         # GET → { records: BrokerRecord[], source: "sheet"|"mock" }
      investment/route.ts      # GET → MOCK_INVESTMENT
  components/
    AppShell.tsx               # topbar, nav, user menu — wraps AuthGate
    AuthGate.tsx               # localStorage user gate, exposes useUser()
    LoginGate.tsx              # mock "Sign in with Google" card
    ThemeProvider.tsx          # data-theme attr + localStorage("ta_dash_theme")
    Chart.tsx                  # ECharts wrapper (ref + ResizeObserver)
    FilterBar.tsx              # date range / preset / broker / CSV
    KpiGrid.tsx, StatStrip.tsx # presentational cards
    TradingTable.tsx           # daily detail table + CSV helpers
    HoldingsTable.tsx          # per-broker grouped holdings
    OverviewView.tsx
    TradingView.tsx
    InvestmentView.tsx
    SettingsView.tsx           # mailbox/account CRUD over localStorage
  lib/
    format.ts                  # INR, %, bps, dates
    metrics.ts                 # sum/mean/std/cumulative/drawdown/winRate/streaks/...
    chartkit.ts                # ECharts theme + BROKER_NAMES
    charts/trading.ts          # pure (data, opts) => EChartsOption
    charts/investment.ts       # pure (data, opts) => EChartsOption
    auth.ts                    # mock Google sign-in (localStorage)
    trading-model.ts           # buildTradingModel(records, capital)
    sheets.ts                  # SERVER ONLY — Google Sheets loader
    mocks/{trading,investment,accounts}.ts
  types/index.ts               # BrokerRecord, TradingDay, InvestmentDay, Holding, Mailbox, ...
```

## Data flow

1. The Overview and Trading pages are React Server Components. They call
   `getTradingBrokerRecords()` (`lib/sheets.ts`) which either reads the configured Google Sheet
   or returns the deterministic mock from `lib/mocks/trading.ts`.
2. The page serializes the result and passes `initialRecords` (or the built model) into a
   client component (`TradingView` / `OverviewView`).
3. The client computes `buildTradingModel(filteredRecords, CAPITAL)` on every filter change via
   `useMemo` — no further server hops.
4. The Investment page hands the mock `{ daily, holdings }` straight into `InvestmentView`.
5. Charts are rendered by the `<Chart option={...} />` wrapper which mounts a single
   `echarts.init()` instance per element and re-applies `setOption(option, true)` whenever the
   memoized option changes.

## Adding a chart

1. Add a pure builder to `lib/charts/trading.ts` or `lib/charts/investment.ts`:
   ```ts
   export function buildMyOption(data: TradingDay[], opts: ChartOpts = {}): any { ... }
   ```
   The builder must not touch the DOM — only return an EChartsOption-compatible object.
2. Import it in `TradingView.tsx` or `InvestmentView.tsx`, memoize the result against
   `{ daily, dark }`, and render with `<Chart option={memoizedOpt} />`.

## Migration notes

This Next.js app replaced the standalone HTML/JS prototype (`index.html`, `app.js`, `auth.js`,
`settings.js`, `charts/`, `data/`, `lib/*.js`, `styles/`) in a single commit on the
`claude/inspiring-albattani-FeET4` branch. The prototype is preserved in git history.

The repo root pipeline (`fetchMail.js`, `parser.js`, `updateSheet.js`, `checkDates.js`,
`brokers/`) is unchanged — this app only **reads** from the Sheet the pipeline writes to.
