"use client";
import type { KpiCard } from "@/types";

type Props = {
  items: KpiCard[];
  variant?: "default" | "kpi-4";
};

export function KpiGrid({ items, variant = "default" }: Props) {
  const cls = "kpi-grid" + (variant === "kpi-4" ? " kpi-4" : "");
  return (
    <div className={cls}>
      {items.map((it, i) => (
        <div className="kpi" key={`${it.label}-${i}`}>
          <div className="kpi-label">{it.label}</div>
          <div className={`kpi-value ${it.tone || ""}`.trim()}>{it.value}</div>
          {it.sub ? <div className="kpi-sub">{it.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
