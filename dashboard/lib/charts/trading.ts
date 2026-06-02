// Trading-view ECharts option builders (pure data -> option). Ported from
// dashboard/charts/trading.js. Each function returns an EChartsOption-compatible object.
import { ChartKit, BROKER_NAMES, axisTooltip, echarts } from "../chartkit";
import { compact, formatDate, formatPct, monthLabel, signedINR } from "../format";
import { dayOfWeekAgg } from "../metrics";
import type { BrokerRecord, MonthlyBucket, TradingDay } from "@/types";

export { BROKER_NAMES };

export type ChartOpts = { dark?: boolean };

export function buildEquityOption(daily: TradingDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const x = daily.map((r) => formatDate(r.date));
  const y = daily.map((r) => r.overall);
  const base = ChartKit.base(dark);
  base.grid.bottom = 54;
  return Object.assign({}, base, {
    tooltip: Object.assign({}, base.tooltip, {
      formatter: (p: any) =>
        x[p[0].dataIndex] + "<br/>Cumulative: <b>" + signedINR(y[p[0].dataIndex]) + "</b>",
    }),
    xAxis: ChartKit.catAxis(dark, x),
    yAxis: ChartKit.valAxis(dark, "", (v: number) => compact(v)),
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

export function buildDrawdownOption(daily: TradingDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const x = daily.map((r) => formatDate(r.date));
  const y = daily.map((r) => r.drawdown);
  const mddIdx = y.reduce((a, v, i) => (v < y[a] ? i : a), 0);
  const base = ChartKit.base(dark);
  return Object.assign({}, base, {
    tooltip: Object.assign({}, base.tooltip, {
      formatter: (p: any) =>
        x[p[0].dataIndex] + "<br/>Drawdown: <b>" + signedINR(y[p[0].dataIndex]) + "</b>",
    }),
    xAxis: ChartKit.catAxis(dark, x),
    yAxis: ChartKit.valAxis(dark, "", (v: number) => compact(v)),
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
              value: compact(y[mddIdx]),
              itemStyle: { color: ChartKit.palette.down },
            },
          ],
          label: { fontSize: 10 },
        },
      },
    ],
  });
}

export function buildDailyPnlOption(daily: TradingDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const x = daily.map((r) => formatDate(r.date));
  const bars = daily.map((r) => ({
    value: r.profit,
    itemStyle: { color: r.profit >= 0 ? ChartKit.palette.up : ChartKit.palette.down },
  }));
  const avg = daily.map((r) => r.avgProfit50);
  const base = ChartKit.base(dark);
  return Object.assign({}, base, {
    legend: ChartKit.legend(dark, ["Daily P&L", "50-day avg"]),
    tooltip: Object.assign({}, base.tooltip, { formatter: (p: any) => axisTooltip(p) }),
    xAxis: ChartKit.catAxis(dark, x),
    yAxis: ChartKit.valAxis(dark, "", (v: number) => compact(v)),
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

export function buildBrokerSplitOption(brokers: BrokerRecord[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const agg: Record<string, { net: number; charges: number }> = {};
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
    tooltip: Object.assign({}, base.tooltip, { formatter: (p: any) => axisTooltip(p) }),
    xAxis: ChartKit.catAxis(dark, cats),
    yAxis: ChartKit.valAxis(dark, "", (v: number) => compact(v)),
    series: [
      {
        name: "Net P&L",
        type: "bar",
        data: keys.map((k) => ({
          value: Math.round(agg[k].net),
          itemStyle: { color: agg[k].net >= 0 ? ChartKit.palette.up : ChartKit.palette.down },
        })),
      },
      {
        name: "Charges",
        type: "bar",
        data: keys.map((k) => Math.round(agg[k].charges)),
        itemStyle: { color: ChartKit.palette.slate },
      },
    ],
  });
}

export function buildMonthlyOption(monthly: MonthlyBucket[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const x = monthly.map((m) => monthLabel(m.month));
  const bars = monthly.map((m) => ({
    value: m.tradingGain,
    itemStyle: { color: m.tradingGain >= 0 ? ChartKit.palette.up : ChartKit.palette.down },
  }));
  const base = ChartKit.base(dark);
  return Object.assign({}, base, {
    legend: ChartKit.legend(dark, ["Monthly Gain", "3-mo avg %"]),
    tooltip: Object.assign({}, base.tooltip, {
      formatter: (p: any) => {
        const i = p[0].dataIndex;
        let s =
          x[i] +
          "<br/>Gain: <b>" +
          signedINR(monthly[i].tradingGain) +
          "</b> (" +
          formatPct(monthly[i].gainPct) +
          ")";
        if (monthly[i].gainAvg3m != null)
          s += "<br/>3-mo avg: <b>" + formatPct(monthly[i].gainAvg3m) + "</b>";
        return s;
      },
    }),
    xAxis: ChartKit.catAxis(dark, x),
    yAxis: [
      ChartKit.valAxis(dark, "₹", (v: number) => compact(v)),
      Object.assign(ChartKit.valAxis(dark, "%", (v: number) => v + "%"), {
        position: "right",
        splitLine: { show: false },
      }),
    ],
    series: [
      {
        name: "Monthly Gain",
        type: "bar",
        data: bars,
        label: {
          show: true,
          position: "top",
          color: ChartKit.subtext(dark),
          fontSize: 10,
          formatter: (p: any) => formatPct(monthly[p.dataIndex].gainPct, 1),
        },
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

export function buildChargeEffOption(daily: TradingDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const x = daily.map((r) => formatDate(r.date));
  const base = ChartKit.base(dark);
  return Object.assign({}, base, {
    legend: ChartKit.legend(dark, ["Charge/Profit %", "100-day avg charge"]),
    tooltip: Object.assign({}, base.tooltip, {}),
    xAxis: ChartKit.catAxis(dark, x),
    yAxis: [
      ChartKit.valAxis(dark, "%", (v: number) => v + "%"),
      Object.assign(ChartKit.valAxis(dark, "₹", (v: number) => compact(v)), {
        position: "right",
        splitLine: { show: false },
      }),
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

export function buildCalendarHeatmapOption(daily: TradingDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
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
      formatter: (p: any) =>
        formatDate(p.value[0]) + "<br/>P&L: <b>" + signedINR(p.value[1]) + "</b>",
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
      formatter: (v: number) => compact(v),
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
    series: [{ type: "heatmap", coordinateSystem: "calendar", data }],
  };
}

export function buildDayOfWeekOption(daily: TradingDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const agg = dayOfWeekAgg(daily);
  const base = ChartKit.base(dark);
  return Object.assign({}, base, {
    tooltip: {
      trigger: "axis",
      backgroundColor: dark ? "#1e293b" : "#fff",
      borderColor: ChartKit.split(dark),
      borderWidth: 1,
      textStyle: { color: ChartKit.text(dark) },
      formatter: (p: any) =>
        p[0].axisValueLabel + "<br/>Avg: <b>" + signedINR(p[0].value) + "</b>",
    },
    xAxis: ChartKit.catAxis(
      dark,
      agg.map((a) => a.day.slice(0, 3))
    ),
    yAxis: ChartKit.valAxis(dark, "", (v: number) => compact(v)),
    series: [
      {
        type: "bar",
        data: agg.map((a) => ({
          value: Math.round(a.avg),
          itemStyle: { color: a.avg >= 0 ? ChartKit.palette.up : ChartKit.palette.down },
        })),
      },
    ],
  });
}
