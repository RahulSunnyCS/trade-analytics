// App entry — auth guard, view routing, global filters, KPI computation, chart lifecycle.
// Standalone build only; the Next.js round replaces this with React components + server data fns.
(function () {
  "use strict";

  const hasECharts = typeof echarts !== "undefined";
  const state = {
    view: "trading",
    dark: false,
    start: null,
    end: null,
    broker: "all",
    charts: {},
    tableHead: null,
    tableRows: null,
  };

  document.addEventListener("DOMContentLoaded", boot);

  function boot() {
    state.dark = localStorage.getItem("ta_dash_theme") === "dark";
    applyTheme();
    const dts = MOCK_TRADING.daily.map((d) => d.date);
    state.start = dts[0];
    state.end = dts[dts.length - 1];
    if (!hasECharts) showOfflineBanner();
    wireGlobal();
    if (Auth.getUser()) showApp();
    else showLogin();
  }

  // ---------- chrome ----------
  function wireGlobal() {
    byId("login-btn").addEventListener("click", () => {
      Auth.signIn();
      showApp();
    });
    document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.nav)));
    byId("theme-toggle").addEventListener("click", toggleTheme);
    byId("signout-btn").addEventListener("click", () => {
      Auth.signOut();
      byId("user-menu").classList.remove("open");
      showLogin();
    });
    byId("user-chip").addEventListener("click", () => byId("user-menu").classList.toggle("open"));
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#user-area")) byId("user-menu").classList.remove("open");
    });
    byId("f-start").addEventListener("change", (e) => {
      state.start = e.target.value;
      markPreset(null);
      render();
    });
    byId("f-end").addEventListener("change", (e) => {
      state.end = e.target.value;
      markPreset(null);
      render();
    });
    byId("f-broker").addEventListener("change", (e) => {
      state.broker = e.target.value;
      render();
    });
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
    byId("csv-btn").addEventListener("click", exportCsv);
    window.addEventListener("resize", debounce(resizeCharts, 150));
  }

  function showLogin() {
    byId("login").style.display = "flex";
    byId("app").style.display = "none";
  }
  function showApp() {
    const u = Auth.getUser() || Auth.DEMO_USER;
    byId("login").style.display = "none";
    byId("app").style.display = "block";
    byId("user-name").textContent = u.name;
    byId("user-email").textContent = u.email;
    byId("user-initials").textContent = Auth.initials(u.name);
    const s = byId("f-start"),
      e = byId("f-end");
    s.min = state.start;
    s.max = state.end;
    s.value = state.start;
    e.min = state.start;
    e.max = state.end;
    e.value = state.end;
    markPreset("all");
    setView(state.view);
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("active", b.dataset.nav === v));
    ["trading", "investment", "settings"].forEach((n) => {
      byId("view-" + n).style.display = n === v ? "block" : "none";
    });
    byId("filterbar").style.display = v === "settings" ? "none" : "flex";
    byId("broker-filter-wrap").style.display = v === "trading" ? "flex" : "none";
    byId("csv-btn").style.display = v === "trading" ? "inline-flex" : "none";
    render();
  }

  function render() {
    if (state.view === "trading") renderTrading();
    else if (state.view === "investment") renderInvestment();
    else Settings.render(byId("view-settings"));
    requestAnimationFrame(resizeCharts);
  }

  // ---------- trading ----------
  function getFilteredTrading() {
    let brokers = Metrics.filterByDateRange(MOCK_TRADING.brokers, state.start, state.end);
    if (state.broker !== "all") brokers = brokers.filter((b) => b.broker === state.broker);
    return TradingModel.build(brokers, 1200000);
  }

  function renderTrading() {
    const model = getFilteredTrading();
    const daily = model.daily;
    const profits = daily.map((d) => d.profit);
    const last = daily[daily.length - 1] || {};
    const lastDate = last.date;
    const totProfit = Metrics.sum(profits);
    const totCharges = Metrics.sum(daily.map((d) => d.charges));
    const mtd = lastDate ? Metrics.sum(daily.filter((d) => Metrics.monthKeyOf(d.date) === Metrics.monthKeyOf(lastDate)).map((d) => d.profit)) : 0;
    const fyStart = lastDate ? Metrics.fyStartYear(lastDate) : null;
    const fy = lastDate ? Metrics.sum(daily.filter((d) => Metrics.inFY(d.date, fyStart)).map((d) => d.profit)) : 0;
    const mdd = Metrics.maxDrawdown(daily.map((d) => d.overall)).mdd;
    const wr = Metrics.winRate(profits);
    const bw = Metrics.bestWorst(daily, "profit");
    const stk = Metrics.streaks(profits);
    const avgDay = Metrics.mean(profits);
    const cpr = totProfit > 0 ? (totCharges * 100) / totProfit : null;
    const sharpe = Metrics.sharpeProxy(profits, 1200000);

    byId("kpi-trading").innerHTML = [
      kpi("Net P&L (range)", Format.signedINR(totProfit), tone(totProfit), daily.length + " trading days"),
      kpi("Last day", Format.signedINR(last.profit || 0), tone(last.profit || 0), lastDate ? Format.formatDate(lastDate) : ""),
      kpi("MTD", Format.signedINR(mtd), tone(mtd)),
      kpi(fyStart != null ? Metrics.fyLabel(fyStart) : "FY", Format.signedINR(fy), tone(fy)),
      kpi("Max drawdown", Format.signedINR(mdd), "neg"),
      kpi("Win rate", wr.rate.toFixed(1) + "%", wr.rate >= 50 ? "pos" : "neg", wr.wins + "W / " + wr.losses + "L"),
    ].join("");

    byId("stat-trading").innerHTML = [
      chip("Avg / day", Format.signedINR(Math.round(avgDay)), tone(avgDay)),
      chip("Best day", Format.signedINR(bw.best ? bw.best.profit : 0), "pos", bw.best ? Format.formatDate(bw.best.date) : ""),
      chip("Worst day", Format.signedINR(bw.worst ? bw.worst.profit : 0), "neg", bw.worst ? Format.formatDate(bw.worst.date) : ""),
      chip("Current streak", stk.current > 0 ? stk.current + "W" : stk.current < 0 ? Math.abs(stk.current) + "L" : "—", tone(stk.current), "max " + stk.longestWin + "W / " + stk.longestLoss + "L"),
      chip("Charge / profit", cpr == null ? "—" : cpr.toFixed(1) + "%", ""),
      chip("Sharpe*", sharpe.toFixed(2), tone(sharpe), "daily-return proxy"),
      chip("Capital", Format.formatINR(1200000, { compact: true }), ""),
    ].join("");

    mountChart("chart-equity", () => TradingCharts.buildEquityOption(daily, { dark: state.dark }));
    mountChart("chart-drawdown", () => TradingCharts.buildDrawdownOption(daily, { dark: state.dark }));
    mountChart("chart-dailypnl", () => TradingCharts.buildDailyPnlOption(daily, { dark: state.dark }));
    mountChart("chart-broker", () => TradingCharts.buildBrokerSplitOption(model.brokers, { dark: state.dark }));
    mountChart("chart-monthly", () => TradingCharts.buildMonthlyOption(model.monthly, { dark: state.dark }));
    mountChart("chart-chargeeff", () => TradingCharts.buildChargeEffOption(daily, { dark: state.dark }));
    mountChart("chart-dow", () => dowOption(daily));
    mountChart("chart-calendar", () => TradingCharts.buildCalendarHeatmapOption(daily, { dark: state.dark }));
    renderTradingTable(daily, model.brokers);
  }

  function dowOption(daily) {
    const dark = state.dark;
    const agg = Metrics.dayOfWeekAgg(daily);
    const base = ChartKit.base(dark);
    return Object.assign({}, base, {
      tooltip: {
        trigger: "axis",
        backgroundColor: dark ? "#1e293b" : "#fff",
        borderColor: ChartKit.split(dark),
        borderWidth: 1,
        textStyle: { color: ChartKit.text(dark) },
        formatter: (p) => p[0].axisValueLabel + "<br/>Avg: <b>" + Format.signedINR(p[0].value) + "</b>",
      },
      xAxis: ChartKit.catAxis(dark, agg.map((a) => a.day.slice(0, 3))),
      yAxis: ChartKit.valAxis(dark, "", (v) => Format.compact(v)),
      series: [
        {
          type: "bar",
          data: agg.map((a) => ({ value: Math.round(a.avg), itemStyle: { color: a.avg >= 0 ? ChartKit.palette.up : ChartKit.palette.down } })),
        },
      ],
    });
  }

  function renderTradingTable(daily, brokers) {
    const byDate = {};
    brokers.forEach((b) => {
      (byDate[b.date] = byDate[b.date] || {})[b.broker] = (byDate[b.date][b.broker] || 0) + b.final_net;
    });
    const brokerKeys = Array.from(new Set(brokers.map((b) => b.broker)));
    const netCols = brokerKeys.map((k) => (TradingCharts.BROKER_NAMES[k] || k) + " Net");
    const head = ["Date", "Day"].concat(netCols).concat(["Profit", "Overall", "Drawdown", "Charges", "Algos", "C/P %", "bps"]);
    const rows = daily
      .slice()
      .reverse()
      .map((d) => {
        const bn = byDate[d.date] || {};
        const row = { Date: d.date, Day: d.day };
        brokerKeys.forEach((k) => (row[(TradingCharts.BROKER_NAMES[k] || k) + " Net"] = Math.round(bn[k] || 0)));
        row.Profit = d.profit;
        row.Overall = d.overall;
        row.Drawdown = d.drawdown;
        row.Charges = d.charges;
        row.Algos = d.algos;
        row["C/P %"] = d.chargeProfitRatio;
        row.bps = d.profitCapitalBps;
        return row;
      });
    state.tableHead = head;
    state.tableRows = rows;

    const moneyCols = ["Profit", "Overall", "Drawdown", "Charges"];
    function cell(h, v) {
      if (h === "Date") return Format.formatDate(v);
      if (moneyCols.indexOf(h) >= 0 || /Net$/.test(h)) return '<span class="' + tone(v) + '">' + Format.signedINR(v) + "</span>";
      if (h === "C/P %") return v == null ? "—" : v + "%";
      if (h === "bps") return v == null ? "—" : v;
      return v;
    }
    const thead = "<tr>" + head.map((h) => "<th>" + h + "</th>").join("") + "</tr>";
    const tbody = rows.map((r) => "<tr>" + head.map((h) => "<td>" + cell(h, r[h]) + "</td>").join("") + "</tr>").join("");
    byId("table-trading").innerHTML = '<table class="data-table"><thead>' + thead + "</thead><tbody>" + tbody + "</tbody></table>";
  }

  function exportCsv() {
    if (!state.tableRows) return;
    const head = state.tableHead;
    const lines = [head.join(",")].concat(
      state.tableRows.map((r) => head.map((h) => JSON.stringify(r[h] == null ? "" : r[h])).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trading_" + state.start + "_to_" + state.end + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- investment ----------
  function renderInvestment() {
    let daily = Metrics.filterByDateRange(MOCK_INVESTMENT.daily, state.start, state.end);
    if (!daily.length) daily = MOCK_INVESTMENT.daily;
    const last = daily[daily.length - 1];
    const alpha = last.total.percentage - last.nifty.percentage;

    byId("kpi-investment").innerHTML = [
      kpi("Total P&L", Format.signedINR(last.total.profit), tone(last.total.profit)),
      kpi("Total return", Format.formatPct(last.total.percentage), tone(last.total.percentage)),
      kpi("Today Δ", Format.formatPct(last.total.dailyChange), tone(last.total.dailyChange)),
      kpi("Alpha vs Nifty", Format.formatPct(alpha), tone(alpha), "Nifty " + Format.formatPct(last.nifty.percentage)),
      kpi("Indian", Format.signedINR(last.indian.profit), tone(last.indian.profit), Format.formatPct(last.indian.percentage)),
      kpi("US / Satellite", Format.signedINR(last.us.profit + last.satellite.profit), tone(last.us.profit + last.satellite.profit), Format.formatPct(last.us.percentage) + " / " + Format.formatPct(last.satellite.percentage)),
    ].join("");

    mountChart("chart-portfolio", () => InvestmentCharts.buildPortfolioVsBenchmarkOption(daily, { dark: state.dark }));
    mountChart("chart-alloc", () => InvestmentCharts.buildAllocationOption(daily, { dark: state.dark }));
    mountChart("chart-returncmp", () => InvestmentCharts.buildReturnCompareOption(daily, { dark: state.dark }));
    mountChart("chart-dailychg", () => InvestmentCharts.buildDailyChangeHistOption(daily, { dark: state.dark }));
    renderHoldings();
  }

  const HOLDING_BROKERS = { shoonya_1: "Shoonya #1", shoonya_2: "Shoonya #2", angelone: "Angel One", fyers: "Fyers", kite: "Kite" };
  function renderHoldings() {
    const groups = {};
    MOCK_INVESTMENT.holdings.forEach((x) => (groups[x.broker] = groups[x.broker] || []).push(x));
    let rows = "";
    let gInv = 0,
      gCur = 0;
    Object.keys(groups).forEach((bk) => {
      let sInv = 0,
        sCur = 0;
      rows += '<tr class="grp"><td colspan="8">' + (HOLDING_BROKERS[bk] || bk) + "</td></tr>";
      groups[bk].forEach((x) => {
        sInv += x.invested;
        sCur += x.currentValue;
        rows +=
          "<tr><td>" + x.symbol + '</td><td class="num">' + x.qty + '</td><td class="num">' + Format.formatINR(x.avgCost) +
          '</td><td class="num">' + Format.formatINR(x.ltp) + '</td><td class="num">' + Format.formatINR(x.invested, { compact: true }) +
          '</td><td class="num">' + Format.formatINR(x.currentValue, { compact: true }) +
          '</td><td class="num ' + tone(x.unrealizedPnl) + '">' + Format.signedINR(x.unrealizedPnl) +
          '</td><td class="num ' + tone(x.dayChangePct) + '">' + Format.formatPct(x.dayChangePct) + "</td></tr>";
      });
      rows +=
        '<tr class="subtot"><td>Subtotal</td><td></td><td></td><td></td><td class="num">' + Format.formatINR(sInv, { compact: true }) +
        '</td><td class="num">' + Format.formatINR(sCur, { compact: true }) +
        '</td><td class="num ' + tone(sCur - sInv) + '">' + Format.signedINR(sCur - sInv) + "</td><td></td></tr>";
      gInv += sInv;
      gCur += sCur;
    });
    const thead = '<tr><th>Symbol</th><th class="num">Qty</th><th class="num">Avg</th><th class="num">LTP</th><th class="num">Invested</th><th class="num">Value</th><th class="num">Unreal. P&L</th><th class="num">Day</th></tr>';
    const tfoot =
      '<tr class="grandtot"><td>Total</td><td></td><td></td><td></td><td class="num">' + Format.formatINR(gInv, { compact: true }) +
      '</td><td class="num">' + Format.formatINR(gCur, { compact: true }) +
      '</td><td class="num ' + tone(gCur - gInv) + '">' + Format.signedINR(gCur - gInv) + "</td><td></td></tr>";
    byId("table-holdings").innerHTML = '<table class="data-table holdings"><thead>' + thead + "</thead><tbody>" + rows + tfoot + "</tbody></table>";
  }

  // ---------- charts lifecycle ----------
  function mountChart(id, optionFn) {
    const el = byId(id);
    if (!el) return;
    if (!hasECharts) {
      el.innerHTML = '<div class="chart-fallback">Charts need the ECharts CDN — you appear to be offline.</div>';
      return;
    }
    let inst = state.charts[id];
    if (!inst || (inst.isDisposed && inst.isDisposed())) {
      inst = echarts.init(el);
      state.charts[id] = inst;
    }
    inst.setOption(optionFn(), true);
  }
  function resizeCharts() {
    Object.keys(state.charts).forEach((id) => {
      const el = byId(id);
      const inst = state.charts[id];
      if (inst && el && el.offsetParent !== null) inst.resize();
    });
  }

  // ---------- filters / theme ----------
  function applyPreset(p) {
    const all = MOCK_TRADING.daily.map((d) => d.date);
    const min = all[0],
      max = all[all.length - 1];
    if (p === "all") {
      state.start = min;
      state.end = max;
    } else if (p === "fy") {
      state.start = Metrics.fyStartYear(max) + "-04-01";
      state.end = max;
    } else if (p === "ytd") {
      state.start = Format.toDate(max).getUTCFullYear() + "-01-01";
      state.end = max;
    }
    if (Format.toDate(state.start).getTime() < Format.toDate(min).getTime()) state.start = min;
    byId("f-start").value = state.start;
    byId("f-end").value = state.end;
    markPreset(p);
    render();
  }
  function markPreset(p) {
    document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b.dataset.preset === p));
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.dark ? "dark" : "light");
    const t = byId("theme-toggle");
    if (t) t.textContent = state.dark ? "☀" : "☾";
  }
  function toggleTheme() {
    state.dark = !state.dark;
    localStorage.setItem("ta_dash_theme", state.dark ? "dark" : "light");
    applyTheme();
    render();
  }

  // ---------- helpers ----------
  function byId(id) {
    return document.getElementById(id);
  }
  function tone(v) {
    return v > 0 ? "pos" : v < 0 ? "neg" : "";
  }
  function kpi(label, value, t, sub) {
    return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value ' + (t || "") + '">' + value + "</div>" + (sub ? '<div class="kpi-sub">' + sub + "</div>" : "") + "</div>";
  }
  function chip(label, value, t, sub) {
    return '<div class="chip"><span class="chip-label">' + label + '</span><span class="chip-value ' + (t || "") + '">' + value + "</span>" + (sub ? '<span class="chip-sub">' + sub + "</span>" : "") + "</div>";
  }
  function debounce(fn, ms) {
    let h;
    return function () {
      clearTimeout(h);
      h = setTimeout(fn, ms);
    };
  }
  function showOfflineBanner() {
    const b = byId("offline-banner");
    if (b) b.style.display = "block";
  }
})();
