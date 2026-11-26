import {
  changeText,
  utcClockText,
  offsetFromIntl,
  offsetFromSeconds,
  offsetSeconds,
} from "./clock-change-common";

describe("offsetFromIntl", () => {
  it.each([
    ["GMT-07:00", "-07:00"],
    ["GMT+05:30", "+05:30"],
    ["GMT", "+00:00"],
    ["GMT+00:00", "+00:00"],
    ["GMT−03:30", "-03:30"],
    ["GMT-00:44:30", "-00:44:30"],
  ])("reads %s as %s", (text, offset) => {
    expect(offsetFromIntl(text)).toBe(offset);
  });

  it.each(["", "UTC", "GMT-7", "-07:00", "PST"])(
    "returns an empty string for %j",
    (text) => {
      expect(offsetFromIntl(text)).toBe("");
    },
  );
});

describe("changeText", () => {
  it("says none for the years given when there is no change", () => {
    expect(changeText(null, "2025 or 2026")).toBe("none in 2025 or 2026");
  });

  it("prints the UTC date and time and the offsets either side", () => {
    expect(
      changeText(
        {
          instant: "2026-11-01T09:00:00Z",
          offsetBefore: "-06:00",
          offsetAfter: "-07:00",
        },
        "2026 or 2027",
      ),
    ).toBe("2026-11-01 09:00 UTC, -06:00 → -07:00");
  });

  it("keeps the seconds of a change that falls between minutes", () => {
    // Monrovia moved from -00:44:30 to UTC at 00:44:30 UTC.
    expect(
      changeText(
        {
          instant: "1972-01-07T00:44:30Z",
          offsetBefore: "-00:44:30",
          offsetAfter: "+00:00",
        },
        "1971 or 1972",
      ),
    ).toBe("1972-01-07 00:44:30 UTC, -00:44:30 → +00:00");
  });
});

describe("utcClockText", () => {
  it.each([
    ["2026-11-01T09:00:00Z", "09:00"],
    ["1972-01-07T00:44:30Z", "00:44:30"],
    ["1883-11-18T17:00:00Z", "17:00"],
    ["1883-11-18T16:56:02Z", "16:56:02"],
  ])("writes %s as %s", (instant, expected) => {
    expect(utcClockText(instant)).toBe(expected);
  });
});

describe("offsetSeconds and offsetFromSeconds", () => {
  it.each([
    ["+00:00", 0],
    ["-05:00", -18_000],
    ["+05:45", 20_700],
    ["-00:44:30", -2670],
    ["-04:56:02", -17_762],
    ["+05:30:15.25", 19_815.25],
  ])("reads %s as %d seconds", (offset, seconds) => {
    expect(offsetSeconds(offset)).toBe(seconds);
  });

  it.each(["Z", "", "+0530", "-4:00", "+05:30[UTC]", "GMT-07:00"])(
    "refuses %j",
    (offset) => {
      expect(offsetSeconds(offset)).toBeNull();
    },
  );

  it.each([
    [0, "+00:00"],
    [-18_000, "-05:00"],
    [-2670, "-00:44:30"],
    [-17_762, "-04:56:02"],
    [930, "+00:15:30"],
  ])("writes %d seconds as %s", (seconds, offset) => {
    expect(offsetFromSeconds(seconds)).toBe(offset);
  });
});
