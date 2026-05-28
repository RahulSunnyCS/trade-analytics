function subject() {
  return "Contract Note - Equity Segment";
}

function bodyFilter(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function extract(text) {
  if (!text) return { error: "Angel One extract received empty text" };

  const totalMatch = text.match(/TOTAL\(NET\)((?:-?\d+\.\d{2}){11})/);
  if (!totalMatch) {
    const snippet = text.slice(0, 500).replace(/\n/g, " ");
    return { error: `Angel One TOTAL(NET) line not matched. Text preview: ${snippet}` };
  }

  const nums = totalMatch[1].match(/-?\d+\.\d{2}/g);
  if (!nums || nums.length < 11) {
    return { error: `Angel One TOTAL(NET) expected 11 numbers, got ${nums ? nums.length : 0}` };
  }
  const parsed = nums.map(parseFloat);
  const nanIdx = parsed.findIndex((n) => !isFinite(n));
  if (nanIdx !== -1) {
    return { error: `Angel One TOTAL(NET) yielded NaN at index ${nanIdx}` };
  }

  const brokerageMatch = text.match(/Total Brokerage\s*=\s*(\d+\.\d{2})/);
  if (!brokerageMatch) {
    return { error: "Angel One Total Brokerage not matched" };
  }

  const rawObligation = parsed[0];
  const finalNet = parsed[10];
  const brokerage = parseFloat(brokerageMatch[1]);

  if (!isFinite(brokerage)) {
    return { error: `Angel One brokerage parsed as NaN: "${brokerageMatch[1]}"` };
  }

  return {
    payin_payout_obligation: rawObligation - brokerage,
    net_brokerage: brokerage,
    other_charges: Math.abs(finalNet - rawObligation),
  };
}

module.exports = { subject, bodyFilter, extract };
