const { extract, subject } = require("../../brokers/finvasia");
const fs = require("fs");
const path = require("path");

const sampleText = fs.readFileSync(path.join(__dirname, "../fixtures/finvasia-sample.txt"), "utf-8");
const noMatchText = fs.readFileSync(path.join(__dirname, "../fixtures/finvasia-no-match.txt"), "utf-8");

describe("finvasia.extract()", () => {
  test("extracts all three fields from valid PDF text", () => {
    const result = extract(sampleText);
    expect(result.error).toBeUndefined();
    expect(typeof result.payin_payout_obligation).toBe("number");
    expect(typeof result.net_brokerage).toBe("number");
    expect(typeof result.other_charges).toBe("number");
    expect(isFinite(result.payin_payout_obligation)).toBe(true);
    expect(isFinite(result.net_brokerage)).toBe(true);
    expect(isFinite(result.other_charges)).toBe(true);
  });

  test("net_brokerage is non-negative", () => {
    const result = extract(sampleText);
    expect(result.net_brokerage).toBeGreaterThanOrEqual(0);
  });

  test("other_charges is non-negative", () => {
    const result = extract(sampleText);
    expect(result.other_charges).toBeGreaterThanOrEqual(0);
  });

  test("returns error when NSE FNO line not present", () => {
    const result = extract(noMatchText);
    expect(result.error).toMatch(/NSE FNO line not matched/);
  });

  test("error includes text preview", () => {
    const result = extract(noMatchText);
    expect(result.error).toMatch(/Text preview:/);
  });

  test("returns error for empty text", () => {
    const result = extract("");
    expect(result.error).toBeDefined();
  });

  test("returns error for null/undefined text", () => {
    expect(extract(null).error).toBeDefined();
    expect(extract(undefined).error).toBeDefined();
  });
});

describe("finvasia.subject()", () => {
  test("includes accountId and formatted date", () => {
    const result = subject("FA1234", new Date("2025-04-30"));
    expect(result).toContain("FA1234");
    expect(result).toContain("30-04-2025");
  });
});
