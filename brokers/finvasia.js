function subject(accountId, date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `Combined Contract Note for ${accountId} ${dd}-${mm}-${yyyy}`;
}

function extract(text) {
  if (!text) return { error: "Finvasia extract received empty text" };

  const pattern =
    /NSE\s*FNO(?:\s*-\s*\w+)?\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)/;
  const match = text.match(pattern);
  if (!match) {
    const snippet = text.slice(0, 500).replace(/\n/g, " ");
    return { error: `Finvasia NSE FNO line not matched. Text preview: ${snippet}` };
  }

  const rawObligation = parseFloat(match[8]);
  const finalNet = parseFloat(match[7]);
  const brokerage = parseFloat(match[10]);

  if (!isFinite(rawObligation) || !isFinite(finalNet) || !isFinite(brokerage)) {
    return {
      error: `Finvasia parsed NaN field(s): rawObligation=${rawObligation} finalNet=${finalNet} brokerage=${brokerage}`,
    };
  }

  return {
    payin_payout_obligation: rawObligation - brokerage,
    net_brokerage: brokerage,
    other_charges: Math.abs(finalNet - rawObligation),
  };
}

module.exports = { subject, extract };
