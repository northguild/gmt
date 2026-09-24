import { Temporal } from "@js-temporal/polyfill";
import { wallClockAtOffset } from "./wallClockAtOffset";

describe("wallClockAtOffset", () => {
  // Expected wall clocks are instant + offset, worked by hand. TC39 limits: an Instant spans
  // ±8.64e21 ns (-271821-04-20T00:00Z to +275760-09-13T00:00Z); a PlainDateTime reaches one day
  // further (ISODateTimeWithinLimits), so a ±14:00 offset at either limit still has a wall clock.
  it.each`
    instant                      | offsetNanoseconds       | expected                    | reason
    ${"+275760-09-13T00:00:00Z"} | ${50_400_000_000_000n}  | ${"+275760-09-13T14:00:00"} | ${"latest instant at +14:00, past the instant range"}
    ${"-271821-04-20T00:00:00Z"} | ${-50_400_000_000_000n} | ${"-271821-04-19T10:00:00"} | ${"earliest instant at -14:00, before the instant range"}
    ${"1970-01-01T00:00:00Z"}    | ${-2_670_000_000_000n}  | ${"1969-12-31T23:15:30"}    | ${"sub-minute offset -00:44:30, which no offset zone can carry"}
    ${"2024-06-15T05:29:44.75Z"} | ${19_815_250_000_000n}  | ${"2024-06-15T11:00:00"}    | ${"fractional-second offset +05:30:15.25"}
    ${"2024-06-15T10:00:00Z"}    | ${0n}                   | ${"2024-06-15T10:00:00"}    | ${"zero offset is the UTC wall clock"}
  `(
    "reads $instant at $offsetNanoseconds ns as $expected ($reason)",
    ({ instant, offsetNanoseconds, expected }) => {
      expect(
        wallClockAtOffset(
          Temporal.Instant.from(instant),
          offsetNanoseconds,
        ).toString(),
      ).toBe(expected);
    },
  );
});
