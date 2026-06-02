"use client";
import { useMemo } from "react";
import { fyStartYear } from "@/lib/metrics";
import { toDate } from "@/lib/format";

export type FilterValue = { start: string; end: string; broker: string };
export type Preset = "all" | "fy" | "ytd" | null;

type BrokerOpt = { value: string; label: string };

type Props = {
  dates: { min: string; max: string };
  value: FilterValue;
  preset: Preset;
  onChange: (next: FilterValue, preset: Preset) => void;
  showBroker?: boolean;
  brokers?: BrokerOpt[];
  onCsv?: () => void;
};

export function FilterBar({
  dates,
  value,
  preset,
  onChange,
  showBroker,
  brokers,
  onCsv,
}: Props) {
  const { min, max } = dates;

  const computedPresets = useMemo(() => {
    return {
      all: { start: min, end: max },
      fy: { start: clampStart(`${fyStartYear(max)}-04-01`, min), end: max },
      ytd: {
        start: clampStart(`${toDate(max)!.getUTCFullYear()}-01-01`, min),
        end: max,
      },
    } as const;
  }, [min, max]);

  function applyPreset(p: "all" | "fy" | "ytd") {
    const r = computedPresets[p];
    onChange({ ...value, start: r.start, end: r.end }, p);
  }

  return (
    <div id="filterbar">
      <div className="presets">
        <button
          className={preset === "all" ? "active" : ""}
          onClick={() => applyPreset("all")}
        >
          All
        </button>
        <button
          className={preset === "fy" ? "active" : ""}
          onClick={() => applyPreset("fy")}
        >
          FY
        </button>
        <button
          className={preset === "ytd" ? "active" : ""}
          onClick={() => applyPreset("ytd")}
        >
          YTD
        </button>
      </div>
      <div className="filter-field">
        <span>From</span>
        <input
          type="date"
          value={value.start}
          min={min}
          max={max}
          onChange={(e) => onChange({ ...value, start: e.target.value }, null)}
        />
      </div>
      <div className="filter-field">
        <span>To</span>
        <input
          type="date"
          value={value.end}
          min={min}
          max={max}
          onChange={(e) => onChange({ ...value, end: e.target.value }, null)}
        />
      </div>
      {showBroker && brokers ? (
        <div className="filter-field">
          <span>Broker</span>
          <select
            value={value.broker}
            onChange={(e) => onChange({ ...value, broker: e.target.value }, preset)}
          >
            {brokers.map((b) => (
              <option value={b.value} key={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <span className="grow" />
      {onCsv ? (
        <button className="btn ghost" onClick={onCsv}>
          ⬇ Export CSV
        </button>
      ) : null}
    </div>
  );
}

function clampStart(s: string, min: string): string {
  return toDate(s)!.getTime() < toDate(min)!.getTime() ? min : s;
}
