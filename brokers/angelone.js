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
  const totalMatch = text.match(/TOTAL\(NET\)((?:-?\d+\.\d{2}){11})/);
  if (!totalMatch) return { error: "Angel One TOTAL(NET) line not matched" };
  const nums = totalMatch[1].match(/-?\d+\.\d{2}/g).map(parseFloat);

  const brokerageMatch = text.match(/Total Brokerage\s*=\s*(\d+\.\d{2})/);
  if (!brokerageMatch) return { error: "Angel One Total Brokerage not matched" };

  const rawObligation = nums[0];
  const finalNet = nums[10];
  const brokerage = parseFloat(brokerageMatch[1]);

  return {
    payin_payout_obligation: rawObligation - brokerage,
    final_net: finalNet,
    net_brokerage: brokerage,
    other_charges: Math.abs(finalNet - rawObligation),
  };
}

module.exports = { subject, bodyFilter, extract };
