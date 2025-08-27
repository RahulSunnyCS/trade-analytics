const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const dataDir = path.join(__dirname, "data");
const pdfFiles = fs
  .readdirSync(dataDir)
  .filter((file) => file.endsWith("_decrypted.pdf"));

if (!pdfFiles.length) {
  console.log("📭 No PDF files found in data/");
  process.exit(0);
}

const mergedSummary = {
  individual_account: [],
  total: {
    payin_payout_obligation: 0,
    final_net: 0,
    net_brokerage: 0,
  },
};

(async () => {
  for (const file of pdfFiles) {
    const pdfPath = path.join(dataDir, file);
    const pdfBuffer = fs.readFileSync(pdfPath);

    try {
      const data = await pdfParse(pdfBuffer);
      const text = data.text;
      console.log(`✅ Loaded PDF: ${file}`);

      const nseFno = extractNSEFNO(text);
      console.log("🎯 NSE FNO Summary:", nseFno);

      // Assuming the file name format is {account}_CombinedContractNote.pdf
      const accountName = path.basename(file, ".pdf");

      // Create the account entry
      const accountEntry = {
        account: accountName,
        payin_payout_obligation: nseFno.payin_payout_obligation,
        final_net: nseFno.final_net,
        net_brokerage: nseFno.net_brokerage,
      };

      // Add this account entry to the individual_account array
      mergedSummary.individual_account.push(accountEntry);

      // Update the total sums
      mergedSummary.total.payin_payout_obligation +=
        nseFno.payin_payout_obligation;
      mergedSummary.total.final_net += nseFno.final_net;
      mergedSummary.total.net_brokerage += nseFno.net_brokerage;
    } catch (err) {
      console.error(`❌ Error parsing ${file}:`, err.message);
    }
  }

  // Save the merged summary to a JSON file
  const outputPath = path.join(__dirname, "daily_summary.json");
  fs.writeFileSync(outputPath, JSON.stringify(mergedSummary, null, 2));
  console.log(`📦 Merged summary saved to daily_summary.json\n`);
})();

// 🔍 Extractor logic
function extractNSEFNO(text) {
  const pattern =
    /NSE\s*FNO(?:\s*-\s*\w+)?\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)/;

  const match = text.match(pattern);

  if (!match) {
    return { error: "NSE FNO line not matched" };
  }

  return {
    payin_payout_obligation: parseFloat(match[8]),
    final_net: parseFloat(match[7]),
    net_brokerage: parseFloat(match[10]),
  };
}
