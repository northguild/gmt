import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { readYearWindowStart } from "./yearWindowStart";

describe("readYearWindowStart", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setNow(instant: string): void {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from(instant),
    );
  }

  it.each`
    yearWindow | expected | description
    ${2000}    | ${2000}  | ${"a century-aligned window"}
    ${1950}    | ${1950}  | ${"a window that straddles a century"}
    ${0}       | ${0}     | ${"the lowest allowed start"}
    ${9900}    | ${9900}  | ${"the highest start whose every year is four digits"}
  `(
    "reads yearWindow $yearWindow as $expected ($description)",
    ({ yearWindow, expected }) => {
      expect(readYearWindowStart({ yearWindow })).toBe(expected);
    },
  );

  it.each`
    yearWindow                  | description
    ${undefined}                | ${"absent: no window, the caller decides whether that matters"}
    ${null}                     | ${"null"}
    ${1.5}                      | ${"a non-integer"}
    ${-1}                       | ${"negative"}
    ${9901}                     | ${"one past the highest four-digit window"}
    ${Number.NaN}               | ${"NaN"}
    ${Number.POSITIVE_INFINITY} | ${"Infinity"}
    ${Number.NEGATIVE_INFINITY} | ${"-Infinity"}
    ${"2000"}                   | ${"a numeric string"}
    ${"Rolling"}                | ${"wrong case: the match is exact"}
    ${"rolling "}               | ${"a trailing space: the match is exact"}
    ${"roll"}                   | ${"a prefix"}
    ${true}                     | ${"a boolean"}
    ${[2000]}                   | ${"an array"}
  `(
    "returns null for yearWindow $yearWindow ($description)",
    ({ yearWindow }) => {
      expect(readYearWindowStart({ yearWindow })).toBeNull();
    },
  );

  it.each`
    options      | description
    ${undefined} | ${"omitted"}
    ${null}      | ${"null"}
    ${"x"}       | ${"a string"}
    ${1}         | ${"a number"}
    ${{}}        | ${"an empty bag"}
  `("returns null when options is $description", ({ options }) => {
    expect(readYearWindowStart(options)).toBeNull();
  });

  it("reads a function carrying yearWindow as the object it is", () => {
    expect(
      readYearWindowStart(Object.assign(() => undefined, { yearWindow: 1950 })),
    ).toBe(1950);
  });

  // GMT rule: a rolling window is year-granular, 50 years before the current UTC calendar year
  // to 49 after it. 2050 - 50 = 2000, so the window moves from 1999–2098 to 2000–2099 at the
  // UTC new year, not mid-year. The last two rows are instants whose local date and UTC date
  // fall in different years: 22:00Z on 31 December 2049, when a clock two hours east already
  // reads 2050, and 04:59:59Z on 1 January 2050, when a clock five hours west still reads 2049.
  // The UTC year decides. (CI runs this suite under ten system time zones, from Pacific/Niue to
  // Pacific/Apia, so a rule that read the system zone's year fails there on the rows at the UTC
  // new year.)
  it.each`
    now                            | expected
    ${"2026-10-07T12:00:00Z"}      | ${1976}
    ${"2026-01-01T00:00:00Z"}      | ${1976}
    ${"2026-12-31T23:59:59Z"}      | ${1976}
    ${"2049-12-31T23:59:59Z"}      | ${1999}
    ${"2050-01-01T00:00:00Z"}      | ${2000}
    ${"2050-01-01T00:00:00+02:00"} | ${1999}
    ${"2049-12-31T23:59:59-05:00"} | ${2000}
  `(
    "reads 'rolling' at $now as the window starting $expected",
    ({ now, expected }) => {
      setNow(now);
      expect(readYearWindowStart({ yearWindow: "rolling" })).toBe(expected);
    },
  );
});
