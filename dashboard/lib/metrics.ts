// Pure analytics helpers ported from the prototype's lib/metrics.js.
import { toDate } from "./format";

export function sum(arr: Array<number | string | null | undefined>): number {
  return arr.reduce<number>((a, b) => a + (Number(b) || 0), 0);
}

export function mean(arr: Array<number | string | null | undefined>): number {
  return arr.length ? sum(arr) / arr.length : 0;
}

export function std(arr: Array<number | string | null | undefined>): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(
    arr.reduce<number>((a, b) => a + Math.pow((Number(b) || 0) - m, 2), 0) / (arr.length - 1)
  );
}

export function cumulative(arr: Array<number | string | null | undefined>): number[] {
  let run = 0;
  return arr.map((v) => (run += Number(v) || 0));
}

// drawdown[i] = overall[i] - running peak (<= 0)
export function drawdownSeries(overall: number[]): number[] {
  let peak = -Infinity;
  return overall.map((v) => {
    peak = Math.max(peak, v);
    return v - peak;
  });
}

export function maxDrawdown(overall: number[]): { mdd: number; index: number; series: number[] } {
  const dd = drawdownSeries(overall);
  let mdd = 0;
  let index = -1;
  dd.forEach((v, i) => {
    if (v < mdd) {
      mdd = v;
      index = i;
    }
  });
  return { mdd, index, series: dd };
}

export function winRate(profits: number[]): { wins: number; losses: number; rate: number } {
  let wins = 0;
  let losses = 0;
  profits.forEach((p) => {
    if (p > 0) wins++;
    else if (p < 0) losses++;
  });
  const denom = wins + losses;
  return { wins, losses, rate: denom ? (wins / denom) * 100 : 0 };
}

export function streaks(profits: number[]): { current: number; longestWin: number; longestLoss: number } {
  let cur = 0;
  let longestWin = 0;
  let longestLoss = 0;
  profits.forEach((p) => {
    if (p > 0) {
      cur = cur > 0 ? cur + 1 : 1;
      longestWin = Math.max(longestWin, cur);
    } else if (p < 0) {
      cur = cur < 0 ? cur - 1 : -1;
      longestLoss = Math.min(longestLoss, cur);
    }
  });
  return { current: cur, longestWin, longestLoss: Math.abs(longestLoss) };
}

// trailing simple moving average; first (n-1) entries are null
export function rollingMean(arr: Array<number | string | null | undefined>, n: number): Array<number | null> {
  const out: Array<number | null> = [];
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += Number(arr[i]) || 0;
    if (i >= n) acc -= Number(arr[i - n]) || 0;
    out.push(i >= n - 1 ? acc / n : null);
  }
  return out;
}

export function bestWorst<T extends Record<string, any>>(
  records: T[],
  key: keyof T = "profit" as keyof T
): { best: T | null; worst: T | null } {
  let best: T | null = null;
  let worst: T | null = null;
  records.forEach((r) => {
    if (best === null || (r[key] as number) > (best[key] as number)) best = r;
    if (worst === null || (r[key] as number) < (worst[key] as number)) worst = r;
  });
  return { best, worst };
}

// Indian FY: Apr 1 -> Mar 31. Returns the calendar year the FY starts in.
export function fyStartYear(iso: string): number {
  const d = toDate(iso)!;
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 3 ? y : y - 1;
}

export function fyLabel(startYear: number): string {
  return "FY " + startYear + "-" + String(startYear + 1).slice(-2);
}

export function inFY(iso: string, startYear: number): boolean {
  return fyStartYear(iso) === startYear;
}

export function inCalendarYTD(iso: string, year: number): boolean {
  return toDate(iso)!.getUTCFullYear() === year;
}

export function dayOfWeekAgg(
  records: Array<{ date: string; profit: number; day?: string }>
): Array<{ day: string; avg: number; total: number; count: number }> {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets: Record<string, number[]> = {};
  records.forEach((r) => {
    const name = r.day || names[toDate(r.date)!.getUTCDay()];
    (buckets[name] = buckets[name] || []).push(r.profit);
  });
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return order
    .filter((n) => buckets[n])
    .map((n) => ({ day: n, avg: mean(buckets[n]), total: sum(buckets[n]), count: buckets[n].length }));
}

export function filterByDateRange<T extends { date: string }>(
  records: T[],
  startIso?: string | null,
  endIso?: string | null
): T[] {
  const s = startIso ? toDate(startIso)!.getTime() : -Infinity;
  const e = endIso ? toDate(endIso)!.getTime() : Infinity;
  return records.filter((r) => {
    const t = toDate(r.date)!.getTime();
    return t >= s && t <= e;
  });
}

// daily-return-based proxy (NOT a true Sharpe), annualized by sqrt(252)
export function sharpeProxy(profits: number[], capital: number): number {
  const rets = profits.map((p) => p / (capital || 1));
  const s = std(rets);
  return s ? (mean(rets) / s) * Math.sqrt(252) : 0;
}

export function monthKeyOf(iso: string): string {
  const d = toDate(iso)!;
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
