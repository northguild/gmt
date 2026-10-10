import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../../plain/validate/isValidDate";
import { convertUtcToPlainDate } from "./convertUtcToPlainDate";

describe("convertUtcToPlainDate", () => {
  it.each`
    value                     | expected
    ${"2024-02-29T00:00:00Z"} | ${"2024-02-29"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01"}
    ${"2024-03-01T15:00:00Z"} | ${"2024-03-01"}
  `("returns $expected for UTC value $value", ({ value, expected }) => {
    expect(convertUtcToPlainDate(value)).toBe(expected);
  });

  it.each`
    value                     | timeZone              | expected
    ${"2024-02-29T00:00:00Z"} | ${"UTC"}              | ${"2024-02-29"}
    ${"2024-02-29T00:00:00Z"} | ${"America/New_York"} | ${"2024-02-28"}
  `(
    "returns $expected for UTC value $value in timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertUtcToPlainDate(value, { timeZone })).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${"2024-02-29T00:00:00"}
    ${""}
    ${null}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(convertUtcToPlainDate(value as never)).toBe("");
  });
});

// A year outside 0000 to 9999 is written as Temporal writes it, with a sign and six digits (TC39
// Temporal `PadISOYear ( y )`, §3.5.10), so the result is a string `isValidDate` and `Temporal.PlainDate.from`
// read. The last two rows are the first and last instants Temporal supports.
describe("convertUtcToPlainDate across the whole instant range", () => {
  it.each`
    value                        | timeZone       | expected
    ${"-000005-01-01T00:00:00Z"} | ${"UTC"}       | ${"-000005-01-01"}
    ${"0000-01-01T00:00:00Z"}    | ${"UTC"}       | ${"0000-01-01"}
    ${"9999-12-31T23:59:59Z"}    | ${"UTC"}       | ${"9999-12-31"}
    ${"+010000-01-01T00:00:00Z"} | ${"UTC"}       | ${"+010000-01-01"}
    ${"9999-12-31T23:59:59Z"}    | ${"+14:00"}    | ${"+010000-01-01"}
    ${"0000-01-01T00:00:00Z"}    | ${"-00:44:30"} | ${"-000001-12-31"}
    ${"-271821-04-20T00:00:00Z"} | ${"UTC"}       | ${"-271821-04-20"}
    ${"+275760-09-13T00:00:00Z"} | ${"UTC"}       | ${"+275760-09-13"}
    ${"+275760-09-13T00:00:00Z"} | ${"+23:59:59"} | ${"+275760-09-13"}
  `(
    "returns $expected for $value in $timeZone, a date isValidDate accepts",
    ({ value, timeZone, expected }) => {
      const result = convertUtcToPlainDate(value, { timeZone });

      expect(result).toBe(expected);
      expect(isValidDate(result)).toBe(true);
      expect(Temporal.PlainDate.from(result).toString()).toBe(result);
    },
  );

  // The same date Temporal writes for the instant on the UTC wall clock.
  it.each`
    value
    ${"-000005-01-01T00:00:00Z"}
    ${"0000-01-01T00:00:00Z"}
    ${"9999-12-31T23:59:59Z"}
    ${"+010000-01-01T00:00:00Z"}
    ${"-271821-04-20T00:00:00Z"}
    ${"+275760-09-13T00:00:00Z"}
  `("returns what Temporal.PlainDate writes for $value", ({ value }) => {
    expect(convertUtcToPlainDate(value)).toBe(
      Temporal.Instant.from(value)
        .toZonedDateTimeISO("UTC")
        .toPlainDate()
        .toString(),
    );
  });
});
