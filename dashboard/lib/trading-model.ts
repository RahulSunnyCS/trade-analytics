// Pure trading model: aggregates per-account broker records into daily/monthly series.
// Ported from dashboard/data/mock-trading.js (TradingModel.build).
import { toDate } from "./format";
import { cumulative, drawdownSeries, monthKeyOf, rollingMean } from "./metrics";
import type { BrokerRecord, MonthlyBucket, TradingDay, TradingModelResult } from "@/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayAccumulator = {
  date: string;
  profit: number;
  charges: number;
  algos: number;
  algoCharges: number;
};

export function buildTradingModel(
  brokerRecords: BrokerRecord[],
  capital: number
): TradingModelResult {
  const byDate: Record<string, DayAccumulator> = {};
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

  const sorted = Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));

  const profits = sorted.map((r) => r.profit);
  const overall = cumulative(profits);
  const dd = drawdownSeries(overall);
  const avg50 = rollingMean(profits, 50);
  const avg100 = rollingMean(profits, 100);
  const avgChg100 = rollingMean(
    sorted.map((r) => r.charges),
    100
  );

  const daily: TradingDay[] = sorted.map((r, i) => {
    const avg100i = avg100[i];
    const avgChg100i = avgChg100[i];
    const cpr =
      avg100i != null && avgChg100i != null && avg100i > 0
        ? +((avgChg100i * 100) / avg100i).toFixed(1)
        : null;
    return {
      date: r.date,
      day: DAY_NAMES[toDate(r.date)!.getUTCDay()],
      profit: r.profit,
      charges: r.charges,
      algos: r.algos,
      algoCharges: r.algoCharges,
      capital,
      overall: Math.round(overall[i]),
      drawdown: Math.round(dd[i]),
      avgProfit50: avg50[i] == null ? null : Math.round(avg50[i]!),
      avgProfit100: avg100i == null ? null : Math.round(avg100i),
      avgCharge100: avgChg100i == null ? null : Math.round(avgChg100i),
      chargeProfitRatio: cpr,
      profitCapitalBps: +((r.profit / capital) * 10000).toFixed(1),
    };
  });

  // monthly aggregation
  const byMonth: Record<string, number> = {};
  daily.forEach((r) => {
    const k = monthKeyOf(r.date);
    byMonth[k] = (byMonth[k] || 0) + r.profit;
  });
  const monthly: MonthlyBucket[] = Object.keys(byMonth)
    .sort()
    .map((k) => ({
      month: k,
      tradingGain: Math.round(byMonth[k]),
      gainPct: +((byMonth[k] / capital) * 100).toFixed(2),
      gainAvg3m: 0,
    }));
  monthly.forEach((m, i) => {
    const slice = monthly.slice(Math.max(0, i - 2), i + 1).map((x) => x.gainPct);
    m.gainAvg3m = +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2);
  });

  return { daily, brokers: brokerRecords, monthly };
}
