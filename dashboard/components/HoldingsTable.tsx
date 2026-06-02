"use client";
import type { Holding } from "@/types";
import { formatINR, formatPct, signedINR } from "@/lib/format";

const HOLDING_BROKERS: Record<string, string> = {
  shoonya_1: "Shoonya #1",
  shoonya_2: "Shoonya #2",
  angelone: "Angel One",
  fyers: "Fyers",
  kite: "Kite",
};

function tone(v: number): "" | "pos" | "neg" {
  return v > 0 ? "pos" : v < 0 ? "neg" : "";
}

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  // Group by broker, preserve first-seen order.
  const order: string[] = [];
  const groups: Record<string, Holding[]> = {};
  holdings.forEach((h) => {
    if (!groups[h.broker]) {
      groups[h.broker] = [];
      order.push(h.broker);
    }
    groups[h.broker].push(h);
  });

  let gInv = 0;
  let gCur = 0;

  return (
    <div className="table-wrap">
      <table className="data-table holdings">
        <thead>
          <tr>
            <th>Symbol</th>
            <th className="num">Qty</th>
            <th className="num">Avg</th>
            <th className="num">LTP</th>
            <th className="num">Invested</th>
            <th className="num">Value</th>
            <th className="num">Unreal. P&amp;L</th>
            <th className="num">Day</th>
          </tr>
        </thead>
        <tbody>
          {order.map((bk) => {
            let sInv = 0;
            let sCur = 0;
            const rows = groups[bk];
            const acc: React.ReactNode[] = [];
            acc.push(
              <tr className="grp" key={`grp-${bk}`}>
                <td colSpan={8}>{HOLDING_BROKERS[bk] || bk}</td>
              </tr>
            );
            rows.forEach((x, i) => {
              sInv += x.invested;
              sCur += x.currentValue;
              acc.push(
                <tr key={`${bk}-${x.symbol}-${i}`}>
                  <td>{x.symbol}</td>
                  <td className="num">{x.qty}</td>
                  <td className="num">{formatINR(x.avgCost)}</td>
                  <td className="num">{formatINR(x.ltp)}</td>
                  <td className="num">{formatINR(x.invested, { compact: true })}</td>
                  <td className="num">{formatINR(x.currentValue, { compact: true })}</td>
                  <td className={`num ${tone(x.unrealizedPnl)}`.trim()}>
                    {signedINR(x.unrealizedPnl)}
                  </td>
                  <td className={`num ${tone(x.dayChangePct)}`.trim()}>
                    {formatPct(x.dayChangePct)}
                  </td>
                </tr>
              );
            });
            acc.push(
              <tr className="subtot" key={`subtot-${bk}`}>
                <td>Subtotal</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="num">{formatINR(sInv, { compact: true })}</td>
                <td className="num">{formatINR(sCur, { compact: true })}</td>
                <td className={`num ${tone(sCur - sInv)}`.trim()}>{signedINR(sCur - sInv)}</td>
                <td></td>
              </tr>
            );
            gInv += sInv;
            gCur += sCur;
            return acc;
          })}
          <tr className="grandtot">
            <td>Total</td>
            <td></td>
            <td></td>
            <td></td>
            <td className="num">{formatINR(gInv, { compact: true })}</td>
            <td className="num">{formatINR(gCur, { compact: true })}</td>
            <td className={`num ${tone(gCur - gInv)}`.trim()}>{signedINR(gCur - gInv)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
