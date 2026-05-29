// Formatting helpers — Indian number system (₹ lakh/crore), %, bps, dates.
// Standalone build: attaches to window.Format. Next.js port: these become named exports in lib/format.ts.
(function (global) {
  "use strict";

  const inrFull = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

  function num(value, decimals) {
    const n = Number(value) || 0;
    if (decimals == null) return inrFull.format(Math.round(n));
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  }

  // Compact Indian magnitudes: 1,200,000 -> "12 L", 25,000,000 -> "2.5 Cr"
  function compact(value) {
    const n = Number(value) || 0;
    const a = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (a >= 1e7) return sign + trim((a / 1e7).toFixed(2)) + " Cr";
    if (a >= 1e5) return sign + trim((a / 1e5).toFixed(2)) + " L";
    if (a >= 1e3) return sign + trim((a / 1e3).toFixed(1)) + " K";
    return sign + a.toFixed(0);
  }
  function trim(s) {
    return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  function formatINR(value, opts) {
    opts = opts || {};
    const n = Number(value) || 0;
    if (opts.compact) return "₹" + compact(n);
    return "₹" + num(n, opts.decimals);
  }

  function signedINR(value, opts) {
    const n = Number(value) || 0;
    return (n < 0 ? "-" : "+") + formatINR(Math.abs(n), opts);
  }

  function formatPct(value, decimals) {
    const n = Number(value) || 0;
    const d = decimals == null ? 2 : decimals;
    return (n > 0 ? "+" : "") + n.toFixed(d) + "%";
  }

  function formatBps(value) {
    const n = Number(value) || 0;
    return (n > 0 ? "+" : "") + n.toFixed(0) + " bps";
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ISO "2026-05-28" -> "28 May 26" (matches the pipeline's en-GB rendering in updateSheet.js)
  function formatDate(iso) {
    const d = toDate(iso);
    if (!d) return iso || "";
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(-2);
  }

  function toDate(iso) {
    if (iso instanceof Date) return iso;
    if (!iso) return null;
    const parts = String(iso).slice(0, 10).split("-");
    if (parts.length !== 3) return null;
    return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  }

  // "2025-04" -> "Apr 25"
  function monthLabel(monthKey) {
    const parts = String(monthKey).split("-");
    if (parts.length < 2) return monthKey;
    return MONTHS[+parts[1] - 1] + " " + String(parts[0]).slice(-2);
  }

  global.Format = { formatINR, signedINR, compact, formatPct, formatBps, formatDate, monthLabel, toDate, num };
})(window);
