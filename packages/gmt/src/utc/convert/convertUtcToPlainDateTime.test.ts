import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../plain/validate/isValidDateTime";
import { convertUtcToPlainDateTime } from "./convertUtcToPlainDateTime";

describe("convertUtcToPlainDateTime", () => {
  it.each`
    value                     | expected
    ${"2024-02-29T00:00:00Z"} | ${"2024-02-29T00:00:00"}
    ${"2024-01-01T12:30:45Z"} | ${"2024-01-01T12:30:45"}
    ${"2024-03-01T15:30:45Z"} | ${"2024-03-01T15:30:45"}
  `("returns $expected for UTC value $value", ({ value, expected }) => {
    expect(convertUtcToPlainDateTime(value)).toBe(expected);
  });

  it.each`
    value                     | timeZone              | expected
    ${"2024-02-29T00:00:00Z"} | ${"UTC"}              | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"} | ${"America/New_York"} | ${"2024-02-28T19:00:00"}
  `(
    "returns $expected for UTC value $value in timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertUtcToPlainDateTime(value, { timeZone })).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${"2024-02-29T00:00:00"}
    ${""}
    ${null}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(convertUtcToPlainDateTime(value as never)).toBe("");
  });
});

// A year outside 0000 to 9999 is written as Temporal writes it, with a sign and six digits (TC39
// Temporal `PadISOYear ( y )`, §3.5.10), so the result is a string `isValidDateTime` and
// `Temporal.PlainDateTime.from` read. The time stays cut to the second.
describe("convertUtcToPlainDateTime across the whole instant range", () => {
  it.each`
    value                         | timeZone       | expected
    ${"-000005-01-01T00:00:00Z"}  | ${"UTC"}       | ${"-000005-01-01T00:00:00"}
    ${"0000-01-01T00:00:00Z"}     | ${"UTC"}       | ${"0000-01-01T00:00:00"}
    ${"9999-12-31T23:59:59Z"}     | ${"UTC"}       | ${"9999-12-31T23:59:59"}
    ${"+010000-01-01T00:00:00Z"}  | ${"UTC"}       | ${"+010000-01-01T00:00:00"}
    ${"9999-12-31T23:59:59Z"}     | ${"+14:00"}    | ${"+010000-01-01T13:59:59"}
    ${"0000-01-01T00:00:00Z"}     | ${"-00:44:30"} | ${"-000001-12-31T23:15:30"}
    ${"-271821-04-20T00:00:00Z"}  | ${"UTC"}       | ${"-271821-04-20T00:00:00"}
    ${"+275760-09-13T00:00:00Z"}  | ${"UTC"}       | ${"+275760-09-13T00:00:00"}
    ${"+275760-09-13T00:00:00Z"}  | ${"+23:59:59"} | ${"+275760-09-13T23:59:59"}
    ${"2024-03-10T12:00:00.999Z"} | ${"UTC"}       | ${"2024-03-10T12:00:00"}
    ${"2024-03-10T12:00:00Z"}     | ${"UTC"}       | ${"2024-03-10T12:00:00"}
  `(
    "returns $expected for $value in $timeZone, a date-time isValidDateTime accepts",
    ({ value, timeZone, expected }) => {
      const result = convertUtcToPlainDateTime(value, { timeZone });

      expect(result).toBe(expected);
      expect(isValidDateTime(result)).toBe(true);
      expect(
        Temporal.PlainDateTime.from(result).toString({
          smallestUnit: "second",
        }),
      ).toBe(result);
    },
  );

  // The same date-time Temporal writes for the instant on the UTC wall clock, cut to the second.
  it.each`
    value
    ${"-000005-01-01T00:00:00Z"}
    ${"0000-01-01T00:00:00Z"}
    ${"9999-12-31T23:59:59Z"}
    ${"+010000-01-01T00:00:00Z"}
    ${"-271821-04-20T00:00:00Z"}
    ${"+275760-09-13T00:00:00Z"}
  `("returns what Temporal.PlainDateTime writes for $value", ({ value }) => {
    expect(convertUtcToPlainDateTime(value)).toBe(
      Temporal.Instant.from(value)
        .toZonedDateTimeISO("UTC")
        .toPlainDateTime()
        .toString({ smallestUnit: "second" }),
    );
  });
});
