// Pure analytics over the mock schema (see README). Depends on window.Format.
// Standalone build: attaches to window.Metrics. Next.js port: lib/metrics.ts named exports.
(function (global) {
  "use strict";

  function sum(arr) {
    return arr.reduce((a, b) => a + (Number(b) || 0), 0);
  }
  function mean(arr) {
    return arr.length ? sum(arr) / arr.length : 0;
  }
  function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + Math.pow((Number(b) || 0) - m, 2), 0) / (arr.length - 1));
  }

  function cumulative(arr) {
    let run = 0;
    return arr.map((v) => (run += Number(v) || 0));
  }

  // drawdown[i] = overall[i] - running peak (<= 0)
  function drawdownSeries(overall) {
    let peak = -Infinity;
    return overall.map((v) => {
      peak = Math.max(peak, v);
      return v - peak;
    });
  }

  function maxDrawdown(overall) {
    const dd = drawdownSeries(overall);
    let mdd = 0,
      index = -1;
    dd.forEach((v, i) => {
      if (v < mdd) {
        mdd = v;
        index = i;
      }
    });
    return { mdd, index, series: dd };
  }

  function winRate(profits) {
    let wins = 0,
      losses = 0;
    profits.forEach((p) => {
      if (p > 0) wins++;
      else if (p < 0) losses++;
    });
    const denom = wins + losses;
    return { wins, losses, rate: denom ? (wins / denom) * 100 : 0 };
  }

  function streaks(profits) {
    let cur = 0,
      longestWin = 0,
      longestLoss = 0;
    profits.forEach((p) => {
      if (p > 0) {
        cur = cur > 0 ? cur + 1 : 1;
        longestWin = Math.max(longestWin, cur);
      } else if (p < 0) {
        cur = cur < 0 ? cur - 1 : -1;
        longestLoss = Math.min(longestLoss, cur);
      }
    });
    return { current: cur, longestWin, longestLoss: Math.abs(longestLoss) };
  }

  // trailing simple moving average; first (n-1) entries are null
  function rollingMean(arr, n) {
    const out = [];
    let acc = 0;
    for (let i = 0; i < arr.length; i++) {
      acc += Number(arr[i]) || 0;
      if (i >= n) acc -= Number(arr[i - n]) || 0;
      out.push(i >= n - 1 ? acc / n : null);
    }
    return out;
  }

  function bestWorst(records, key) {
    key = key || "profit";
    let best = null,
      worst = null;
    records.forEach((r) => {
      if (best === null || r[key] > best[key]) best = r;
      if (worst === null || r[key] < worst[key]) worst = r;
    });
    return { best, worst };
  }

  // Indian FY: Apr 1 -> Mar 31. Returns the calendar year the FY starts in.
  function fyStartYear(iso) {
    const d = Format.toDate(iso);
    const y = d.getUTCFullYear();
    return d.getUTCMonth() >= 3 ? y : y - 1; // month 3 == April
  }
  function fyLabel(startYear) {
    return "FY " + startYear + "-" + String(startYear + 1).slice(-2);
  }
  function inFY(iso, startYear) {
    return fyStartYear(iso) === startYear;
  }
  function inCalendarYTD(iso, year) {
    return Format.toDate(iso).getUTCFullYear() === year;
  }

  function dayOfWeekAgg(records) {
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const buckets = {};
    records.forEach((r) => {
      const name = r.day || names[Format.toDate(r.date).getUTCDay()];
      (buckets[name] = buckets[name] || []).push(r.profit);
    });
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return order
      .filter((n) => buckets[n])
      .map((n) => ({ day: n, avg: mean(buckets[n]), total: sum(buckets[n]), count: buckets[n].length }));
  }

  function filterByDateRange(records, startIso, endIso) {
    const s = startIso ? Format.toDate(startIso).getTime() : -Infinity;
    const e = endIso ? Format.toDate(endIso).getTime() : Infinity;
    return records.filter((r) => {
      const t = Format.toDate(r.date).getTime();
      return t >= s && t <= e;
    });
  }

  // daily-return-based proxy (NOT a true Sharpe), annualized by sqrt(252)
  function sharpeProxy(profits, capital) {
    const rets = profits.map((p) => p / (capital || 1));
    const s = std(rets);
    return s ? (mean(rets) / s) * Math.sqrt(252) : 0;
  }

  function monthKeyOf(iso) {
    const d = Format.toDate(iso);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }

  global.Metrics = {
    sum, mean, std, cumulative, drawdownSeries, maxDrawdown, winRate, streaks,
    rollingMean, bestWorst, fyStartYear, fyLabel, inFY, inCalendarYTD,
    dayOfWeekAgg, filterByDateRange, sharpeProxy, monthKeyOf,
  };
})(window);
