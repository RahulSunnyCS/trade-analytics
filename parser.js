const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { getBroker, parseFileName } = require("./brokers");

const SUMMARY_FIELDS = [
  "payin_payout_obligation",
  "final_net",
  "net_brokerage",
  "other_charges",
];

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
  total: Object.fromEntries(SUMMARY_FIELDS.map((f) => [f, 0])),
};

(async () => {
  for (const file of pdfFiles) {
    const meta = parseFileName(file);
    if (!meta) {
      console.warn(
        `⚠️ Skipping ${file}: filename does not embed <email>__<broker>__<accountId>__... — re-fetch on the new pipeline.`
      );
      continue;
    }

    const pdfPath = path.join(dataDir, file);
    const pdfBuffer = fs.readFileSync(pdfPath);

    try {
      const data = await pdfParse(pdfBuffer);
      console.log(
        `✅ Loaded PDF: ${file} (broker=${meta.broker}, account=${meta.accountId})`
      );

      const broker = getBroker(meta.broker);
      const summary = broker.extract(data.text);
      if (summary.error) {
        console.error(`❌ Extractor failed for ${file}: ${summary.error}`);
        continue;
      }
      console.log(`🎯 ${meta.broker} summary for ${meta.accountId}:`, summary);

      const accountEntry = {
        account: meta.accountId,
        broker: meta.broker,
        email: meta.email,
      };
      for (const f of SUMMARY_FIELDS) {
        const v = summary[f] ?? 0;
        accountEntry[f] = v;
        mergedSummary.total[f] += v;
      }
      mergedSummary.individual_account.push(accountEntry);
    } catch (err) {
      console.error(`❌ Error parsing ${file}:`, err.message);
    }
  }

  const outputPath = path.join(__dirname, "daily_summary.json");
  fs.writeFileSync(outputPath, JSON.stringify(mergedSummary, null, 2));
  console.log(`📦 Merged summary saved to daily_summary.json\n`);
})();
