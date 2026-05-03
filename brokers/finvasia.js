function subject(accountId, date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `Combined Contract Note for ${accountId} ${dd}-${mm}-${yyyy}`;
}

function extract(text) {
  const pattern =
    /NSE\s*FNO(?:\s*-\s*\w+)?\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)/;
  const match = text.match(pattern);
  if (!match) return { error: "Finvasia NSE FNO line not matched" };

  const rawObligation = parseFloat(match[8]);
  const finalNet = parseFloat(match[7]);
  const brokerage = parseFloat(match[10]);

  return {
    payin_payout_obligation: rawObligation - brokerage,
    final_net: finalNet,
    net_brokerage: brokerage,
    other_charges: finalNet - rawObligation,
  };
}

module.exports = { subject, extract };
