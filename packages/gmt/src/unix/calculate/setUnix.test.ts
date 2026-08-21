import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { setUnix } from "./setUnix";

describe("setUnix", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    value            | fields            | options                     | expected
    ${1709208000000} | ${{ hour: 9 }}    | ${undefined}                | ${1709197200000}
    ${1709208000000} | ${{ year: 2025 }} | ${undefined}                | ${1740744000000}
    ${1706702400}    | ${{ month: 2 }}   | ${{ epochUnit: "seconds" }} | ${1709208000}
    ${1709208000000} | ${{}}             | ${undefined}                | ${1709208000000}
  `(
    "returns $expected for $value with fields $fields and options $options",
    ({ value, fields, options, expected }) => {
      expect(setUnix(value, fields, options)).toBe(expected);
    },
  );

  it.each`
    value            | fields         | options
    ${"invalid"}     | ${{ hour: 9 }} | ${undefined}
    ${1.5}           | ${{ hour: 9 }} | ${undefined}
    ${null}          | ${{ hour: 9 }} | ${undefined}
    ${NaN}           | ${{ hour: 9 }} | ${undefined}
    ${1709208000000} | ${{ hour: 9 }} | ${{ timeZone: "Invalid/Zone" }}
  `("returns null for invalid input", ({ value, fields, options }) => {
    expect(setUnix(value as never, fields, options)).toBeNull();
  });

  it.each`
    value            | fields          | overflow       | expected
    ${1706702400000} | ${{ month: 2 }} | ${undefined}   | ${1709208000000}
    ${1706702400000} | ${{ month: 2 }} | ${"constrain"} | ${1709208000000}
    ${1706702400000} | ${{ month: 2 }} | ${"reject"}    | ${null}
  `(
    "returns $expected for $value with fields $fields and overflow $overflow",
    ({ value, fields, overflow, expected }) => {
      expect(
        setUnix(
          value,
          fields,
          overflow === undefined
            ? { timeZone: "UTC" }
            : { timeZone: "UTC", overflow },
        ),
      ).toBe(expected);
    },
  );

  it("resolves multi-field updates atomically regardless of field order in the object", () => {
    const value = Date.UTC(2024, 0, 31, 12, 0, 0);
    const monthThenDay = setUnix(
      value,
      { month: 2, day: 5 },
      { timeZone: "UTC" },
    );
    const dayThenMonth = setUnix(
      value,
      { day: 5, month: 2 },
      { timeZone: "UTC" },
    );
    expect(monthThenDay).toBe(Date.UTC(2024, 1, 5, 12, 0, 0));
    expect(dayThenMonth).toBe(Date.UTC(2024, 1, 5, 12, 0, 0));
  });

  // The C3 silent-no-op trap regression pairing: disambiguation:"reject" with the default
  // offset:"ignore" throws (returns null), while offset:"prefer" does NOT throw.
  it.each`
    timeZone             | epoch            | offset       | expected
    ${"America/Chicago"} | ${1730616300000} | ${undefined} | ${null}
    ${"America/Chicago"} | ${1730616300000} | ${"ignore"}  | ${null}
    ${"America/Chicago"} | ${1730616300000} | ${"prefer"}  | ${1730613600000}
  `(
    "with disambiguation reject and offset $offset, returns $expected for $timeZone",
    ({ timeZone, epoch, offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { timeZone, disambiguation: "reject" as const }
          : { timeZone, disambiguation: "reject" as const, offset };
      expect(setUnix(epoch, { minute: 0 }, optionsArg)).toBe(expected);
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`resolves month-end overflow for battle-test timeZone ${timeZone}`, () => {
      const value = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 3,
        day: 31,
        hour: 12,
        minute: 0,
        second: 0,
        timeZone,
      }).epochMilliseconds;

      const constrained = setUnix(
        value,
        { month: 2 },
        { timeZone, overflow: "constrain" },
      );
      expect(constrained).not.toBeNull();

      const rejected = setUnix(
        value,
        { month: 2 },
        { timeZone, overflow: "reject" },
      );
      expect(rejected).toBeNull();
    });
  }

  it("returns null when the with() call throws for a malformed fields object", () => {
    expect(
      setUnix(1709208000000, { hour: Number.NaN }, { timeZone: "UTC" }),
    ).toBeNull();
  });
});
