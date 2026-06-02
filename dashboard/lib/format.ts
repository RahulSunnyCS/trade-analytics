// Formatting helpers — Indian number system (₹ lakh/crore), %, bps, dates.

const inrFull = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function num(value: number | string | null | undefined, decimals?: number): string {
  const n = Number(value) || 0;
  if (decimals == null) return inrFull.format(Math.round(n));
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function trim(s: string): string {
  return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

// Compact Indian magnitudes: 1,200,000 -> "12 L", 25,000,000 -> "2.5 Cr"
export function compact(value: number | string | null | undefined): string {
  const n = Number(value) || 0;
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e7) return sign + trim((a / 1e7).toFixed(2)) + " Cr";
  if (a >= 1e5) return sign + trim((a / 1e5).toFixed(2)) + " L";
  if (a >= 1e3) return sign + trim((a / 1e3).toFixed(1)) + " K";
  return sign + a.toFixed(0);
}

export type FormatINROpts = { compact?: boolean; decimals?: number };

export function formatINR(value: number | string | null | undefined, opts: FormatINROpts = {}): string {
  const n = Number(value) || 0;
  if (opts.compact) return "₹" + compact(n);
  return "₹" + num(n, opts.decimals);
}

export function signedINR(value: number | string | null | undefined, opts: FormatINROpts = {}): string {
  const n = Number(value) || 0;
  return (n < 0 ? "-" : "+") + formatINR(Math.abs(n), opts);
}

export function formatPct(value: number | string | null | undefined, decimals?: number): string {
  const n = Number(value) || 0;
  const d = decimals == null ? 2 : decimals;
  return (n > 0 ? "+" : "") + n.toFixed(d) + "%";
}

export function formatBps(value: number | string | null | undefined): string {
  const n = Number(value) || 0;
  return (n > 0 ? "+" : "") + n.toFixed(0) + " bps";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ISO "2026-05-28" -> "28 May 26"
export function formatDate(iso: string | Date | null | undefined): string {
  const d = toDate(iso);
  if (!d) return (iso as string) || "";
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(-2);
}

export function toDate(iso: string | Date | null | undefined): Date | null {
  if (iso instanceof Date) return iso;
  if (!iso) return null;
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
}

// "2025-04" -> "Apr 25"
export function monthLabel(monthKey: string): string {
  const parts = String(monthKey).split("-");
  if (parts.length < 2) return monthKey;
  return MONTHS[+parts[1] - 1] + " " + String(parts[0]).slice(-2);
}
