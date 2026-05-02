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
  return {
    payin_payout_obligation: parseFloat(match[8]),
    final_net: parseFloat(match[7]),
    net_brokerage: parseFloat(match[10]),
  };
}

module.exports = { subject, extract };
