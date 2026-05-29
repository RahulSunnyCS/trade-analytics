# Trade Analytics — Dashboard (standalone prototype)

A self-contained HTML dashboard over the **trading** (realized P&L from contract notes) and
**investment** (portfolio vs benchmarks) data. This is the **look-and-feel prototype**; the end goal
is a Next.js/React app in this same `/dashboard` folder (see *Migration* below). All numbers here are
**mock**, but the shapes mirror what the real backend can produce so the swap to live data is local.

## Open it

No build step. Either:

- **Double-click `index.html`** (opens from `file://`), or
- Serve the folder: `python3 -m http.server 8000 --directory dashboard` then visit
  `http://localhost:8000/`.

ECharts loads from a CDN, so the first load needs internet. (The Next.js round switches to the
`echarts` npm package.)

1. You land on a **mock "Sign in with Google"** gate — click it (no real account is used).
2. Use the top nav to switch **Trading · Investment · Settings**.

## What's mock vs. realistically achievable

| Area | Status | Real source later |
|---|---|---|
| Trading daily P&L, charges, cumulative, drawdown, rolling avgs, ratios, monthly | **Mock, fully achievable** | The Google Sheet the pipeline already writes (`updateSheet.js`) |
| Per-broker split (Finvasia/Angel) | **Mock, achievable** | Per-account `final_net` columns in the Sheet |
| Investment portfolio vs benchmarks (Indian/US/Satellite vs Nifty/MidCap/SmallCap) | **Mock, achievable** | `Trade Analytics.xlsx → Investment` tab |
| Per-broker **holdings** table (Shoonya×2, Angel, Fyers, Kite) | **Mock — no live source yet** | A GOOGLEFINANCE holdings sheet or broker APIs |
| Google sign-in | **Mock** | Google Identity Services / Auth.js |
| Accounts settings | **Mock (localStorage)** | A real secret store / `BROKER_ACCOUNTS_JSON` |

## Files

```
index.html            shell: login gate, nav, KPI/chart/table containers, script load order
app.js                auth guard, view routing, filters, KPI computation, chart lifecycle, CSV
auth.js               mock Google sign-in (localStorage)
settings.js           Accounts CRUD over the BROKER_ACCOUNTS_JSON shape (localStorage + JSON import/export)
charts/trading.js     pure build*Option() chart builders + shared ChartKit theme
charts/investment.js  pure build*Option() chart builders
lib/metrics.js        cumulative, drawdown, win rate, streaks, rolling, FY buckets, day-of-week, Sharpe proxy
lib/format.js         ₹ (lakh/crore), %, bps, date formatters
data/mock-trading.js  MOCK_TRADING + TradingModel.build() (recompute on filter)
data/mock-investment.js  MOCK_INVESTMENT (daily series + holdings)
data/mock-accounts.js seed config for Settings
styles/dashboard.css  light/dark theme, 12-col grid, cards, tables
```

## Data schema (mirrors the real fields)

- **Trading day** (`MOCK_TRADING.daily[]`): `date, day, profit` (= Σ `final_net`), `overall` (cumsum),
  `drawdown` (≤0), `charges, algos, algoCharges, avgProfit50, avgProfit100, avgCharge100,
  chargeProfitRatio, capital, profitCapitalBps`.
- **Per-broker day** (`MOCK_TRADING.brokers[]`): the exact pipeline fields —
  `date, broker, accountId, payin_payout_obligation, net_brokerage, other_charges, total_charges, final_net`.
- **Monthly** (`MOCK_TRADING.monthly[]`): `month, tradingGain, gainPct, gainAvg3m`.
- **Investment day** (`MOCK_INVESTMENT.daily[]`): `date` + 7 entities `{indian, us, satellite, total,
  nifty, midcap, smallcap}`, each `{profit, percentage, dailyChange}`.
- **Holding** (`MOCK_INVESTMENT.holdings[]`): `broker, symbol, qty, avgCost, ltp, invested, currentValue,
  unrealizedPnl, dayChangePct, _source`.

## Google Sheet column map (trading, from `updateSheet.js`)

`A` serial · `B` day · `C` date, then a 5-column block per account starting at `sheetStartColumn`:
`[payin_payout_obligation, net_brokerage, other_charges, total_charges (=brokerage+other),
final_net (=payin−total_charges)]`.

## Features

Mock Google sign-in · Accounts settings · date-range filter · FY/YTD presets · broker filter ·
KPI cards · best/worst day · win/loss streaks · day-of-week performance · cumulative equity ·
drawdown · daily P&L + rolling avg · per-broker split · monthly returns · charge efficiency ·
P&L calendar heatmap · benchmark alpha · allocation donut · return comparison · daily-change
histogram · holdings table · CSV export · dark mode.

*Sharpe is a daily-return-based proxy, not a true Sharpe ratio.*

## Migration to Next.js (next round)

Each `build*Option(data)` is pure and lifts verbatim into `lib/charts/*.ts`, rendered by
`<ReactECharts option={...} />`. `lib/metrics` and `lib/format` port unchanged. `app/trading/page.tsx`
and `app/investment/page.tsx` become server components calling `getTradingData()` / `getInvestmentData()`,
which reuse the service-account JWT auth from `updateSheet.js` (base64 `GOOGLE_CREDENTIALS` → `googleapis`
sheets v4). The mock files become fixtures/fallback; the mock sign-in becomes Auth.js (Google), and
Settings writes to a real secret store instead of `localStorage`.
