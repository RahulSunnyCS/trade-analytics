"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { Holding, InvestmentDay, KpiCard, TradingModelResult, TradingDataSource } from "@/types";
import { Chart } from "./Chart";
import { KpiGrid } from "./KpiGrid";
import { useUser } from "./AuthGate";
import { useTheme } from "./ThemeProvider";
import {
  fyLabel,
  fyStartYear,
  inFY,
  maxDrawdown,
  sum,
  winRate,
} from "@/lib/metrics";
import { formatDate, formatPct, signedINR } from "@/lib/format";
import {
  buildDailyPnlOption,
  buildEquityOption,
} from "@/lib/charts/trading";
import {
  buildAllocationOption,
  buildPortfolioVsBenchmarkOption,
} from "@/lib/charts/investment";

type Props = {
  trading: TradingModelResult;
  investment: { daily: InvestmentDay[]; holdings: Holding[] };
  source: TradingDataSource;
};

function tone(v: number): "" | "pos" | "neg" {
  return v > 0 ? "pos" : v < 0 ? "neg" : "";
}

export function OverviewView({ trading, investment, source }: Props) {
  const user = useUser();
  const { dark } = useTheme();
  const td = trading.daily;
  const il = investment.daily[investment.daily.length - 1];

  const tradingKpis: KpiCard[] = useMemo(() => {
    if (!td.length) return [];
    const tLast = td[td.length - 1];
    const fyStart = fyStartYear(tLast.date);
    const fy = sum(td.filter((d) => inFY(d.date, fyStart)).map((d) => d.profit));
    const wr = winRate(td.map((d) => d.profit));
    const mdd = maxDrawdown(td.map((d) => d.overall)).mdd;
    return [
      { label: "Cumulative P&L", value: signedINR(tLast.overall), tone: tone(tLast.overall) },
      { label: fyLabel(fyStart), value: signedINR(fy), tone: tone(fy) },
      {
        label: "Win rate",
        value: wr.rate.toFixed(1) + "%",
        tone: wr.rate >= 50 ? "pos" : "neg",
        sub: `${wr.wins}W / ${wr.losses}L`,
      },
      { label: "Max drawdown", value: signedINR(mdd), tone: "neg" },
    ];
  }, [td]);

  const investmentKpis: KpiCard[] = useMemo(() => {
    if (!il) return [];
    const alpha = il.total.percentage - il.nifty.percentage;
    return [
      { label: "Total P&L", value: signedINR(il.total.profit), tone: tone(il.total.profit) },
      { label: "Total return", value: formatPct(il.total.percentage), tone: tone(il.total.percentage) },
      {
        label: "Alpha vs Nifty",
        value: formatPct(alpha),
        tone: tone(alpha),
        sub: "Nifty " + formatPct(il.nifty.percentage),
      },
      { label: "Today Δ", value: formatPct(il.total.dailyChange), tone: tone(il.total.dailyChange) },
    ];
  }, [il]);

  const equityOpt = useMemo(() => buildEquityOption(td, { dark }), [td, dark]);
  const dailyOpt = useMemo(() => buildDailyPnlOption(td, { dark }), [td, dark]);
  const portfolioOpt = useMemo(
    () => buildPortfolioVsBenchmarkOption(investment.daily, { dark }),
    [investment.daily, dark]
  );
  const allocOpt = useMemo(
    () => buildAllocationOption(investment.daily, { dark }),
    [investment.daily, dark]
  );

  const greetingName = user.name ? user.name.split(" ")[0] : "trader";

  return (
    <section id="view-overview">
      {source === "mock" ? (
        <div className="source-banner">
          Showing mock data — set <code>GOOGLE_CREDENTIALS</code>, <code>GOOGLE_SHEET_ID</code>,
          <code> SHEET_NAME</code>, and <code>BROKER_ACCOUNTS_JSON</code> to use the live Sheet.
        </div>
      ) : null}

      <div className="ov-hello">
        <h2>Welcome back, {greetingName}</h2>
        <span className="muted">
          {td.length ? "as of " + formatDate(td[td.length - 1].date) : null}
        </span>
      </div>

      <div className="ov-section-head">
        <h3>Trading</h3>
        <Link href="/trading" className="cta">
          View details →
        </Link>
      </div>
      <KpiGrid items={tradingKpis} variant="kpi-4" />
      <div className="grid ov-grid">
        <div className="panel span-8">
          <div className="panel-title">
            Cumulative equity curve <span className="sub">running P&amp;L</span>
          </div>
          <Chart option={equityOpt} />
        </div>
        <div className="panel span-4">
          <div className="panel-title">Daily P&amp;L</div>
          <Chart option={dailyOpt} />
        </div>
      </div>

      <div className="ov-section-head section-gap">
        <h3>Investment</h3>
        <Link href="/investment" className="cta">
          View details →
        </Link>
      </div>
      <KpiGrid items={investmentKpis} variant="kpi-4" />
      <div className="grid ov-grid">
        <div className="panel span-8">
          <div className="panel-title">
            Portfolio vs benchmarks <span className="sub">return %</span>
          </div>
          <Chart option={portfolioOpt} />
        </div>
        <div className="panel span-4">
          <div className="panel-title">
            Allocation <span className="sub">by value</span>
          </div>
          <Chart option={allocOpt} />
        </div>
      </div>
    </section>
  );
}
