// Deterministic mock trading data — mirrors dashboard/data/mock-trading.js exactly.
// Same seed (20260528), same END (Date.UTC(2026, 4, 28)), same N_DAYS (110).
import { buildTradingModel } from "../trading-model";
import type { BrokerRecord, TradingModelResult } from "@/types";

function rng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CAPITAL = 1200000;
const N_DAYS = 110;
const END = Date.UTC(2026, 4, 28); // 2026-05-28

const ACCOUNTS = [
  { broker: "finvasia", accountId: "FA1234", weight: 0.6 },
  { broker: "angelone", accountId: "R59799620", weight: 0.4 },
];

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

function genBrokerRecords(): BrokerRecord[] {
  const rand = rng(20260528);
  const dates = weekdaysBack(END, N_DAYS);
  const brokers: BrokerRecord[] = [];
  dates.forEach((d) => {
    const iso = isoOf(d);
    ACCOUNTS.forEach((acc) => {
      const win = rand() < 0.56;
      const base = acc.weight * CAPITAL * (0.003 + rand() * 0.004);
      const mag = win ? 0.7 + rand() * 0.7 : 0.35 + rand() * 0.45;
      const obligation = Math.round((win ? 1 : -1) * base * mag);
      const algos = Math.round(4 + rand() * 14);
      const brokerage = Math.round(algos * (12 + rand() * 10));
      const other = Math.round(Math.abs(obligation) * 0.01 + 80 + rand() * 400);
      const total = brokerage + other;
      brokers.push({
        date: iso,
        broker: acc.broker,
        accountId: acc.accountId,
        algos,
        payin_payout_obligation: obligation,
        net_brokerage: brokerage,
        other_charges: other,
        total_charges: total,
        final_net: obligation - total,
      });
    });
  });
  return brokers;
}

export const MOCK_TRADING_BROKER_RECORDS: BrokerRecord[] = genBrokerRecords();
export const MOCK_TRADING_MODEL: TradingModelResult = buildTradingModel(
  MOCK_TRADING_BROKER_RECORDS,
  CAPITAL
);
export const MOCK_TRADING_CAPITAL = CAPITAL;
