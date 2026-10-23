import { changeText, offsetFromIntl } from "./clock-change-common";

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
});
