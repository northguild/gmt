import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import {
  readFormOffsetInstant,
  readInstantOffsetInstant,
  readZonedOffsetInstant,
} from "./offsetInstant";

// Expected pairs are Temporal's own readings (`Temporal.Instant.from`, and
// `Temporal.ZonedDateTime.from` where a zone is bracketed); toOffsetInstant.test.ts holds the
// full table for the reading both share.
// Each of the two exact readers takes only its own kind; toOffsetInstant tries the instant reader,
// then the zoned one.
describe("the exact offset readers", () => {
  it.each`
    value                          | timeZone           | reason
    ${"2024-07-15T16:00:00+05:30"} | ${undefined}       | ${"a written offset"}
    ${"2024-07-15T16:00:00Z"}      | ${"Europe/London"} | ${"read in a zone"}
    ${"2024-07-15T16:00:00Z"}      | ${"Invalid/Zone"}  | ${"an unknown zone"}
  `(
    "readInstantOffsetInstant is what toOffsetInstant returns for '$value' ($reason)",
    ({ value, timeZone }: { value: string; timeZone: string | undefined }) => {
      expect(readInstantOffsetInstant(value, timeZone)).toStrictEqual(
        toOffsetInstant(value, timeZone),
      );
    },
  );

  it.each`
    value                                           | timeZone           | reason
    ${"1969-12-31T23:15:30-00:45[Africa/Monrovia]"} | ${undefined}       | ${"a sub-minute zone"}
    ${"2024-07-15T16:00:00+05:30[Asia/Kolkata]"}    | ${undefined}       | ${"a zone that agrees"}
    ${"2024-07-15T16:00:00+05:30[Asia/Kolkata]"}    | ${"Europe/London"} | ${"read in another zone"}
    ${"2024-07-15T12:00:00+00:00[Europe/London]"}   | ${undefined}       | ${"an offset the zone contradicts"}
  `(
    "readZonedOffsetInstant is what toOffsetInstant returns for '$value' ($reason)",
    ({ value, timeZone }: { value: string; timeZone: string | undefined }) => {
      expect(readZonedOffsetInstant(value, timeZone)).toStrictEqual(
        toOffsetInstant(value, timeZone),
      );
    },
  );

  it.each`
    value                                        | reason
    ${"2024-07-15T16:00:00+05:30[Asia/Kolkata]"} | ${"a zoned string"}
    ${"2024-07-15T16:00:00Z[Europe/London]"}     | ${"a Z instant with a zone"}
    ${"2024-07-15T16:00:00Z[foo=bar]"}           | ${"an elective annotation"}
    ${"2024-07-15T16:00:00Zjunk"}                | ${"trailing text"}
    ${"2024-07-15T16:00:00Z "}                   | ${"trailing whitespace"}
    ${"2024-06-15T10Z"}                          | ${"an hour-only time"}
  `(
    "readInstantOffsetInstant returns null for '$value' ($reason)",
    ({ value }) => {
      expect(readInstantOffsetInstant(value)).toBeNull();
    },
  );

  it.each`
    value                                  | reason
    ${"2024-07-15T16:00:00+05:30"}         | ${"an offset instant, no bracket"}
    ${"2024-07-15T16:00:00Z"}              | ${"a Z instant, no bracket"}
    ${"2024-07-15T16:00:00[Asia/Kolkata]"} | ${"a bracket and no offset"}
  `(
    "readZonedOffsetInstant returns null for '$value' ($reason)",
    ({ value }) => {
      expect(readZonedOffsetInstant(value)).toBeNull();
    },
  );
});

// ISO 8601-1 §5.3.1.3 reduced precision: Temporal reads an hour-only time
// (`Temporal.Instant.from("2024-06-15T10Z")` is `2024-06-15T10:00:00Z`).
describe("readFormOffsetInstant", () => {
  it.each`
    value                    | instant                   | offset
    ${"2024-06-15T10Z"}      | ${"2024-06-15T10:00:00Z"} | ${"+00:00"}
    ${"2024-06-15T23-05:00"} | ${"2024-06-16T04:00:00Z"} | ${"-05:00"}
    ${"2024-06-15T10-00:00"} | ${"2024-06-15T10:00:00Z"} | ${"+00:00"}
  `(
    "reads the hour '$value' as $instant at $offset",
    ({ value, instant, offset }) => {
      expect(readFormOffsetInstant(value, "hour")).toStrictEqual({
        instant,
        offset,
      });
    },
  );

  it.each`
    value                                   | reason
    ${"2024-06-15T10+00:00[Europe/Berlin]"} | ${"a zone annotation"}
    ${"2024-06-15T10Z[Europe/Berlin]"}      | ${"a zone annotation that agrees"}
    ${"2024-06-15T10-04:00[-04:00]"}        | ${"an offset annotation"}
    ${"2024-06-15T10Z[!foo=bar]"}           | ${"an unknown critical annotation"}
    ${"2024-06-15T10Zjunk"}                 | ${"trailing text"}
    ${"2024-06-15T10Z "}                    | ${"trailing whitespace"}
    ${"2024-06-15T24Z"}                     | ${"hour 24"}
    ${"2024-02-30T10Z"}                     | ${"no such day"}
  `("returns null for the hour '$value' ($reason)", ({ value }) => {
    expect(readFormOffsetInstant(value, "hour")).toBeNull();
  });

  it.each`
    value                            | written
    ${"2024-06-15T10:30-05:00"}      | ${"minute"}
    ${"2024-06-15T10:30:00Z"}        | ${"second"}
    ${"2024-06-15T10:30:00.5+02:00"} | ${"fraction"}
  `(
    "reads the $written form '$value' as readInstantOffsetInstant does",
    ({ value, written }) => {
      expect(readFormOffsetInstant(value, written)).toStrictEqual(
        readInstantOffsetInstant(value),
      );
    },
  );
});
