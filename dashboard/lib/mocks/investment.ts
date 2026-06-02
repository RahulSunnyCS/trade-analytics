// Mock investment data — mirrors dashboard/data/mock-investment.js exactly.
// Same seed (424242), END (Date.UTC(2026,4,28)), N_DAYS (120), holdings list.
import type { Holding, InvestmentDay } from "@/types";

function rng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N_DAYS = 120;
const END = Date.UTC(2026, 4, 28);
const BASES = { indian: 2000000, us: 150000, satellite: 30000 };

function weekdaysBack(endMs: number, count: number): Date[] {
  const out: Date[] = [];
  let d = new Date(endMs);
  while (out.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(d));
    d = new Date(d.getTime() - 86400000);
  }
  return out.reverse();
}

function isoOf(d: Date): string {
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function walk(rand: () => number, start: number, drift: number, vol: number, n: number): number[] {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v += drift + (rand() - 0.5) * vol;
    out.push(v);
  }
  return out;
}

type PathKey = "indian" | "us" | "satellite" | "nifty" | "midcap" | "smallcap";

function gen(): { daily: InvestmentDay[]; holdings: Holding[] } {
  const rand = rng(424242);
  const dates = weekdaysBack(END, N_DAYS);
  const paths: Record<PathKey, number[]> = {
    indian: walk(rand, -2, 0.06, 0.9, N_DAYS),
    us: walk(rand, 1, 0.1, 1.1, N_DAYS),
    satellite: walk(rand, 0, 0.12, 1.6, N_DAYS),
    nifty: walk(rand, 0, 0.05, 0.7, N_DAYS),
    midcap: walk(rand, 0, 0.07, 1.0, N_DAYS),
    smallcap: walk(rand, 0, 0.08, 1.3, N_DAYS),
  };

  function entity(name: PathKey, base: number, i: number) {
    const pct = +paths[name][i].toFixed(2);
    const prev = i > 0 ? paths[name][i - 1] : paths[name][i];
    return {
      profit: Math.round((pct / 100) * base),
      percentage: pct,
      dailyChange: +(pct - prev).toFixed(2),
    };
  }

  const totalBase = BASES.indian + BASES.us + BASES.satellite;
  const daily: InvestmentDay[] = dates.map((d, i) => {
    const indian = entity("indian", BASES.indian, i);
    const us = entity("us", BASES.us, i);
    const satellite = entity("satellite", BASES.satellite, i);
    const totalProfit = indian.profit + us.profit + satellite.profit;
    return {
      date: isoOf(d),
      indian,
      us,
      satellite,
      total: {
        profit: totalProfit,
        percentage: +((totalProfit / totalBase) * 100).toFixed(2),
        dailyChange: 0,
      },
      nifty: entity("nifty", BASES.indian, i),
      midcap: entity("midcap", BASES.indian, i),
      smallcap: entity("smallcap", BASES.indian, i),
    };
  });
  daily.forEach((r, i) => {
    r.total.dailyChange =
      i > 0 ? +(r.total.percentage - daily[i - 1].total.percentage).toFixed(2) : 0;
  });

  return { daily, holdings: buildHoldings() };
}

function buildHoldings(): Holding[] {
  const raw: Array<[string, string, number, number, number, number]> = [
    ["shoonya_1", "RELIANCE", 120, 2680, 2945, 0.8],
    ["shoonya_1", "HDFCBANK", 90, 1520, 1668, -0.4],
    ["shoonya_1", "INFY", 150, 1390, 1512, 1.1],
    ["shoonya_2", "TCS", 60, 3550, 3890, 0.6],
    ["shoonya_2", "ITC", 400, 412, 455, -0.2],
    ["angelone", "ICICIBANK", 200, 980, 1142, 1.4],
    ["angelone", "SBIN", 300, 560, 712, 0.9],
    ["angelone", "TATAMOTORS", 180, 720, 985, 2.1],
    ["fyers", "LT", 40, 3200, 3685, 0.5],
    ["fyers", "BHARTIARTL", 110, 1180, 1545, -0.7],
    ["fyers", "ASIANPAINT", 50, 2950, 2780, -1.2],
    ["kite", "HINDUNILVR", 70, 2380, 2512, 0.3],
    ["kite", "AXISBANK", 160, 1010, 1188, 1.0],
    ["kite", "MARUTI", 12, 11200, 12850, 0.8],
    ["kite", "SUNPHARMA", 90, 1480, 1742, 0.4],
  ];
  return raw.map(([broker, symbol, qty, avgCost, ltp, dayChangePct]) => {
    const invested = qty * avgCost;
    const currentValue = qty * ltp;
    return {
      broker,
      symbol,
      qty,
      avgCost,
      ltp,
      invested,
      currentValue,
      unrealizedPnl: currentValue - invested,
      dayChangePct,
      _source: "mock",
    };
  });
}

export const MOCK_INVESTMENT: { daily: InvestmentDay[]; holdings: Holding[] } = gen();
