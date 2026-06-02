// Investment-view ECharts option builders (pure data -> option). Ported from
// dashboard/charts/investment.js.
import { ChartKit } from "../chartkit";
import { compact, formatDate, formatINR, formatPct } from "../format";
import { mean } from "../metrics";
import type { InvestmentDay } from "@/types";

export type ChartOpts = { dark?: boolean };

const ENTITY_KEYS = ["total", "nifty", "midcap", "smallcap"] as const;

export function buildPortfolioVsBenchmarkOption(daily: InvestmentDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const x = daily.map((r) => formatDate(r.date));
  const defs: Array<[string, (typeof ENTITY_KEYS)[number]]> = [
    ["Total", "total"],
    ["Nifty", "nifty"],
    ["MidCap", "midcap"],
    ["SmallCap", "smallcap"],
  ];
  const series = defs.map(([name, key], i) => ({
    name,
    type: "line",
    smooth: true,
    showSymbol: false,
    data: daily.map((r) => r[key].percentage),
    lineStyle: { width: name === "Total" ? 2.5 : 1.5, color: ChartKit.series4[i] },
    emphasis: { focus: "series" },
  }));
  const base = ChartKit.base(dark);
  base.grid.bottom = 52;
  return Object.assign({}, base, {
    legend: ChartKit.legend(
      dark,
      defs.map((d) => d[0])
    ),
    tooltip: Object.assign({}, base.tooltip, {
      formatter: (p: any[]) => {
        let s = p[0].axisValueLabel;
        p.forEach((it) => {
          if (it.value == null) return;
          s += "<br/>" + it.marker + " " + it.seriesName + ": <b>" + formatPct(it.value) + "</b>";
        });
        return s;
      },
    }),
    xAxis: ChartKit.catAxis(dark, x),
    yAxis: ChartKit.valAxis(dark, "%", (v: number) => v + "%"),
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 12 }],
    series,
  });
}

export function buildAllocationOption(daily: InvestmentDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const last = daily[daily.length - 1];
  function value(e: { profit: number; percentage: number }) {
    const base = e.percentage ? e.profit / (e.percentage / 100) : 0;
    return Math.max(0, Math.round(base + e.profit));
  }
  const data = [
    { name: "Indian", value: value(last.indian), itemStyle: { color: ChartKit.series4[0] } },
    { name: "US", value: value(last.us), itemStyle: { color: ChartKit.series4[1] } },
    { name: "Satellite", value: value(last.satellite), itemStyle: { color: ChartKit.series4[2] } },
  ];
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, system-ui, Arial, sans-serif", color: ChartKit.text(dark) },
    tooltip: {
      trigger: "item",
      backgroundColor: dark ? "#1e293b" : "#fff",
      borderColor: ChartKit.split(dark),
      borderWidth: 1,
      textStyle: { color: ChartKit.text(dark) },
      formatter: (p: any) =>
        p.name +
        "<br/><b>" +
        formatINR(p.value, { compact: true }) +
        "</b> (" +
        p.percent +
        "%)",
    },
    legend: {
      bottom: 0,
      left: "center",
      textStyle: { color: ChartKit.subtext(dark) },
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: "pie",
        radius: ["46%", "70%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: dark ? "#0f172a" : "#fff", borderWidth: 2 },
        label: { color: ChartKit.text(dark), formatter: "{b}\n{d}%" },
        data,
      },
    ],
  };
}

export function buildReturnCompareOption(daily: InvestmentDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const last = daily[daily.length - 1];
  const cats = ["Total", "Nifty", "MidCap", "SmallCap"];
  const keys: Array<(typeof ENTITY_KEYS)[number]> = ["total", "nifty", "midcap", "smallcap"];
  const base = ChartKit.base(dark);
  return Object.assign({}, base, {
    tooltip: Object.assign({}, base.tooltip, {
      formatter: (p: any) => p[0].axisValueLabel + ": <b>" + formatPct(p[0].value) + "</b>",
    }),
    xAxis: ChartKit.catAxis(dark, cats),
    yAxis: ChartKit.valAxis(dark, "%", (v: number) => v + "%"),
    series: [
      {
        type: "bar",
        data: keys.map((k, i) => ({
          value: +last[k].percentage.toFixed(2),
          itemStyle: { color: ChartKit.series4[i] },
        })),
        label: {
          show: true,
          position: "top",
          color: ChartKit.subtext(dark),
          formatter: (p: any) => formatPct(p.value),
        },
      },
    ],
  });
}

export function buildDailyChangeHistOption(daily: InvestmentDay[], opts: ChartOpts = {}): any {
  const dark = !!opts.dark;
  const vals = daily.map((r) => r.total.dailyChange);
  const min = Math.min.apply(null, vals);
  const max = Math.max.apply(null, vals);
  const bins = 12;
  const w = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  vals.forEach((v) => {
    let idx = Math.floor((v - min) / w);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  });
  const cats = counts.map((_, i) => (min + i * w).toFixed(1) + "%");
  const m = mean(vals);
  const base = ChartKit.base(dark);
  return Object.assign({}, base, {
    tooltip: Object.assign({}, base.tooltip, {
      formatter: (p: any) => p[0].axisValueLabel + " band<br/>Days: <b>" + p[0].value + "</b>",
    }),
    xAxis: Object.assign(ChartKit.catAxis(dark, cats), {
      axisLabel: { color: ChartKit.subtext(dark), interval: 1 },
    }),
    yAxis: ChartKit.valAxis(dark, "days", (v: number) => String(v)),
    series: [
      {
        type: "bar",
        data: counts,
        itemStyle: { color: ChartKit.palette.primary },
        markLine: {
          symbol: "none",
          data: [{ xAxis: Math.round((m - min) / w) }],
          lineStyle: { color: ChartKit.palette.amber },
          label: { formatter: "mean " + formatPct(m, 2), color: ChartKit.subtext(dark) },
        },
      },
    ],
  });
}
