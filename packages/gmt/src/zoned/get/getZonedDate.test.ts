import { battleTestTimeZones } from "../../test";
import { getZonedDate } from "./getZonedDate";

describe("getZonedDate", () => {
  it.each`
    value           | timeZone              | expected
    ${"2024-02-29"} | ${"America/New_York"} | ${"2024-02-29"}
    ${"2024-02-29"} | ${"UTC"}              | ${"2024-02-29"}
  `(
    "returns $expected for $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(getZonedDate(value, timeZone)).toBe(expected);
    },
  );

  it.each`
    timeZone
    ${"UTC"}
    ${"GMT"}
    ${"Etc/GMT"}
    ${"Europe/Lisbon"}
    ${"Europe/Dublin"}
    ${"Europe/Berlin"}
    ${"Europe/Helsinki"}
    ${"Europe/Istanbul"}
    ${"Asia/Kolkata"}
    ${"Asia/Kathmandu"}
    ${"Asia/Shanghai"}
    ${"Australia/Lord_Howe"}
    ${"Pacific/Chatham"}
    ${"Pacific/Apia"}
    ${"Pacific/Niue"}
    ${"America/New_York"}
    ${"America/Chicago"}
    ${"America/Phoenix"}
  `(
    "returns the plain date unchanged for battle-test timeZone $timeZone",
    ({ timeZone }: { timeZone: string }) => {
      expect(getZonedDate("2024-02-29", timeZone)).toBe("2024-02-29");
    },
  );

  it.each`
    value
    ${"1970-01-01"}
  `("returns a non-empty date for edge case date $value", ({ value }) => {
    expect(getZonedDate(value, "UTC")).not.toBe("");
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid date $invalidValue",
    ({ invalidValue }) => {
      expect(getZonedDate(invalidValue as never, "UTC")).toBe("");
    },
  );

  it.each`
    invalidTimeZone
    ${"Mars/Olympus"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid timeZone $invalidTimeZone",
    ({ invalidTimeZone }) => {
      expect(getZonedDate("2024-02-29", invalidTimeZone as never)).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns the plain date unchanged for battle-test timeZone ${timeZone}`, () => {
      expect(getZonedDate("2024-02-29", timeZone)).toBe("2024-02-29");
    });
  }
});
