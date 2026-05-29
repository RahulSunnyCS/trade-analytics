const { findMissingDates, parseDateCell, todayUTC } = require("../checkDates");

describe("parseDateCell()", () => {
  test("parses en-GB dash format into UTC date", () => {
    const d = parseDateCell("30-Apr-25");
    expect(d.toISOString().slice(0, 10)).toBe("2025-04-30");
  });

  test("parses space-separated format written by updateSheet.js", () => {
    const d = parseDateCell("26 May 26");
    expect(d.toISOString().slice(0, 10)).toBe("2026-05-26");
  });

  test("handles single-digit day", () => {
    const d = parseDateCell("1-May-25");
    expect(d.toISOString().slice(0, 10)).toBe("2025-05-01");
  });

  test("parses all months correctly", () => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    months.forEach((mon, idx) => {
      const d = parseDateCell(`15-${mon}-25`);
      expect(d.getUTCMonth()).toBe(idx);
    });
  });

  test("throws on unknown month abbreviation", () => {
    expect(() => parseDateCell("15-Xyz-25")).toThrow(/Unknown month/);
  });
});

describe("findMissingDates()", () => {
  test("returns empty array when last date is yesterday", () => {
    const today = new Date(Date.UTC(2025, 3, 30)); // Apr 30
    const gaps = findMissingDates("29-Apr-25", today);
    expect(gaps).toHaveLength(0);
  });

  test("finds two missing days", () => {
    const today = new Date(Date.UTC(2025, 3, 30)); // Apr 30
    const gaps = findMissingDates("27-Apr-25", today);
    expect(gaps).toHaveLength(2);
    expect(gaps[0].toISOString().slice(0, 10)).toBe("2025-04-28");
    expect(gaps[1].toISOString().slice(0, 10)).toBe("2025-04-29");
  });

  test("returns empty array when last date is today or future", () => {
    const today = new Date(Date.UTC(2025, 3, 30));
    expect(findMissingDates("30-Apr-25", today)).toHaveLength(0);
    expect(findMissingDates("01-May-25", today)).toHaveLength(0);
  });

  test("finds single missing day", () => {
    const today = new Date(Date.UTC(2025, 3, 30));
    const gaps = findMissingDates("28-Apr-25", today);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].toISOString().slice(0, 10)).toBe("2025-04-29");
  });

  test("all returned dates are UTC midnight", () => {
    const today = new Date(Date.UTC(2025, 3, 30));
    const gaps = findMissingDates("27-Apr-25", today);
    for (const d of gaps) {
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
      expect(d.getUTCSeconds()).toBe(0);
    }
  });
});

describe("todayUTC()", () => {
  test("returns a Date at UTC midnight", () => {
    const d = todayUTC();
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });
});
