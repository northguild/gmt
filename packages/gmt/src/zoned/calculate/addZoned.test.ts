import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, localNoonBattleCases } from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { addZoned } from "./addZoned";

// Local Jan 31 noon in each battle-test timeZone — used for overflow (month-end) tests.
const localJan31NoonBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 1,
    day: 31,
    hour: 12,
    minute: 0,
    second: 0,
    timeZone,
  }).toString(),
}));

describe("addZoned", () => {
  it.each`
    value                               | amount | unit             | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"year"}        | ${"2025-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"month"}       | ${"2024-03-29T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"week"}        | ${"2024-03-14T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"day"}         | ${"2024-03-01T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"hour"}        | ${"2024-02-29T16:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"minute"}      | ${"2024-02-29T15:15:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"second"}      | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${250} | ${"millisecond"} | ${"2024-02-29T14:30:00.25+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"microsecond"} | ${"2024-02-29T14:30:00.000001+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"nanosecond"}  | ${"2024-02-29T14:30:00.000000001+00:00[UTC]"}
  `(
    "returns $expected for $value + $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(addZoned(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"}                 | ${"2025-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[GMT]"}                 | ${"2025-02-28T14:30:00+00:00[GMT]"}
    ${"2024-02-29T14:30:00+00:00[Etc/GMT]"}             | ${"2025-02-28T14:30:00+00:00[Etc/GMT]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Lisbon]"}       | ${"2025-02-28T14:30:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Dublin]"}       | ${"2025-02-28T14:30:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T14:30:00+01:00[Europe/Berlin]"}       | ${"2025-02-28T14:30:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T14:30:00+02:00[Europe/Helsinki]"}     | ${"2025-02-28T14:30:00+02:00[Europe/Helsinki]"}
    ${"2024-02-29T14:30:00+03:00[Europe/Istanbul]"}     | ${"2025-02-28T14:30:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}        | ${"2025-02-28T14:30:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T14:30:00+05:45[Asia/Kathmandu]"}      | ${"2025-02-28T14:30:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T14:30:00+08:00[Asia/Shanghai]"}       | ${"2025-02-28T14:30:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T14:30:00+11:00[Australia/Lord_Howe]"} | ${"2025-02-28T14:30:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T14:30:00+13:45[Pacific/Chatham]"}     | ${"2025-02-28T14:30:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T14:30:00+13:00[Pacific/Apia]"}        | ${"2025-02-28T14:30:00+13:00[Pacific/Apia]"}
    ${"2024-02-29T14:30:00-11:00[Pacific/Niue]"}        | ${"2025-02-28T14:30:00-11:00[Pacific/Niue]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"}    | ${"2025-02-28T14:30:00-05:00[America/New_York]"}
    ${"2024-02-29T14:30:00-06:00[America/Chicago]"}     | ${"2025-02-28T14:30:00-06:00[America/Chicago]"}
    ${"2024-02-29T14:30:00-07:00[America/Phoenix]"}     | ${"2025-02-28T14:30:00-07:00[America/Phoenix]"}
  `(
    "works across ordered battle-test timeZones for $value",
    ({ value, expected }) => {
      // just add 365 days to leap day
      expect(addZoned(value, { days: 365 })).toBe(expected);
    },
  );

  it.each`
    value                               | amount | unit        | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-1}  | ${"hour"}   | ${"2024-02-29T13:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-30} | ${"minute"} | ${"2024-02-29T14:00:00+00:00[UTC]"}
  `(
    "returns $expected for negative amount $amount",
    ({ value, amount, unit, expected }) => {
      expect(addZoned(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(addZoned(invalidValue as never, { hours: 1 } as never)).toBe("");
    },
  );

  it.each`
    invalidAmount
    ${NaN}
    ${null}
    ${undefined}
    ${"1"}
  `(
    "returns an empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addZoned("2024-02-29T14:30:00+00:00[UTC]", {
          hours: invalidAmount as never,
        } as never),
      ).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"timeZone"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(
        addZoned("2024-02-29T14:30:00+00:00[UTC]", {
          [String(invalidUnit)]: 1,
        } as never),
      ).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} when adding`, () => {
      expect(parseTimeZoneFromZoned(addZoned(value, { hours: 1 }))).toBe(
        timeZone,
      );
    });
  }

  // disambiguation: fall-back overlap (result of + 1 day lands on an ambiguous local time)
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${undefined}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"compatible"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"earlier"}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"later"}      | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"reject"}     | ${""}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}    | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap for $value + 1 day with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(addZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // disambiguation: spring-forward gap (result of + 1 day lands on a nonexistent local time,
  // but Temporal's arithmetic already advances past it, so disambiguation has no effect)
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${undefined}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"compatible"} | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"earlier"}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"later"}      | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"reject"}     | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}    | ${"reject"}     | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
  `(
    "spring-forward gap for $value + 1 day is unaffected by disambiguation $disambiguation, returns $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(addZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // offset is accepted but inert: the internal rebuild step reconstructs from a plain datetime
  // string with no offset embedded, so every offset value produces identical output
  it.each`
    offset
    ${undefined}
    ${"prefer"}
    ${"use"}
    ${"ignore"}
    ${"reject"}
  `(
    "produces identical output regardless of offset $offset (inert on this function)",
    ({ offset }) => {
      const value = "2024-11-02T01:30:00-04:00[America/New_York]";
      const withoutOffset = addZoned(
        value,
        { days: 1 },
        { disambiguation: "later" },
      );
      const withOffset = addZoned(
        value,
        { days: 1 },
        { disambiguation: "later", offset },
      );
      expect(withOffset).toBe(withoutOffset);
    },
  );

  for (const { timeZone, value } of localJan31NoonBattleCases) {
    it(`clamps out-of-range results with the default overflow (constrain) across battle-test timeZone ${timeZone}`, () => {
      const result = addZoned(value, { months: 1 });
      expect(result).not.toBe("");
      expect(parseTimeZoneFromZoned(result)).toBe(timeZone);
      expect(result.startsWith("2024-02-29T12:00:00")).toBe(true);
    });

    it(`returns an empty string when overflow is reject and the result is out of range across battle-test timeZone ${timeZone}`, () => {
      expect(addZoned(value, { months: 1 }, { overflow: "reject" })).toBe("");
    });
  }

  it.each`
    value                                            | units             | overflow       | expected
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${undefined}   | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ years: 1 }}   | ${undefined}   | ${"2025-02-28T12:00:00-05:00[America/New_York]"}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${"reject"}    | ${"2024-02-15T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${undefined}   | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value + $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        addZoned(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it("does not reject a non-overflowing add across a DST transition (overflow is orthogonal to disambiguation)", () => {
    // Feb 10 + 1 month = Mar 10, a valid date; the add also happens to cross the NY spring-forward
    // boundary (Mar 10 2024), but since the day-of-month never overflows, overflow: "reject" never fires.
    expect(
      addZoned(
        "2024-02-10T02:30:00-05:00[America/New_York]",
        { months: 1 },
        { overflow: "reject" },
      ),
    ).toBe("2024-03-10T03:30:00-04:00[America/New_York]");
  });

  it("succeeds when overflow (constrain) and disambiguation (reject) are both provided but only overflow is actually triggered", () => {
    expect(
      addZoned(
        "2024-01-31T12:00:00-05:00[America/New_York]",
        { months: 1 },
        { overflow: "constrain", disambiguation: "reject" },
      ),
    ).toBe("2024-02-29T12:00:00-05:00[America/New_York]");
  });
});
