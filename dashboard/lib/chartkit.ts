// Shared ECharts theme helpers and broker name map.
import * as echarts from "echarts";
import { signedINR } from "./format";

export const ChartKit = {
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
  text(dark: boolean) {
    return dark ? "#cbd5e1" : "#334155";
  },
  subtext(dark: boolean) {
    return dark ? "#94a3b8" : "#64748b";
  },
  split(dark: boolean) {
    return dark ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.14)";
  },
  axisLine(dark: boolean) {
    return dark ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.3)";
  },
  base(dark: boolean): any {
    return {
      backgroundColor: "transparent",
      textStyle: {
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        color: ChartKit.text(dark),
      },
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
  catAxis(dark: boolean, data: Array<string | number>): any {
    return {
      type: "category",
      data,
      boundaryGap: true,
      axisLine: { lineStyle: { color: ChartKit.axisLine(dark) } },
      axisTick: { show: false },
      axisLabel: { color: ChartKit.subtext(dark), hideOverlap: true },
    };
  },
  valAxis(dark: boolean, name: string, fmt?: (v: number) => string): any {
    return {
      type: "value",
      name: name || "",
      nameTextStyle: { color: ChartKit.subtext(dark) },
      splitLine: { lineStyle: { color: ChartKit.split(dark) } },
      axisLabel: { color: ChartKit.subtext(dark), formatter: fmt },
    };
  },
  legend(dark: boolean, data: string[]): any {
    return {
      data,
      top: 2,
      right: 8,
      textStyle: { color: ChartKit.subtext(dark) },
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
    };
  },
};

export const BROKER_NAMES: Record<string, string> = {
  finvasia: "Finvasia (Shoonya)",
  angelone: "Angel One",
  fyers: "Fyers",
  kite: "Kite",
};

export function axisTooltip(p: any[], label?: string): string {
  let s = label != null ? label : p[0].axisValueLabel;
  p.forEach((it) => {
    if (it.value == null) return;
    s += "<br/>" + it.marker + " " + it.seriesName + ": <b>" + signedINR(it.value) + "</b>";
  });
  return s;
}

export { echarts };
