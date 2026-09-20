/**
 * Options-object contract: every public function that takes an `options` bag reads it the way the
 * specification it follows does.
 *
 * - GMT's own options (Temporal GetOptionsObject, also Intl.DurationFormat): `undefined` is the
 *   defaults, and any other non-object — `null`, a string, a number — is a TypeError, so the
 *   function returns its sentinel instead of silently reading the defaults.
 * - Formatters that forward their options to `Intl.DateTimeFormat` (ECMA-402 CoerceOptionsToObject):
 *   `null` is a TypeError (sentinel), while a string or a number is coerced by ToObject to an object
 *   with no date-time options, so the result equals the defaults.
 * - A *member* of the bag is read the same way: `undefined` is the member's default, and an
 *   explicit `null` is a value that has to pass the member's validation. Temporal's
 *   GetOption calls ToString on anything that is not `undefined`, so `{ overflow: null }` is
 *   `"null"` — a RangeError, not the `"constrain"` default (Chromium 153 and the polyfill agree,
 *   for `overflow`, `disambiguation`, `offset`, `largestUnit`, `smallestUnit`,
 *   `fractionalSecondDigits`, `timeZoneName`, `style` and `timeStyle`). `numberingSystem` is the
 *   exception both engines make: `"null"` is a well-formed subtag, so it is accepted and ignored.
 */
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  formatCalendar,
  formatCalendarUnix,
  formatCalendarUtc,
  formatCalendarZoned,
  formatRelativeDate,
  formatRelativeDateTime,
  formatRelativeTime,
  formatRelativeUnix,
  formatRelativeUtc,
  formatRelativeZoned,
  isValidDateRange,
  isValidDateTimeRange,
  isValidTimeRange,
  isValidUnixRange,
  isValidUtcRange,
  isValidZonedRange,
  isBetweenDate,
  isBetweenDateTime,
  isBetweenTime,
  isBetweenUnix,
  isBetweenUtc,
  isBetweenZoned,
} from "../index";
import { type OptionsCase, optionsCases } from "./noThrow";

/** Formatters whose options bag reaches `Intl.DateTimeFormat` (ECMA-402 CoerceOptionsToObject). */
const COERCE_OPTIONS_TO_OBJECT = new Set([
  "formatDate",
  "formatDateRange",
  "formatDateTime",
  "formatDateTimeRange",
  "formatDateTimeToParts",
  "formatDateToParts",
  "formatTime",
  "formatUnix",
  "formatUtc",
  "formatZonedDateTime",
  "formatZonedRange",
  "formatZonedToParts",
]);

const CASES = optionsCases();
const GET_OPTIONS_OBJECT = CASES.filter(
  ({ name }) => !COERCE_OPTIONS_TO_OBJECT.has(name),
);
const COERCE = CASES.filter(({ name }) => COERCE_OPTIONS_TO_OBJECT.has(name));

function callWith(testCase: OptionsCase, options: unknown): unknown {
  const args = testCase.baseline.slice();
  while (args.length < testCase.position) args.push(undefined);
  args[testCase.position] = options;
  return testCase.fn(...args);
}

describe("options-object contract coverage", () => {
  it("finds every options-taking function, including each CoerceOptionsToObject formatter", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(174);
    expect(
      [...COERCE_OPTIONS_TO_OBJECT].filter(
        (name) => !COERCE.some((testCase) => testCase.name === name),
      ),
    ).toEqual([]);
  });

  it.each(CASES.filter(({ readsClock }) => !readsClock))(
    "$name baseline call is not the sentinel, so a sentinel for bad options is meaningful",
    (testCase) => {
      expect(
        isDeepStrictEqual(testCase.fn(...testCase.baseline), testCase.sentinel),
      ).toBe(false);
    },
  );
});

describe("GetOptionsObject: null, a string or a number as options → sentinel", () => {
  it.each(GET_OPTIONS_OBJECT)(
    "$name(…, options = null | 'x' | 1) returns its sentinel",
    (testCase) => {
      expect({
        null: callWith(testCase, null),
        string: callWith(testCase, "x"),
        number: callWith(testCase, 1),
      }).toEqual({
        null: testCase.sentinel,
        string: testCase.sentinel,
        number: testCase.sentinel,
      });
    },
  );
});

describe("CoerceOptionsToObject: null → sentinel; a string or a number reads as the defaults", () => {
  it.each(COERCE)(
    "$name(…, options = null) returns its sentinel and options 'x' | 1 equal the defaults",
    (testCase) => {
      const defaults = callWith(testCase, undefined);
      expect({
        null: callWith(testCase, null),
        string: callWith(testCase, "x"),
        number: callWith(testCase, 1),
      }).toEqual({
        null: testCase.sentinel,
        string: defaults,
        number: defaults,
      });
    },
  );
});

describe("GetOptionsObject inside a props object: a non-object props.options → false", () => {
  // Each range is valid (value1 < value2) with options omitted, so false comes from options alone.
  it.each`
    name                      | validate                | value1                                           | value2
    ${"isValidDateRange"}     | ${isValidDateRange}     | ${"2024-02-28"}                                  | ${"2024-02-29"}
    ${"isValidDateTimeRange"} | ${isValidDateTimeRange} | ${"2024-01-01T10:00:00"}                         | ${"2024-01-01T11:00:00"}
    ${"isValidTimeRange"}     | ${isValidTimeRange}     | ${"12:00:00"}                                    | ${"13:00:00"}
    ${"isValidUnixRange"}     | ${isValidUnixRange}     | ${1000}                                          | ${2000}
    ${"isValidUtcRange"}      | ${isValidUtcRange}      | ${"2024-01-01T10:00:00Z"}                        | ${"2024-01-01T11:00:00Z"}
    ${"isValidZonedRange"}    | ${isValidZonedRange}    | ${"2024-06-15T12:00:00-04:00[America/New_York]"} | ${"2024-06-15T13:00:00-04:00[America/New_York]"}
  `(
    "$name({ value1: $value1, value2: $value2, options: null | 'x' | 1 }) is false (omitted: true)",
    ({ validate, value1, value2 }) => {
      const check = validate as (props: unknown) => boolean;
      expect({
        omitted: check({ value1, value2 }),
        null: check({ value1, value2, options: null }),
        string: check({ value1, value2, options: "x" }),
        number: check({ value1, value2, options: 1 }),
      }).toEqual({ omitted: true, null: false, string: false, number: false });
    },
  );
});

describe('reference option: a value outside its documented type → ""', () => {
  // Each row's call with the valid reference renders; a reference of another type (a boolean read
  // as epoch 1 or 0, null read as now, an object, a bigint) is invalid input, so the sentinel "".
  // An explicit undefined stays the same as omitted.
  const BAD_REFERENCES: [string, unknown][] = [
    ["true", true],
    ["false", false],
    ["null", null],
    ["{}", {}],
    ["[]", []],
    ["1n", 1n],
  ];
  it.each`
    name                        | format                    | value                                            | reference
    ${"formatRelativeDate"}     | ${formatRelativeDate}     | ${"2026-01-15"}                                  | ${"2026-04-15"}
    ${"formatRelativeDateTime"} | ${formatRelativeDateTime} | ${"2026-01-15T00:00:00"}                         | ${"2026-01-15T10:30:00"}
    ${"formatRelativeTime"}     | ${formatRelativeTime}     | ${"09:00:00"}                                    | ${"10:30:00"}
    ${"formatCalendar"}         | ${formatCalendar}         | ${"2026-03-16T14:30:00"}                         | ${"2026-03-15T09:00:00"}
    ${"formatRelativeUtc"}      | ${formatRelativeUtc}      | ${"2026-01-15T14:30:45Z"}                        | ${"2026-04-15T14:30:45Z"}
    ${"formatCalendarUtc"}      | ${formatCalendarUtc}      | ${"2026-03-16T18:30:00Z"}                        | ${"2026-03-15T13:00:00Z"}
    ${"formatRelativeUnix"}     | ${formatRelativeUnix}     | ${1710685845000}                                 | ${1805358645000}
    ${"formatCalendarUnix"}     | ${formatCalendarUnix}     | ${1710772200000}                                 | ${1710685000000}
    ${"formatRelativeZoned"}    | ${formatRelativeZoned}    | ${"2023-12-29T00:00:00+00:00[UTC]"}              | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"formatCalendarZoned"}    | ${formatCalendarZoned}    | ${"2026-03-16T14:30:00-04:00[America/New_York]"} | ${"2026-03-15T09:00:00-04:00[America/New_York]"}
  `(
    '$name($value, "en-US", { reference: true | false | null | {} | [] | 1n }) returns ""',
    ({ format, value, reference }) => {
      const call = format as (v: unknown, l: string, o: object) => string;
      expect(call(value, "en-US", { reference })).not.toBe("");
      expect(
        Object.fromEntries(
          BAD_REFERENCES.map(([label, bad]) => [
            label,
            call(value, "en-US", { reference: bad }),
          ]),
        ),
      ).toEqual(
        Object.fromEntries(BAD_REFERENCES.map(([label]) => [label, ""])),
      );
    },
  );
});

/** A failing member is named with what it returned, so the report points straight at the read. */
function show(value: unknown): string {
  if (typeof value === "bigint") return `${value}n`;
  return JSON.stringify(value) ?? String(value);
}

describe("option members: an explicit null is a value to validate, not an omission", () => {
  it("resolves the documented members of every options-taking function", () => {
    expect(
      CASES.filter(({ members }) => members.length === 0).map(
        ({ name }) => name,
      ),
    ).toEqual([]);
  });

  // `"zzbogus"` is the control: a member that rejects it is a member whose value is validated, so
  // an explicit `null` — which every specification in play coerces to the string "null" — has to
  // be rejected the same way. A member that accepts `"zzbogus"` (`numberingSystem`, whose value is
  // a well-formed subtag either way, and the boolean flags) is not a pair and is skipped.
  it.each(CASES)(
    "$name: every member that rejects a bogus value rejects null the same way",
    (testCase) => {
      const disagreed: string[] = [];
      for (const member of testCase.members) {
        const bogus = callWith(testCase, { [member]: "zzbogus" });
        if (!isDeepStrictEqual(bogus, testCase.sentinel)) continue;
        const explicitNull = callWith(testCase, { [member]: null });
        if (isDeepStrictEqual(explicitNull, testCase.sentinel)) continue;
        disagreed.push(`${member}: null gave ${show(explicitNull)}`);
      }
      expect(disagreed).toEqual([]);
    },
  );
});

describe("boolean option members: null is false, the way ToBoolean reads it", () => {
  // `inclusiveStart`/`inclusiveEnd` default to `true`, so an omitted member and an explicit `null`
  // part company: ECMA-402 reads a boolean option through ToBoolean, under which `null` is `false`
  // (as `0` and `""` already are here). A `??` read would instead hand `null` the `true` default —
  // the one reading neither the house rule nor the spec convention supports.
  it.each`
    name                   | isBetween            | value                                            | start                                            | end
    ${"isBetweenDate"}     | ${isBetweenDate}     | ${"2024-03-15"}                                  | ${"2024-03-15"}                                  | ${"2024-03-20"}
    ${"isBetweenDateTime"} | ${isBetweenDateTime} | ${"2024-03-15T10:00:00"}                         | ${"2024-03-15T10:00:00"}                         | ${"2024-03-15T12:00:00"}
    ${"isBetweenTime"}     | ${isBetweenTime}     | ${"10:00:00"}                                    | ${"10:00:00"}                                    | ${"12:00:00"}
    ${"isBetweenUtc"}      | ${isBetweenUtc}      | ${"2024-03-15T10:00:00Z"}                        | ${"2024-03-15T10:00:00Z"}                        | ${"2024-03-15T12:00:00Z"}
    ${"isBetweenUnix"}     | ${isBetweenUnix}     | ${1710496800000}                                 | ${1710496800000}                                 | ${1710504000000}
    ${"isBetweenZoned"}    | ${isBetweenZoned}    | ${"2024-03-15T10:00:00-04:00[America/New_York]"} | ${"2024-03-15T10:00:00-04:00[America/New_York]"} | ${"2024-03-15T12:00:00-04:00[America/New_York]"}
  `(
    "$name($value, $start, $end, { inclusiveStart }): omitted is true; null, false and 0 are false",
    ({ isBetween, value, start, end }) => {
      const check = isBetween as (
        v: unknown,
        s: unknown,
        e: unknown,
        o?: unknown,
      ) => boolean;
      expect({
        omitted: check(value, start, end),
        explicitTrue: check(value, start, end, { inclusiveStart: true }),
        explicitNull: check(value, start, end, { inclusiveStart: null }),
        explicitFalse: check(value, start, end, { inclusiveStart: false }),
        zero: check(value, start, end, { inclusiveStart: 0 }),
      }).toEqual({
        omitted: true,
        explicitTrue: true,
        explicitNull: false,
        explicitFalse: false,
        zero: false,
      });
    },
  );
});
