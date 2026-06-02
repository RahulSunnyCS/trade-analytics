"use client";
import { useEffect, useMemo, useState } from "react";
import type { BrokerRecord, KpiCard, TradingDataSource } from "@/types";
import { Chart } from "./Chart";
import { FilterBar, type FilterValue, type Preset } from "./FilterBar";
import { KpiGrid } from "./KpiGrid";
import { StatStrip, type StatChip } from "./StatStrip";
import { TradingTable, buildTradingTable, tableToCsv } from "./TradingTable";
import { useTheme } from "./ThemeProvider";
import {
  bestWorst,
  filterByDateRange,
  fyLabel,
  fyStartYear,
  inFY,
  maxDrawdown,
  mean,
  monthKeyOf,
  sharpeProxy,
  streaks,
  sum,
  winRate,
} from "@/lib/metrics";
import { formatDate, formatINR, signedINR } from "@/lib/format";
import { buildTradingModel } from "@/lib/trading-model";
import {
  buildBrokerSplitOption,
  buildCalendarHeatmapOption,
  buildChargeEffOption,
  buildDailyPnlOption,
  buildDayOfWeekOption,
  buildDrawdownOption,
  buildEquityOption,
  buildMonthlyOption,
} from "@/lib/charts/trading";

const CAPITAL = 1200000;

type Props = {
  initialRecords: BrokerRecord[];
  source: TradingDataSource;
};

function tone(v: number | null | undefined): "" | "pos" | "neg" {
  if (v == null) return "";
  return v > 0 ? "pos" : v < 0 ? "neg" : "";
}

const BROKER_OPTS = [
  { value: "all", label: "All brokers" },
  { value: "finvasia", label: "Finvasia (Shoonya)" },
  { value: "angelone", label: "Angel One" },
  { value: "fyers", label: "Fyers" },
  { value: "kite", label: "Kite" },
];

export function TradingView({ initialRecords, source }: Props) {
  const { dark } = useTheme();

  const dateRange = useMemo(() => {
    const dates = Array.from(new Set(initialRecords.map((r) => r.date))).sort();
    return { min: dates[0] || "", max: dates[dates.length - 1] || "" };
  }, [initialRecords]);

  const [filter, setFilter] = useState<FilterValue>({
    start: dateRange.min,
    end: dateRange.max,
    broker: "all",
  });
  const [preset, setPreset] = useState<Preset>("all");

  // If initialRecords change, reset filter bounds.
  useEffect(() => {
    setFilter((f) => ({ ...f, start: dateRange.min, end: dateRange.max }));
    setPreset("all");
  }, [dateRange.min, dateRange.max]);

  const model = useMemo(() => {
    let brokers = filterByDateRange(initialRecords, filter.start, filter.end);
    if (filter.broker !== "all") brokers = brokers.filter((b) => b.broker === filter.broker);
    return buildTradingModel(brokers, CAPITAL);
  }, [initialRecords, filter.start, filter.end, filter.broker]);

  const daily = model.daily;
  const profits = daily.map((d) => d.profit);
  const last = daily[daily.length - 1];

  const kpis: KpiCard[] = useMemo(() => {
    const totProfit = sum(profits);
    const lastDate = last?.date;
    const mtd = lastDate
      ? sum(daily.filter((d) => monthKeyOf(d.date) === monthKeyOf(lastDate)).map((d) => d.profit))
      : 0;
    const fyStart = lastDate ? fyStartYear(lastDate) : null;
    const fy =
      lastDate && fyStart != null
        ? sum(daily.filter((d) => inFY(d.date, fyStart)).map((d) => d.profit))
        : 0;
    const mdd = maxDrawdown(daily.map((d) => d.overall)).mdd;
    const wr = winRate(profits);
    return [
      {
        label: "Net P&L (range)",
        value: signedINR(totProfit),
        tone: tone(totProfit),
        sub: daily.length + " trading days",
      },
      {
        label: "Last day",
        value: signedINR(last?.profit || 0),
        tone: tone(last?.profit || 0),
        sub: lastDate ? formatDate(lastDate) : "",
      },
      { label: "MTD", value: signedINR(mtd), tone: tone(mtd) },
      {
        label: fyStart != null ? fyLabel(fyStart) : "FY",
        value: signedINR(fy),
        tone: tone(fy),
      },
      { label: "Max drawdown", value: signedINR(mdd), tone: "neg" },
      {
        label: "Win rate",
        value: wr.rate.toFixed(1) + "%",
        tone: wr.rate >= 50 ? "pos" : "neg",
        sub: `${wr.wins}W / ${wr.losses}L`,
      },
    ];
  }, [daily, profits, last]);

  const chips: StatChip[] = useMemo(() => {
    const totProfit = sum(profits);
    const totCharges = sum(daily.map((d) => d.charges));
    const avgDay = mean(profits);
    const bw = bestWorst(daily, "profit");
    const stk = streaks(profits);
    const cpr = totProfit > 0 ? (totCharges * 100) / totProfit : null;
    const sharpe = sharpeProxy(profits, CAPITAL);
    return [
      { label: "Avg / day", value: signedINR(Math.round(avgDay)), tone: tone(avgDay) },
      {
        label: "Best day",
        value: signedINR(bw.best ? bw.best.profit : 0),
        tone: "pos",
        sub: bw.best ? formatDate(bw.best.date) : "",
      },
      {
        label: "Worst day",
        value: signedINR(bw.worst ? bw.worst.profit : 0),
        tone: "neg",
        sub: bw.worst ? formatDate(bw.worst.date) : "",
      },
      {
        label: "Current streak",
        value:
          stk.current > 0
            ? stk.current + "W"
            : stk.current < 0
              ? Math.abs(stk.current) + "L"
              : "—",
        tone: tone(stk.current),
        sub: `max ${stk.longestWin}W / ${stk.longestLoss}L`,
      },
      { label: "Charge / profit", value: cpr == null ? "—" : cpr.toFixed(1) + "%", tone: "" },
      {
        label: "Sharpe*",
        value: sharpe.toFixed(2),
        tone: tone(sharpe),
        sub: "daily-return proxy",
      },
      { label: "Capital", value: formatINR(CAPITAL, { compact: true }), tone: "" },
    ];
  }, [profits, daily]);

  const opts = useMemo(
    () => ({
      equity: buildEquityOption(daily, { dark }),
      drawdown: buildDrawdownOption(daily, { dark }),
      dailypnl: buildDailyPnlOption(daily, { dark }),
      broker: buildBrokerSplitOption(model.brokers, { dark }),
      monthly: buildMonthlyOption(model.monthly, { dark }),
      chargeeff: buildChargeEffOption(daily, { dark }),
      dow: buildDayOfWeekOption(daily, { dark }),
      calendar: buildCalendarHeatmapOption(daily, { dark }),
    }),
    [daily, model.brokers, model.monthly, dark]
  );

  function onCsv() {
    const { head, rows } = buildTradingTable(daily, model.brokers);
    const csv = tableToCsv(head, rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trading_${filter.start}_to_${filter.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="view-trading">
      {source === "mock" ? (
        <div className="source-banner">
          Showing mock data — set <code>GOOGLE_CREDENTIALS</code>, <code>GOOGLE_SHEET_ID</code>,
          <code> SHEET_NAME</code>, and <code>BROKER_ACCOUNTS_JSON</code> to use the live Sheet.
        </div>
      ) : null}
      <FilterBar
        dates={dateRange}
        value={filter}
        preset={preset}
        onChange={(next, p) => {
          setFilter(next);
          setPreset(p);
        }}
        showBroker
        brokers={BROKER_OPTS}
        onCsv={onCsv}
      />
      <KpiGrid items={kpis} />
      <StatStrip items={chips} />

      <div className="grid">
        <div className="panel span-8">
          <div className="panel-title">
            Cumulative equity curve <span className="sub">running P&amp;L</span>
          </div>
          <Chart option={opts.equity} height={330} className="tall" />
        </div>
        <div className="panel span-4">
          <div className="panel-title">
            Drawdown <span className="sub">underwater</span>
          </div>
          <Chart option={opts.drawdown} height={330} className="tall" />
        </div>

        <div className="panel span-8">
          <div className="panel-title">
            Daily P&amp;L <span className="sub">+ 50-day avg</span>
          </div>
          <Chart option={opts.dailypnl} />
        </div>
        <div className="panel span-4">
          <div className="panel-title">
            Per-broker split <span className="sub">net &amp; charges</span>
          </div>
          <Chart option={opts.broker} />
        </div>

        <div className="panel span-6">
          <div className="panel-title">
            Monthly returns <span className="sub">gain &amp; 3-mo avg</span>
          </div>
          <Chart option={opts.monthly} />
        </div>
        <div className="panel span-6">
          <div className="panel-title">
            Charge efficiency <span className="sub">cost drag</span>
          </div>
          <Chart option={opts.chargeeff} />
        </div>

        <div className="panel span-4">
          <div className="panel-title">
            Day-of-week <span className="sub">avg P&amp;L</span>
          </div>
          <Chart option={opts.dow} height={250} className="short" />
        </div>
        <div className="panel span-8">
          <div className="panel-title">Daily P&amp;L calendar</div>
          <Chart option={opts.calendar} height={230} className="calendar" />
        </div>

        <div className="panel span-12">
          <div className="panel-title">Daily detail</div>
          <TradingTable daily={daily} brokers={model.brokers} />
        </div>
      </div>
    </section>
  );
}
