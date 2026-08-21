import { battleTestTimeZones, localNoonBattleCases } from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { setZoned } from "./setZoned";

describe("setZoned", () => {
  it.each`
    value                                            | fields                     | expected
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${{ year: 2025 }}          | ${"2025-03-10T12:00:00-04:00[America/New_York]"}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${{ month: 6 }}            | ${"2024-06-10T12:00:00-04:00[America/New_York]"}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${{ day: 20 }}             | ${"2024-03-20T12:00:00-04:00[America/New_York]"}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${{ hour: 9 }}             | ${"2024-03-10T09:00:00-04:00[America/New_York]"}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${{ minute: 45 }}          | ${"2024-03-10T12:45:00-04:00[America/New_York]"}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${{ year: 2025, hour: 9 }} | ${"2025-03-10T09:00:00-04:00[America/New_York]"}
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${{}}                      | ${"2024-03-10T12:00:00-04:00[America/New_York]"}
  `(
    "returns $expected for $value with fields $fields",
    ({ value, fields, expected }) => {
      expect(setZoned(value, fields)).toBe(expected);
    },
  );

  it("resolves multi-field updates atomically regardless of field order in the object", () => {
    const value = "2024-01-31T12:00:00-05:00[America/New_York]";
    const monthThenDay = setZoned(value, { month: 2, day: 5 });
    const dayThenMonth = setZoned(value, { day: 5, month: 2 });
    expect(monthThenDay).toBe("2024-02-05T12:00:00-05:00[America/New_York]");
    expect(dayThenMonth).toBe("2024-02-05T12:00:00-05:00[America/New_York]");
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
    "returns an empty string for an invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(setZoned(invalidValue, { hour: 9 })).toBe("");
    },
  );

  it.each`
    value                                            | fields          | overflow       | expected
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ month: 2 }} | ${undefined}   | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ month: 2 }} | ${"constrain"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ month: 2 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value with fields $fields and overflow $overflow",
    ({ value, fields, overflow, expected }) => {
      expect(
        setZoned(
          value,
          fields,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} when setting a field`, () => {
      expect(parseTimeZoneFromZoned(setZoned(value, { hour: 9 }))).toBe(
        timeZone,
      );
    });
  }

  it(`covers all ${battleTestTimeZones.length} battle-test timeZones`, () => {
    expect(localNoonBattleCases.length).toBe(battleTestTimeZones.length);
  });

  // The C3 silent-no-op trap regression pairing (required by J1's Definition of Done):
  // disambiguation:"reject" with the default offset:"ignore" throws (returns ""), while
  // disambiguation:"reject" with offset:"prefer" does NOT throw, because the source's
  // still-valid offset is kept and disambiguation is never consulted.
  it.each`
    timeZone             | value                                           | offset       | expected
    ${"America/Chicago"} | ${"2024-11-03T01:45:00-05:00[America/Chicago]"} | ${undefined} | ${""}
    ${"America/Chicago"} | ${"2024-11-03T01:45:00-05:00[America/Chicago]"} | ${"ignore"}  | ${""}
    ${"America/Chicago"} | ${"2024-11-03T01:45:00-05:00[America/Chicago]"} | ${"prefer"}  | ${"2024-11-03T01:00:00-05:00[America/Chicago]"}
    ${"Europe/Berlin"}   | ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}   | ${undefined} | ${""}
    ${"Europe/Berlin"}   | ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}   | ${"ignore"}  | ${""}
    ${"Europe/Berlin"}   | ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}   | ${"prefer"}  | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
  `(
    "with disambiguation reject and offset $offset, returns $expected for the fall-back overlap in $timeZone",
    ({ value, offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { disambiguation: "reject" as const }
          : { disambiguation: "reject" as const, offset };
      expect(setZoned(value, { minute: 0 }, optionsArg)).toBe(expected);
    },
  );

  it("produces genuinely different output across disambiguation values on a fall-back overlap (regression guard against offset:prefer silently no-opping disambiguation)", () => {
    const value = "2024-11-03T01:45:00-05:00[America/Chicago]";
    const compatible = setZoned(
      value,
      { minute: 0 },
      {
        disambiguation: "compatible",
      },
    );
    const later = setZoned(value, { minute: 0 }, { disambiguation: "later" });
    const rejected = setZoned(
      value,
      { minute: 0 },
      {
        disambiguation: "reject",
      },
    );

    expect(compatible).not.toBe(later);
    expect(rejected).toBe("");
  });

  // Spring-forward gap: setting hour/minute directly onto the nonexistent local time
  it.each`
    timeZone             | value                                           | fields                     | disambiguation  | expected
    ${"America/Chicago"} | ${"2024-03-10T01:00:00-06:00[America/Chicago]"} | ${{ hour: 2, minute: 30 }} | ${undefined}    | ${"2024-03-10T03:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:00:00-06:00[America/Chicago]"} | ${{ hour: 2, minute: 30 }} | ${"compatible"} | ${"2024-03-10T03:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:00:00-06:00[America/Chicago]"} | ${{ hour: 2, minute: 30 }} | ${"earlier"}    | ${"2024-03-10T01:30:00-06:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:00:00-06:00[America/Chicago]"} | ${{ hour: 2, minute: 30 }} | ${"later"}      | ${"2024-03-10T03:30:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-03-10T01:00:00-06:00[America/Chicago]"} | ${{ hour: 2, minute: 30 }} | ${"reject"}     | ${""}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:00:00+01:00[Europe/Berlin]"}   | ${{ hour: 2, minute: 30 }} | ${undefined}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:00:00+01:00[Europe/Berlin]"}   | ${{ hour: 2, minute: 30 }} | ${"compatible"} | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:00:00+01:00[Europe/Berlin]"}   | ${{ hour: 2, minute: 30 }} | ${"earlier"}    | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:00:00+01:00[Europe/Berlin]"}   | ${{ hour: 2, minute: 30 }} | ${"later"}      | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-03-31T01:00:00+01:00[Europe/Berlin]"}   | ${{ hour: 2, minute: 30 }} | ${"reject"}     | ${""}
  `(
    "resolves spring-forward gap for $value with fields $fields and disambiguation $disambiguation to $expected",
    ({ value, fields, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(setZoned(value, fields, optionsArg)).toBe(expected);
    },
  );

  // Fall-back overlap: the arithmetic result of + 1 day lands on the ambiguous repeated local time
  it.each`
    timeZone             | value                                           | disambiguation  | expected
    ${"America/Chicago"} | ${"2024-11-02T01:45:00-05:00[America/Chicago]"} | ${undefined}    | ${"2024-11-03T01:45:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-02T01:45:00-05:00[America/Chicago]"} | ${"compatible"} | ${"2024-11-03T01:45:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-02T01:45:00-05:00[America/Chicago]"} | ${"earlier"}    | ${"2024-11-03T01:45:00-05:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-02T01:45:00-05:00[America/Chicago]"} | ${"later"}      | ${"2024-11-03T01:45:00-06:00[America/Chicago]"}
    ${"America/Chicago"} | ${"2024-11-02T01:45:00-05:00[America/Chicago]"} | ${"reject"}     | ${""}
    ${"Europe/Berlin"}   | ${"2024-10-26T02:45:00+02:00[Europe/Berlin]"}   | ${undefined}    | ${"2024-10-27T02:45:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-26T02:45:00+02:00[Europe/Berlin]"}   | ${"compatible"} | ${"2024-10-27T02:45:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-26T02:45:00+02:00[Europe/Berlin]"}   | ${"earlier"}    | ${"2024-10-27T02:45:00+02:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-26T02:45:00+02:00[Europe/Berlin]"}   | ${"later"}      | ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}
    ${"Europe/Berlin"}   | ${"2024-10-26T02:45:00+02:00[Europe/Berlin]"}   | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap for $value + day:+1 with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      const day = Number(value.slice(8, 10)) + 1;
      expect(setZoned(value, { day }, optionsArg)).toBe(expected);
    },
  );

  it("returns an empty string when the with() call throws for a malformed fields object", () => {
    expect(
      setZoned("2024-03-10T12:00:00-04:00[America/New_York]", {
        hour: Number.NaN,
      }),
    ).toBe("");
  });
});
