// Trading-view ECharts option builders. Each build* fn is PURE (data -> option) and is the
// migration unit: in the Next.js round it lifts verbatim into lib/charts/trading.ts and is
// rendered by <ReactECharts option={...} />. Also defines the shared ChartKit theme helper.
(function (global) {
  "use strict";

  const ChartKit = {
    palette: {
      up: "#16a34a",
      down: "#dc2626",
      primary: "#2563eb",
      amber: "#f59e0b",
      teal: "#10b981",
      purple: "#a855f7",
      slate: "#64748b",
    },
    series4: ["#2563eb", "#f59e0b", "#10b981", "#a855f7"],
    text(dark) {
      return dark ? "#cbd5e1" : "#334155";
    },
    subtext(dark) {
      return dark ? "#94a3b8" : "#64748b";
    },
    split(dark) {
      return dark ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.14)";
    },
    axisLine(dark) {
      return dark ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.3)";
    },
    base(dark) {
      return {
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, system-ui, Arial, sans-serif", color: ChartKit.text(dark) },
        grid: { left: 8, right: 16, top: 34, bottom: 24, containLabel: true },
        tooltip: {
          trigger: "axis",
          backgroundColor: dark ? "#1e293b" : "#ffffff",
          borderColor: ChartKit.split(dark),
          borderWidth: 1,
          textStyle: { color: ChartKit.text(dark), fontSize: 12 },
        },
      };
    },
    catAxis(dark, data) {
      return {
        type: "category",
        data: data,
        boundaryGap: true,
        axisLine: { lineStyle: { color: ChartKit.axisLine(dark) } },
        axisTick: { show: false },
        axisLabel: { color: ChartKit.subtext(dark), hideOverlap: true },
      };
    },
    valAxis(dark, name, fmt) {
      return {
        type: "value",
        name: name || "",
        nameTextStyle: { color: ChartKit.subtext(dark) },
        splitLine: { lineStyle: { color: ChartKit.split(dark) } },
        axisLabel: { color: ChartKit.subtext(dark), formatter: fmt },
      };
    },
    legend(dark, data) {
      return { data: data, top: 2, right: 8, textStyle: { color: ChartKit.subtext(dark) }, icon: "roundRect", itemWidth: 10, itemHeight: 10 };
    },
  };

  const BROKER_NAMES = { finvasia: "Finvasia (Shoonya)", angelone: "Angel One", fyers: "Fyers", kite: "Kite" };

  function axisTooltip(p, label) {
    let s = label != null ? label : p[0].axisValueLabel;
    p.forEach((it) => {
      if (it.value == null) return;
      s += "<br/>" + it.marker + " " + it.seriesName + ": <b>" + Format.signedINR(it.value) + "</b>";
    });
    return s;
  }

  function buildEquityOption(daily, opts) {
    const dark = !!(opts && opts.dark);
    const x = daily.map((r) => Format.formatDate(r.date));
    const y = daily.map((r) => r.overall);
    const base = ChartKit.base(dark);
    base.grid.bottom = 54;
    return Object.assign({}, base, {
      tooltip: Object.assign({}, base.tooltip, {
        formatter: (p) => x[p[0].dataIndex] + "<br/>Cumulative: <b>" + Format.signedINR(y[p[0].dataIndex]) + "</b>",
      }),
      xAxis: ChartKit.catAxis(dark, x),
      yAxis: ChartKit.valAxis(dark, "", (v) => Format.compact(v)),
      dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 14 }],
      series: [
        {
          name: "Cumulative P&L",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: y,
          lineStyle: { width: 2, color: ChartKit.palette.primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(37,99,235,0.35)" },
              { offset: 1, color: "rgba(37,99,235,0.02)" },
            ]),
          },
        },
      ],
    });
  }

  function buildDrawdownOption(daily, opts) {
    const dark = !!(opts && opts.dark);
    const x = daily.map((r) => Format.formatDate(r.date));
    const y = daily.map((r) => r.drawdown);
    const mddIdx = y.reduce((a, v, i) => (v < y[a] ? i : a), 0);
    const base = ChartKit.base(dark);
    return Object.assign({}, base, {
      tooltip: Object.assign({}, base.tooltip, {
        formatter: (p) => x[p[0].dataIndex] + "<br/>Drawdown: <b>" + Format.signedINR(y[p[0].dataIndex]) + "</b>",
      }),
      xAxis: ChartKit.catAxis(dark, x),
      yAxis: ChartKit.valAxis(dark, "", (v) => Format.compact(v)),
      series: [
        {
          type: "line",
          data: y,
          showSymbol: false,
          lineStyle: { color: ChartKit.palette.down, width: 1 },
          areaStyle: { color: "rgba(220,38,38,0.22)" },
          markPoint: {
            symbolSize: 50,
            data: [
              {
                name: "Max DD",
                coord: [x[mddIdx], y[mddIdx]],
                value: Format.compact(y[mddIdx]),
                itemStyle: { color: ChartKit.palette.down },
              },
            ],
            label: { fontSize: 10 },
          },
        },
      ],
    });
  }

  function buildDailyPnlOption(daily, opts) {
    const dark = !!(opts && opts.dark);
    const x = daily.map((r) => Format.formatDate(r.date));
    const bars = daily.map((r) => ({
      value: r.profit,
      itemStyle: { color: r.profit >= 0 ? ChartKit.palette.up : ChartKit.palette.down },
    }));
    const avg = daily.map((r) => r.avgProfit50);
    const base = ChartKit.base(dark);
    return Object.assign({}, base, {
      legend: ChartKit.legend(dark, ["Daily P&L", "50-day avg"]),
      tooltip: Object.assign({}, base.tooltip, { formatter: (p) => axisTooltip(p) }),
      xAxis: ChartKit.catAxis(dark, x),
      yAxis: ChartKit.valAxis(dark, "", (v) => Format.compact(v)),
      dataZoom: [{ type: "inside" }],
      series: [
        { name: "Daily P&L", type: "bar", data: bars },
        {
          name: "50-day avg",
          type: "line",
          data: avg,
          smooth: true,
          showSymbol: false,
          connectNulls: true,
          lineStyle: { color: ChartKit.palette.amber, width: 2 },
        },
      ],
    });
  }

  function buildBrokerSplitOption(brokers, opts) {
    const dark = !!(opts && opts.dark);
    const agg = {};
    brokers.forEach((b) => {
      const g = (agg[b.broker] = agg[b.broker] || { net: 0, charges: 0 });
      g.net += b.final_net;
      g.charges += b.total_charges;
    });
    const keys = Object.keys(agg);
    const cats = keys.map((k) => BROKER_NAMES[k] || k);
    const base = ChartKit.base(dark);
    return Object.assign({}, base, {
      legend: ChartKit.legend(dark, ["Net P&L", "Charges"]),
      tooltip: Object.assign({}, base.tooltip, { formatter: (p) => axisTooltip(p) }),
      xAxis: ChartKit.catAxis(dark, cats),
      yAxis: ChartKit.valAxis(dark, "", (v) => Format.compact(v)),
      series: [
        {
          name: "Net P&L",
          type: "bar",
          data: keys.map((k) => ({
            value: Math.round(agg[k].net),
            itemStyle: { color: agg[k].net >= 0 ? ChartKit.palette.up : ChartKit.palette.down },
          })),
        },
        { name: "Charges", type: "bar", data: keys.map((k) => Math.round(agg[k].charges)), itemStyle: { color: ChartKit.palette.slate } },
      ],
    });
  }

  function buildMonthlyOption(monthly, opts) {
    const dark = !!(opts && opts.dark);
    const x = monthly.map((m) => Format.monthLabel(m.month));
    const bars = monthly.map((m) => ({
      value: m.tradingGain,
      itemStyle: { color: m.tradingGain >= 0 ? ChartKit.palette.up : ChartKit.palette.down },
    }));
    const base = ChartKit.base(dark);
    return Object.assign({}, base, {
      legend: ChartKit.legend(dark, ["Monthly Gain", "3-mo avg %"]),
      tooltip: Object.assign({}, base.tooltip, {
        formatter: (p) => {
          const i = p[0].dataIndex;
          let s = x[i] + "<br/>Gain: <b>" + Format.signedINR(monthly[i].tradingGain) + "</b> (" + Format.formatPct(monthly[i].gainPct) + ")";
          if (monthly[i].gainAvg3m != null) s += "<br/>3-mo avg: <b>" + Format.formatPct(monthly[i].gainAvg3m) + "</b>";
          return s;
        },
      }),
      xAxis: ChartKit.catAxis(dark, x),
      yAxis: [
        ChartKit.valAxis(dark, "₹", (v) => Format.compact(v)),
        Object.assign(ChartKit.valAxis(dark, "%", (v) => v + "%"), { position: "right", splitLine: { show: false } }),
      ],
      series: [
        {
          name: "Monthly Gain",
          type: "bar",
          data: bars,
          label: { show: true, position: "top", color: ChartKit.subtext(dark), fontSize: 10, formatter: (p) => Format.formatPct(monthly[p.dataIndex].gainPct, 1) },
        },
        {
          name: "3-mo avg %",
          type: "line",
          yAxisIndex: 1,
          data: monthly.map((m) => m.gainAvg3m),
          smooth: true,
          connectNulls: true,
          showSymbol: false,
          lineStyle: { color: ChartKit.palette.purple, width: 2 },
        },
      ],
    });
  }

  function buildChargeEffOption(daily, opts) {
    const dark = !!(opts && opts.dark);
    const x = daily.map((r) => Format.formatDate(r.date));
    const base = ChartKit.base(dark);
    return Object.assign({}, base, {
      legend: ChartKit.legend(dark, ["Charge/Profit %", "100-day avg charge"]),
      tooltip: Object.assign({}, base.tooltip, {}),
      xAxis: ChartKit.catAxis(dark, x),
      yAxis: [
        ChartKit.valAxis(dark, "%", (v) => v + "%"),
        Object.assign(ChartKit.valAxis(dark, "₹", (v) => Format.compact(v)), { position: "right", splitLine: { show: false } }),
      ],
      dataZoom: [{ type: "inside" }],
      series: [
        {
          name: "Charge/Profit %",
          type: "line",
          data: daily.map((r) => r.chargeProfitRatio),
          smooth: true,
          connectNulls: true,
          showSymbol: false,
          lineStyle: { color: ChartKit.palette.amber, width: 2 },
        },
        {
          name: "100-day avg charge",
          type: "line",
          yAxisIndex: 1,
          data: daily.map((r) => r.avgCharge100),
          smooth: true,
          connectNulls: true,
          showSymbol: false,
          lineStyle: { color: ChartKit.palette.slate, width: 1.5 },
        },
      ],
    });
  }

  function buildCalendarHeatmapOption(daily, opts) {
    const dark = !!(opts && opts.dark);
    if (!daily.length) return { series: [] };
    const data = daily.map((r) => [r.date, r.profit]);
    const M = Math.max(1, ...daily.map((r) => Math.abs(r.profit)));
    return {
      backgroundColor: "transparent",
      textStyle: { fontFamily: "Inter, system-ui, Arial, sans-serif", color: ChartKit.text(dark) },
      tooltip: {
        backgroundColor: dark ? "#1e293b" : "#fff",
        borderColor: ChartKit.split(dark),
        borderWidth: 1,
        textStyle: { color: ChartKit.text(dark) },
        formatter: (p) => Format.formatDate(p.value[0]) + "<br/>P&L: <b>" + Format.signedINR(p.value[1]) + "</b>",
      },
      visualMap: {
        min: -M,
        max: M,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 4,
        itemHeight: 80,
        inRange: { color: ["#dc2626", dark ? "#334155" : "#eef2f7", "#16a34a"] },
        textStyle: { color: ChartKit.subtext(dark) },
        formatter: (v) => Format.compact(v),
      },
      calendar: {
        top: 24,
        left: 36,
        right: 16,
        cellSize: ["auto", 15],
        range: [daily[0].date, daily[daily.length - 1].date],
        itemStyle: { color: "transparent", borderColor: ChartKit.split(dark), borderWidth: 1 },
        splitLine: { lineStyle: { color: ChartKit.axisLine(dark) } },
        dayLabel: { color: ChartKit.subtext(dark), nameMap: "en" },
        monthLabel: { color: ChartKit.subtext(dark), nameMap: "en" },
        yearLabel: { show: false },
      },
      series: [{ type: "heatmap", coordinateSystem: "calendar", data: data }],
    };
  }

  global.ChartKit = ChartKit;
  global.TradingCharts = {
    BROKER_NAMES,
    buildEquityOption,
    buildDrawdownOption,
    buildDailyPnlOption,
    buildBrokerSplitOption,
    buildMonthlyOption,
    buildChargeEffOption,
    buildCalendarHeatmapOption,
  };
})(window);
