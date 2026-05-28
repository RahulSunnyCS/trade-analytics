const { extract, subject, bodyFilter } = require("../../brokers/angelone");
const fs = require("fs");
const path = require("path");

const sampleText = fs.readFileSync(path.join(__dirname, "../fixtures/angelone-sample.txt"), "utf-8");
const noMatchText = fs.readFileSync(path.join(__dirname, "../fixtures/angelone-no-match.txt"), "utf-8");

describe("angelone.extract()", () => {
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
    expect(extract(sampleText).net_brokerage).toBeGreaterThanOrEqual(0);
  });

  test("other_charges is non-negative", () => {
    expect(extract(sampleText).other_charges).toBeGreaterThanOrEqual(0);
  });

  test("returns error when TOTAL(NET) line not present", () => {
    const result = extract(noMatchText);
    expect(result.error).toMatch(/TOTAL\(NET\) line not matched/);
  });

  test("error includes text preview", () => {
    const result = extract(noMatchText);
    expect(result.error).toMatch(/Text preview:/);
  });

  test("returns error for empty text", () => {
    expect(extract("").error).toBeDefined();
  });

  test("returns error for null/undefined text", () => {
    expect(extract(null).error).toBeDefined();
    expect(extract(undefined).error).toBeDefined();
  });
});

describe("angelone.subject()", () => {
  test("returns fixed contract note subject", () => {
    expect(subject()).toBe("Contract Note - Equity Segment");
  });
});

describe("angelone.bodyFilter()", () => {
  test("formats date as DD/MM/YYYY", () => {
    expect(bodyFilter(new Date("2025-04-30"))).toBe("30/04/2025");
  });

  test("pads single-digit day and month", () => {
    expect(bodyFilter(new Date("2025-01-05"))).toBe("05/01/2025");
  });
});
