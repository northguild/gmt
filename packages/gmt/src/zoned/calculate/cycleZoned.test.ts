import { battleTestTimeZones, localNoonBattleCases } from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { cycleZoned } from "./cycleZoned";

describe("cycleZoned", () => {
  it.each`
    value                                           | field       | amount | expected
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"year"}   | ${1}   | ${"2025-06-15T09:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"month"}  | ${1}   | ${"2024-07-15T09:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"day"}    | ${1}   | ${"2024-06-16T09:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"hour"}   | ${1}   | ${"2024-06-15T10:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"minute"} | ${1}   | ${"2024-06-15T09:31:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"second"} | ${1}   | ${"2024-06-15T09:30:01-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"year"}   | ${-1}  | ${"2023-06-15T09:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"month"}  | ${-1}  | ${"2024-05-15T09:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"day"}    | ${-1}  | ${"2024-06-14T09:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"hour"}   | ${-1}  | ${"2024-06-15T08:30:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"minute"} | ${-1}  | ${"2024-06-15T09:29:00-05:00[America/Chicago]"}
    ${"2024-06-15T09:30:00-05:00[America/Chicago]"} | ${"second"} | ${-1}  | ${"2024-06-15T09:30:59-05:00[America/Chicago]"}
  `(
    "returns $expected for $value cycling $field by $amount",
    ({ value, field, amount, expected }) => {
      expect(cycleZoned(value, field, amount)).toBe(expected);
    },
  );

  it.each`
    value                                           | field      | amount | expected                                        | label
    ${"2024-12-15T09:30:00-06:00[America/Chicago]"} | ${"month"} | ${1}   | ${"2024-01-15T09:30:00-06:00[America/Chicago]"} | ${"month wraps within the same year"}
    ${"2024-06-15T23:30:00-05:00[America/Chicago]"} | ${"hour"}  | ${1}   | ${"2024-06-15T00:30:00-05:00[America/Chicago]"} | ${"hour wraps within the same day (non-DST date)"}
    ${"2024-06-30T09:00:00-05:00[America/Chicago]"} | ${"day"}   | ${1}   | ${"2024-06-01T09:00:00-05:00[America/Chicago]"} | ${"day wraps within the same month (30-day month)"}
  `(
    "wraps at the field boundary ($label): $value cycling $field by $amount -> $expected",
    ({ value, field, amount, expected }) => {
      expect(cycleZoned(value, field, amount)).toBe(expected);
    },
  );

  it("returns the value unchanged when amount is 0", () => {
    expect(
      cycleZoned("2024-06-15T09:30:00-05:00[America/Chicago]", "hour", 0),
    ).toBe("2024-06-15T09:30:00-05:00[America/Chicago]");
  });

  it.each`
    value                                           | field      | amount | overflow     | expected
    ${"2024-01-31T09:00:00-06:00[America/Chicago]"} | ${"month"} | ${1}   | ${undefined} | ${"2024-02-29T09:00:00-06:00[America/Chicago]"}
    ${"2024-01-31T09:00:00-06:00[America/Chicago]"} | ${"month"} | ${1}   | ${"reject"}  | ${""}
  `(
    "returns $expected for $value cycling $field by $amount with overflow $overflow",
    ({ value, field, amount, overflow, expected }) => {
      expect(cycleZoned(value, field, amount, { overflow })).toBe(expected);
    },
  );

  it.each`
    amount | round    | expected
    ${15}  | ${false} | ${"2024-06-15T09:37:00-05:00[America/Chicago]"}
    ${15}  | ${true}  | ${"2024-06-15T09:30:00-05:00[America/Chicago]"}
  `(
    "returns $expected cycling minute by $amount with round: $round",
    ({ amount, round, expected }) => {
      expect(
        cycleZoned(
          "2024-06-15T09:22:00-05:00[America/Chicago]",
          "minute",
          amount,
          { round },
        ),
      ).toBe(expected);
    },
  );

  it.each`
    field
    ${"week"}
    ${"invalid"}
    ${""}
  `("returns an empty string for an invalid field $field", ({ field }) => {
    expect(
      cycleZoned("2024-06-15T09:30:00-05:00[America/Chicago]", field, 1),
    ).toBe("");
  });

  it.each`
    invalidValue
    ${"invalid-zoned-datetime"}
    ${"2024-02-30T12:00:00-05:00[America/New_York]"}
    ${"2024-03-10T12:00:00"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
  `(
    "returns an empty string for an invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(cycleZoned(invalidValue, "hour", 1)).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} when cycling a field`, () => {
      expect(parseTimeZoneFromZoned(cycleZoned(value, "hour", 1))).toBe(
        timeZone,
      );
    });
  }

  it(`covers all ${battleTestTimeZones.length} battle-test timeZones`, () => {
    expect(localNoonBattleCases.length).toBe(battleTestTimeZones.length);
  });

  // offset defaults to "prefer", as Temporal's ZonedDateTime#with does: disambiguation "reject" with
  // the default or "prefer" keeps the source's still-valid offset and does not throw, while offset
  // "ignore" re-resolves the wall time, so "reject" fires (returns ""). Cycling hour +1 from the
  // hour just before a fall-back overlap lands squarely on the ambiguous repeated local hour.
  it.each`
    timeZone             | value                                           | offset       | expected
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${undefined} | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${"ignore"}  | ${""}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${"prefer"}  | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${undefined} | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${"ignore"}  | ${""}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${"prefer"}  | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
  `(
    "with disambiguation reject and offset $offset, returns $expected cycling hour +1 into the fall-back overlap in $timeZone",
    ({ value, offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { disambiguation: "reject" as const }
          : { disambiguation: "reject" as const, offset };
      expect(cycleZoned(value, "hour", 1, optionsArg)).toBe(expected);
    },
  );

  // Spring-forward gap: cycling hour +1 lands on the nonexistent local hour.
  it.each`
    timeZone             | value                                           | disambiguation  | expected
    ${"America/Chicago"} | ${"2024-03-10T01:30:00-06:00[America/Chicago]"} | ${undefined}    | ${"2024-03-10T03:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:30:00-06:00[America/Chicago]"} | ${"compatible"} | ${"2024-03-10T03:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:30:00-06:00[America/Chicago]"} | ${"earlier"}    | ${"2024-03-10T01:30:00-06:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:30:00-06:00[America/Chicago]"} | ${"later"}      | ${"2024-03-10T03:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:30:00-06:00[America/Chicago]"} | ${"reject"}     | ${""}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}   | ${undefined}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}   | ${"compatible"} | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}   | ${"earlier"}    | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}   | ${"later"}      | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}   | ${"reject"}     | ${""}
  `(
    "resolves spring-forward gap for $value cycling hour +1 with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(cycleZoned(value, "hour", 1, optionsArg)).toBe(expected);
    },
  );

  // Fall-back overlap: cycling hour +1 lands on the ambiguous repeated local hour.
  // offset defaults to "prefer" (Temporal ZonedDateTime#with): the source's offset is still valid on
  // the repeated hour, so it is kept and disambiguation is not consulted; offset "ignore" re-resolves
  // the wall time through disambiguation. Expected values checked with Temporal ZonedDateTime#with.
  it.each`
    timeZone             | value                                           | offset       | disambiguation  | expected
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${undefined} | ${undefined}    | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${undefined} | ${"compatible"} | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${undefined} | ${"earlier"}    | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${undefined} | ${"later"}      | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${undefined} | ${"reject"}     | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${undefined} | ${undefined}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${undefined} | ${"compatible"} | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${undefined} | ${"earlier"}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${undefined} | ${"later"}      | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${undefined} | ${"reject"}     | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${"ignore"}  | ${undefined}    | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${"ignore"}  | ${"compatible"} | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${"ignore"}  | ${"earlier"}    | ${"2024-11-03T01:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${"ignore"}  | ${"later"}      | ${"2024-11-03T01:30:00-06:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-03T00:30:00-05:00[America/Chicago]"} | ${"ignore"}  | ${"reject"}     | ${""}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${"ignore"}  | ${undefined}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${"ignore"}  | ${"compatible"} | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${"ignore"}  | ${"earlier"}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${"ignore"}  | ${"later"}      | ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T01:30:00+02:00[Europe/Berlin]"}   | ${"ignore"}  | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap for $value cycling hour +1 with offset $offset and disambiguation $disambiguation to $expected",
    ({ value, offset, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined && offset === undefined
          ? undefined
          : { disambiguation, offset };
      expect(cycleZoned(value, "hour", 1, optionsArg)).toBe(expected);
    },
  );

  // `amount` must be a finite number (isValidAmount); anything else is invalid input, never 0.
  it.each`
    amount
    ${null}
    ${undefined}
    ${""}
    ${"1"}
    ${[]}
    ${{}}
    ${true}
    ${Number.NaN}
    ${Number.POSITIVE_INFINITY}
  `(
    "returns an empty string for a non-finite-number amount $amount",
    ({ amount }) => {
      expect(
        cycleZoned(
          "2024-06-15T09:30:00-05:00[America/Chicago]",
          "hour",
          amount,
        ),
      ).toBe("");
    },
  );
});
