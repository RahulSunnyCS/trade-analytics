function subject(accountId, date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `Contract Note Cum Tax Invoice ${accountId} ${dd}/${mm}/${yyyy}`;
}

function extract(text) {
  const totalMatch = text.match(/TOTAL\(NET\)((?:-?\d+\.\d{2}){11})/);
  if (!totalMatch) return { error: "Angel One TOTAL(NET) line not matched" };
  const nums = totalMatch[1].match(/-?\d+\.\d{2}/g).map(parseFloat);

  const brokerageMatch = text.match(/Total Brokerage\s*=\s*(\d+\.\d{2})/);
  if (!brokerageMatch) return { error: "Angel One Total Brokerage not matched" };

  return {
    payin_payout_obligation: nums[0],
    final_net: nums[10],
    net_brokerage: parseFloat(brokerageMatch[1]),
  };
}

module.exports = { subject, extract };
