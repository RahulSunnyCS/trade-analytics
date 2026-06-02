"use client";

export type StatChip = {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "";
  sub?: string;
};

export function StatStrip({ items }: { items: StatChip[] }) {
  return (
    <div className="stat-strip">
      {items.map((it, i) => (
        <div className="chip" key={`${it.label}-${i}`}>
          <span className="chip-label">{it.label}</span>
          <span className={`chip-value ${it.tone || ""}`.trim()}>{it.value}</span>
          {it.sub ? <span className="chip-sub">{it.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}
