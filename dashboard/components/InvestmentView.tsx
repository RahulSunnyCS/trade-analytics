"use client";
import { useEffect, useMemo, useState } from "react";
import type { Holding, InvestmentDay, KpiCard } from "@/types";
import { Chart } from "./Chart";
import { FilterBar, type FilterValue, type Preset } from "./FilterBar";
import { HoldingsTable } from "./HoldingsTable";
import { KpiGrid } from "./KpiGrid";
import { useTheme } from "./ThemeProvider";
import { filterByDateRange } from "@/lib/metrics";
import { formatPct, signedINR } from "@/lib/format";
import {
  buildAllocationOption,
  buildDailyChangeHistOption,
  buildPortfolioVsBenchmarkOption,
  buildReturnCompareOption,
} from "@/lib/charts/investment";

type Props = {
  initialData: { daily: InvestmentDay[]; holdings: Holding[] };
};

function tone(v: number): "" | "pos" | "neg" {
  return v > 0 ? "pos" : v < 0 ? "neg" : "";
}

export function InvestmentView({ initialData }: Props) {
  const { dark } = useTheme();
  const dateRange = useMemo(() => {
    const dates = initialData.daily.map((d) => d.date);
    return { min: dates[0] || "", max: dates[dates.length - 1] || "" };
  }, [initialData.daily]);

  const [filter, setFilter] = useState<FilterValue>({
    start: dateRange.min,
    end: dateRange.max,
    broker: "all",
  });
  const [preset, setPreset] = useState<Preset>("all");

  useEffect(() => {
    setFilter((f) => ({ ...f, start: dateRange.min, end: dateRange.max }));
    setPreset("all");
  }, [dateRange.min, dateRange.max]);

  const daily = useMemo(() => {
    const d = filterByDateRange(initialData.daily, filter.start, filter.end);
    return d.length ? d : initialData.daily;
  }, [initialData.daily, filter.start, filter.end]);

  const last = daily[daily.length - 1];

  const kpis: KpiCard[] = useMemo(() => {
    if (!last) return [];
    const alpha = last.total.percentage - last.nifty.percentage;
    return [
      { label: "Total P&L", value: signedINR(last.total.profit), tone: tone(last.total.profit) },
      { label: "Total return", value: formatPct(last.total.percentage), tone: tone(last.total.percentage) },
      { label: "Today Δ", value: formatPct(last.total.dailyChange), tone: tone(last.total.dailyChange) },
      {
        label: "Alpha vs Nifty",
        value: formatPct(alpha),
        tone: tone(alpha),
        sub: "Nifty " + formatPct(last.nifty.percentage),
      },
      {
        label: "Indian",
        value: signedINR(last.indian.profit),
        tone: tone(last.indian.profit),
        sub: formatPct(last.indian.percentage),
      },
      {
        label: "US / Satellite",
        value: signedINR(last.us.profit + last.satellite.profit),
        tone: tone(last.us.profit + last.satellite.profit),
        sub: formatPct(last.us.percentage) + " / " + formatPct(last.satellite.percentage),
      },
    ];
  }, [last]);

  const opts = useMemo(
    () => ({
      portfolio: buildPortfolioVsBenchmarkOption(daily, { dark }),
      alloc: buildAllocationOption(daily, { dark }),
      returncmp: buildReturnCompareOption(daily, { dark }),
      dailychg: buildDailyChangeHistOption(daily, { dark }),
    }),
    [daily, dark]
  );

  return (
    <section id="view-investment">
      <FilterBar
        dates={dateRange}
        value={filter}
        preset={preset}
        onChange={(next, p) => {
          setFilter(next);
          setPreset(p);
        }}
      />
      <KpiGrid items={kpis} />
      <div className="grid">
        <div className="panel span-8">
          <div className="panel-title">
            Portfolio vs benchmarks <span className="sub">return %</span>
          </div>
          <Chart option={opts.portfolio} height={330} className="tall" />
        </div>
        <div className="panel span-4">
          <div className="panel-title">
            Allocation <span className="sub">by value</span>
          </div>
          <Chart option={opts.alloc} height={330} className="tall" />
        </div>

        <div className="panel span-5">
          <div className="panel-title">
            Return comparison <span className="sub">latest</span>
          </div>
          <Chart option={opts.returncmp} />
        </div>
        <div className="panel span-7">
          <div className="panel-title">
            Daily-change distribution <span className="sub">portfolio</span>
          </div>
          <Chart option={opts.dailychg} />
        </div>

        <div className="panel span-12">
          <div className="panel-title">
            Per-broker holdings
            <span className="badge mock">Mock — pending live GOOGLEFINANCE / broker API</span>
          </div>
          <HoldingsTable holdings={initialData.holdings} />
        </div>
      </div>
    </section>
  );
}
