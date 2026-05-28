const { columnToLetter, letterToColumn, buildAccountValues } = require("../updateSheet");

describe("columnToLetter()", () => {
  test.each([
    [1, "A"],
    [4, "D"],
    [26, "Z"],
    [27, "AA"],
    [52, "AZ"],
    [53, "BA"],
    [702, "ZZ"],
  ])("column %i → %s", (col, letter) => {
    expect(columnToLetter(col)).toBe(letter);
  });
});

describe("letterToColumn()", () => {
  test.each([
    ["A", 1],
    ["D", 4],
    ["Z", 26],
    ["AA", 27],
    ["AZ", 52],
    ["BA", 53],
    ["ZZ", 702],
  ])("%s → %i", (letter, col) => {
    expect(letterToColumn(letter)).toBe(col);
  });

  test("round-trip: letterToColumn(columnToLetter(n)) === n", () => {
    for (const n of [1, 4, 26, 27, 52, 100, 702]) {
      expect(letterToColumn(columnToLetter(n))).toBe(n);
    }
  });
});

describe("buildAccountValues()", () => {
  test("returns four numbers from a full match", () => {
    const vals = buildAccountValues({
      payin_payout_obligation: 100,
      net_brokerage: 20,
      other_charges: 5,
    });
    expect(vals).toEqual([100, 20, 5, 25]);
  });

  test("totalCharges = net_brokerage + other_charges", () => {
    const [, brokerage, other, total] = buildAccountValues({
      payin_payout_obligation: 0,
      net_brokerage: 15,
      other_charges: 7,
    });
    expect(total).toBe(brokerage + other);
  });

  test("defaults all to zero when match is undefined", () => {
    expect(buildAccountValues(undefined)).toEqual([0, 0, 0, 0]);
  });

  test("defaults all to zero when match is null", () => {
    expect(buildAccountValues(null)).toEqual([0, 0, 0, 0]);
  });

  test("handles missing fields with zero fallback", () => {
    const vals = buildAccountValues({ payin_payout_obligation: 50 });
    expect(vals).toEqual([50, 0, 0, 0]);
  });
});
