import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import { readFormOffsetInstant, readOffsetInstant } from "./offsetInstant";

// Expected pairs are Temporal's own readings (`Temporal.Instant.from`, and
// `Temporal.ZonedDateTime.from` where a zone is bracketed); toOffsetInstant.test.ts holds the
// full table for the reading both share.
describe("readOffsetInstant", () => {
  it.each`
    value                                           | timeZone           | reason
    ${"2024-07-15T16:00:00+05:30"}                  | ${undefined}       | ${"a written offset"}
    ${"2024-07-15T16:00:00Z"}                       | ${"Europe/London"} | ${"read in a zone"}
    ${"1969-12-31T23:15:30-00:45[Africa/Monrovia]"} | ${undefined}       | ${"a sub-minute zone"}
    ${"2024-07-15T12:00:00+00:00[Europe/London]"}   | ${undefined}       | ${"an offset the zone contradicts"}
    ${"2024-06-15T10Z"}                             | ${undefined}       | ${"an hour-only time"}
    ${"2024-07-15T16:00:00Z"}                       | ${"Invalid/Zone"}  | ${"an unknown zone"}
  `(
    "is what toOffsetInstant returns for '$value' ($reason)",
    ({ value, timeZone }: { value: string; timeZone: string | undefined }) => {
      expect(readOffsetInstant(value, timeZone)).toStrictEqual(
        toOffsetInstant(value, timeZone),
      );
    },
  );
});

// ISO 8601-1 §5.3.1.3 reduced precision: Temporal reads an hour-only time
// (`Temporal.Instant.from("2024-06-15T10Z")` is `2024-06-15T10:00:00Z`).
describe("readFormOffsetInstant", () => {
  it.each`
    value                              | instant                   | offset      | timeZone
    ${"2024-06-15T10Z"}                | ${"2024-06-15T10:00:00Z"} | ${"+00:00"} | ${undefined}
    ${"2024-06-15T23-05:00"}           | ${"2024-06-16T04:00:00Z"} | ${"-05:00"} | ${undefined}
    ${"2024-06-15T10-00:00"}           | ${"2024-06-15T10:00:00Z"} | ${"+00:00"} | ${undefined}
    ${"2024-06-15T23Z[Europe/Berlin]"} | ${"2024-06-15T23:00:00Z"} | ${"+02:00"} | ${"Europe/Berlin"}
    ${"2024-06-15T10-04:00[-04:00]"}   | ${"2024-06-15T14:00:00Z"} | ${"-04:00"} | ${undefined}
  `(
    "reads the hour '$value' as $instant at $offset",
    ({ value, instant, offset, timeZone }) => {
      const expected =
        timeZone === undefined
          ? { instant, offset }
          : { instant, offset, timeZone };
      expect(readFormOffsetInstant(value, "hour")).toStrictEqual(expected);
    },
  );

  it.each`
    value                                   | reason
    ${"2024-06-15T10+00:00[Europe/Berlin]"} | ${"an offset the zone contradicts"}
    ${"2024-06-15T10Z[!foo=bar]"}           | ${"an unknown critical annotation"}
    ${"2024-06-15T24Z"}                     | ${"hour 24"}
    ${"2024-02-30T10Z"}                     | ${"no such day"}
  `("returns null for the hour '$value' ($reason)", ({ value }) => {
    expect(readFormOffsetInstant(value, "hour")).toBeNull();
  });

  it.each`
    value                                         | written
    ${"2024-06-15T10:30-05:00"}                   | ${"minute"}
    ${"2024-06-15T10:30:00Z"}                     | ${"second"}
    ${"2024-06-15T10:30:00.5+02:00"}              | ${"fraction"}
    ${"2024-07-15T12:00:00+00:00[Europe/London]"} | ${"second"}
  `(
    "reads the $written form '$value' as readOffsetInstant does",
    ({ value, written }) => {
      expect(readFormOffsetInstant(value, written)).toStrictEqual(
        readOffsetInstant(value),
      );
    },
  );
});
