"use client";
import { useMemo } from "react";
import type { BrokerRecord, TradingDay } from "@/types";
import { BROKER_NAMES } from "@/lib/chartkit";
import { formatDate, signedINR } from "@/lib/format";

type Props = {
  daily: TradingDay[];
  brokers: BrokerRecord[];
};

function tone(v: number | null | undefined): "" | "pos" | "neg" {
  if (v == null) return "";
  return v > 0 ? "pos" : v < 0 ? "neg" : "";
}

export function buildTradingTable(daily: TradingDay[], brokers: BrokerRecord[]) {
  const byDate: Record<string, Record<string, number>> = {};
  brokers.forEach((b) => {
    const row = (byDate[b.date] = byDate[b.date] || {});
    row[b.broker] = (row[b.broker] || 0) + b.final_net;
  });
  const brokerKeys = Array.from(new Set(brokers.map((b) => b.broker)));
  const netCols = brokerKeys.map((k) => (BROKER_NAMES[k] || k) + " Net");
  const head = ["Date", "Day", ...netCols, "Profit", "Overall", "Drawdown", "Charges", "Algos", "C/P %", "bps"];

  const rows = daily
    .slice()
    .reverse()
    .map((d) => {
      const bn = byDate[d.date] || {};
      const row: Record<string, any> = { Date: d.date, Day: d.day };
      brokerKeys.forEach((k) => {
        row[(BROKER_NAMES[k] || k) + " Net"] = Math.round(bn[k] || 0);
      });
      row.Profit = d.profit;
      row.Overall = d.overall;
      row.Drawdown = d.drawdown;
      row.Charges = d.charges;
      row.Algos = d.algos;
      row["C/P %"] = d.chargeProfitRatio;
      row.bps = d.profitCapitalBps;
      return row;
    });
  return { head, rows };
}

export function tableToCsv(head: string[], rows: Array<Record<string, any>>): string {
  const lines = [head.join(",")].concat(
    rows.map((r) => head.map((h) => JSON.stringify(r[h] == null ? "" : r[h])).join(","))
  );
  return lines.join("\n");
}

export function TradingTable({ daily, brokers }: Props) {
  const { head, rows } = useMemo(() => buildTradingTable(daily, brokers), [daily, brokers]);
  const moneyCols = new Set(["Profit", "Overall", "Drawdown", "Charges"]);

  function cell(h: string, v: any) {
    if (h === "Date") return formatDate(v);
    if (moneyCols.has(h) || /Net$/.test(h)) {
      return <span className={tone(v)}>{signedINR(v)}</span>;
    }
    if (h === "C/P %") return v == null ? "—" : v + "%";
    if (h === "bps") return v == null ? "—" : v;
    return v;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.Date}-${i}`}>
              {head.map((h) => (
                <td key={h}>{cell(h, r[h])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
