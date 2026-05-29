// Mock trading data — mirrors the pipeline output (parser.js / updateSheet.js) plus the
// Trade Book derived analytics. Field names match the real backend so swapping to live data
// (Google Sheet rows) later only changes the loader, not the UI.
//
// Exposes:
//   window.MOCK_TRADING = { daily[], brokers[], monthly[] }
//   window.TradingModel  = { build(brokerRecords, capital) }  // used to recompute on filter
(function (global) {
  "use strict";

  // deterministic PRNG (mulberry32) so the prototype renders identically every time
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CAPITAL = 1200000;
  const N_DAYS = 110;
  const END = Date.UTC(2026, 4, 28); // 2026-05-28
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // The two accounts the Trade Book tracks: one Finvasia (Shoonya) + one Angel One.
  const ACCOUNTS = [
    { broker: "finvasia", accountId: "FA1234", weight: 0.6 },
    { broker: "angelone", accountId: "R59799620", weight: 0.4 },
  ];

  function weekdaysBack(endMs, count) {
    const out = [];
    let d = new Date(endMs);
    while (out.length < count) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(new Date(d));
      d = new Date(d.getTime() - 86400000);
    }
    return out.reverse();
  }
  function isoOf(d) {
    return (
      d.getUTCFullYear() +
      "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getUTCDate()).padStart(2, "0")
    );
  }

  // Generate per-account, per-day rows (the raw pipeline shape).
  function genBrokerRecords() {
    const rand = rng(20260528);
    const dates = weekdaysBack(END, N_DAYS);
    const brokers = [];
    dates.forEach((d) => {
      const iso = isoOf(d);
      ACCOUNTS.forEach((acc) => {
        const win = rand() < 0.56;
        const base = acc.weight * CAPITAL * (0.003 + rand() * 0.004); // 0.3%–0.7% of capital
        const mag = win ? 0.7 + rand() * 0.7 : 0.35 + rand() * 0.45; // winners run a bit larger than losers
        const obligation = Math.round((win ? 1 : -1) * base * mag);
        const algos = Math.round(4 + rand() * 14);
        const brokerage = Math.round(algos * (12 + rand() * 10));
        const other = Math.round(Math.abs(obligation) * 0.01 + 80 + rand() * 400);
        const total = brokerage + other;
        brokers.push({
          date: iso,
          broker: acc.broker,
          accountId: acc.accountId,
          algos: algos,
          payin_payout_obligation: obligation,
          net_brokerage: brokerage,
          other_charges: other,
          total_charges: total,
          final_net: obligation - total,
        });
      });
    });
    return brokers;
  }

  // Build the daily + monthly series from a set of per-account rows.
  // Used both for the full dataset and for filtered (by date/broker) recomputes.
  function build(brokerRecords, capital) {
    capital = capital || CAPITAL;
    const byDate = {};
    brokerRecords.forEach((b) => {
      const day = (byDate[b.date] = byDate[b.date] || {
        date: b.date,
        profit: 0,
        charges: 0,
        algos: 0,
        algoCharges: 0,
      });
      day.profit += b.final_net;
      day.charges += b.total_charges;
      day.algos += b.algos || 0;
      day.algoCharges += b.net_brokerage;
    });

    const daily = Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
    daily.forEach((r) => {
      r.day = DAY_NAMES[Format.toDate(r.date).getUTCDay()];
      r.capital = capital;
    });

    const profits = daily.map((r) => r.profit);
    const overall = Metrics.cumulative(profits);
    const dd = Metrics.drawdownSeries(overall);
    const avg50 = Metrics.rollingMean(profits, 50);
    const avg100 = Metrics.rollingMean(profits, 100);
    const avgChg100 = Metrics.rollingMean(daily.map((r) => r.charges), 100);

    daily.forEach((r, i) => {
      r.overall = Math.round(overall[i]);
      r.drawdown = Math.round(dd[i]);
      r.avgProfit50 = avg50[i] == null ? null : Math.round(avg50[i]);
      r.avgProfit100 = avg100[i] == null ? null : Math.round(avg100[i]);
      r.avgCharge100 = avgChg100[i] == null ? null : Math.round(avgChg100[i]);
      r.chargeProfitRatio =
        avg100[i] && avgChg100[i] && avg100[i] > 0 ? +((avgChg100[i] * 100) / avg100[i]).toFixed(1) : null;
      r.profitCapitalBps = +((r.profit / capital) * 10000).toFixed(1);
    });

    // monthly aggregation
    const byMonth = {};
    daily.forEach((r) => {
      const k = Metrics.monthKeyOf(r.date);
      byMonth[k] = (byMonth[k] || 0) + r.profit;
    });
    const monthly = Object.keys(byMonth)
      .sort()
      .map((k) => ({
        month: k,
        tradingGain: Math.round(byMonth[k]),
        gainPct: +((byMonth[k] / capital) * 100).toFixed(2),
      }));
    monthly.forEach((m, i) => {
      const slice = monthly.slice(Math.max(0, i - 2), i + 1).map((x) => x.gainPct);
      m.gainAvg3m = +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2);
    });

    return { daily, brokers: brokerRecords, monthly };
  }

  const brokerRecords = genBrokerRecords();
  global.TradingModel = { build };
  global.MOCK_TRADING = build(brokerRecords, CAPITAL);
})(window);
