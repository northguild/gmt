import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import { isPastCutoff } from "../transport/compare/isPastCutoff";
import { timeToCutoff } from "../transport/compare/timeToCutoff";
import { transitTime } from "../transport/calculate/transitTime";
import { isValidDateTime } from "../plain/validate/isValidDateTime";
import { isValidUtc } from "../utc/validate/isValidUtc";
import { isValidInstant } from "../precision/validate/isValidInstant";
import * as plain from "../plain";
import * as utc from "../utc";
import * as instant from "../instant";
import * as precision from "../precision";
import * as unix from "../unix";
import * as calendar from "../calendar";
import * as duration from "../duration";
import * as finance from "../finance";
import * as healthcare from "../healthcare";
import * as intermodal from "../intermodal";
import * as interval from "../interval";
import * as rail from "../rail";
import * as recurrence from "../recurrence";
import * as span from "../span";
import * as timescale from "../timescale";
import * as transport from "../transport";
import * as workforce from "../workforce";
import * as aviation from "../aviation";
import * as gnss from "../gnss";
import * as zoned from "../zoned";

const SPACES: Record<string, Record<string, unknown>> = {
  plain,
  utc,
  instant,
  precision,
  unix,
  calendar,
  duration,
  finance,
  healthcare,
  intermodal,
  interval,
  rail,
  recurrence,
  span,
  timescale,
  transport,
  workforce,
  aviation,
  gnss,
  zoned,
};

/** Strings of every kind GMT reads: a plain date, a plain date-time, a time, and two instants. */
const BASES = [
  "2024-02-29",
  "2024-02-29T12:34:56",
  "12:34:56",
  "2024-02",
  "--02-29",
  "2024-02-29T12:34:56Z",
  "2024-02-29T12:34:56+02:00",
  "2024-02-29T12:34:56+02:00[Europe/Helsinki]",
];

/** Every suffix the plain, UTC and instant kinds refuse: an annotation of any kind, or trailing text. */
const ANNOTATIONS = [
  "[Europe/Helsinki]",
  "[Europe/Helsinkiddddd]",
  "[!Europe/Helsinki]",
  "[!Not/AZone]",
  "[+02:00]",
  "[u-ca=iso8601]",
  "[!u-ca=iso8601]",
  "[foo=bar]",
  "[!foo=bar]",
  // A second bracket after the first, and each bracket that breaks RFC 9557's grammar.
  "[Europe/Helsinki][Europe/Helsinki]",
  "[foo=bar][baz=qux]",
  "[u-ca=iso8601][u-ca=hebrew]",
  "[ junk ]",
  "[a[b]",
  "[!!!]",
  "[+0200]",
  "[+02]",
  "[]",
  // Text after the string that is no annotation at all.
  "junk",
  " ",
  "\n",
];

/** Arguments after the string under test, so a function with a second parameter is reached. */
const EXTRAS: unknown[][] = [
  [],
  ["UTC"],
  [1],
  ["P1D"],
  ["Europe/Helsinki"],
  [{}],
  ["2024-02-29"],
  ["2024-02-29T12:34:56Z"],
];

/**
 * A function that declares no parameters reads no string, so no annotation can change its answer.
 * Most such functions read the clock (`getMicrosecond`, `getUtcNow`), so two calls can differ by
 * the time between them; comparing them would test the clock, not the reader. Found from the
 * function itself, so a new clock reader needs no list entry.
 */
const takesNoInput = (fn: (...args: never[]) => unknown): boolean =>
  fn.length === 0 && /^[^(]*\(\s*\)/.test(Function.prototype.toString.call(fn));

/**
 * Functions whose kind keeps the zone, so a string it reads may carry the zone bracket
 * (a zoned string: the body plus the bracket and nothing else). Each is pinned by its own tests.
 */
const KEEPS_THE_ZONE = new Set([
  "toOffsetInstant",
  "formatHL7",
  "transitTime",
  "isPastCutoff",
  "timeToCutoff",
]);

/**
 * Calendar-aware functions: the body plus at most one `u-ca`. They accept exactly the two ISO
 * calendar annotations below and nothing else in ANNOTATIONS.
 */
const CALENDAR_AWARE = new Set([
  "isValidCalendarDate",
  "isValidDateInterval",
  "isValidCalendarZonedDateTime",
  "isValidCalendarZonedInterval",
]);
const ONE_CALENDAR = new Set(["[u-ca=iso8601]", "[!u-ca=iso8601]"]);

const run = (fn: (...args: never[]) => unknown, args: unknown[]): string => {
  try {
    return (
      JSON.stringify(
        (fn as (...a: unknown[]) => unknown)(...args),
        (_key, value) => (typeof value === "bigint" ? `${value}n` : value),
      ) ?? "undefined"
    );
  } catch {
    return "THROW";
  }
};

const isAllowed = (name: string, annotation: string): boolean =>
  KEEPS_THE_ZONE.has(name) ||
  (CALENDAR_AWARE.has(name) && ONE_CALENDAR.has(annotation));

/**
 * The whole-string rule (coding-standards § Calendar & zone semantics): a reader never lets an
 * annotation change its answer. Each public function is called with a string of every kind and
 * with the same string plus an annotation; where the plain string is read at all, the annotated
 * one must give the same answer as plain garbage.
 */
describe("every public function matches its kind's exact pattern over the whole string", () => {
  it.each(Object.keys(SPACES).map((namespace) => ({ namespace })))(
    "$namespace: an annotation after the first string argument changes no answer",
    ({ namespace }) => {
      const leaks: string[] = [];
      for (const [name, fn] of Object.entries(SPACES[namespace]!)) {
        if (typeof fn !== "function" || /^[A-Z]/.test(name)) continue;
        if (takesNoInput(fn as never)) continue;
        for (const extra of EXTRAS) {
          const garbage = run(fn as never, ["garbage!", ...extra]);
          for (const base of BASES) {
            if (run(fn as never, [base, ...extra]) === garbage) continue;
            for (const annotation of ANNOTATIONS) {
              if (isAllowed(name, annotation)) continue;
              const answer = run(fn as never, [base + annotation, ...extra]);
              if (answer !== garbage) {
                leaks.push(
                  `${name}(${base}${annotation}) => ${answer.slice(0, 40)}`,
                );
              }
            }
          }
        }
      }
      expect(leaks).toEqual([]);
    },
  );

  it.each(Object.keys(SPACES).map((namespace) => ({ namespace })))(
    "$namespace: an annotation on a later string argument changes no answer",
    ({ namespace }) => {
      const leaks: string[] = [];
      for (const [name, fn] of Object.entries(SPACES[namespace]!)) {
        if (typeof fn !== "function" || /^[A-Z]/.test(name)) continue;
        if (takesNoInput(fn as never)) continue;
        for (const base of BASES) {
          if (
            run(fn as never, [base, base]) ===
            run(fn as never, [base, "garbage!"])
          ) {
            continue;
          }
          for (const annotation of ANNOTATIONS) {
            if (isAllowed(name, annotation)) continue;
            for (const args of [
              [base, base + annotation],
              [base, base + annotation, "UTC"],
              ["UTC", base + annotation],
              [base, base, base + annotation],
            ]) {
              const garbage = run(
                fn as never,
                args.map((arg) =>
                  arg === base + annotation ? "garbage!" : arg,
                ),
              );
              const answer = run(fn as never, args);
              if (answer !== garbage) {
                leaks.push(
                  `${name}(${JSON.stringify(args)}) => ${answer.slice(0, 40)}`,
                );
              }
            }
          }
        }
      }
      expect(leaks).toEqual([]);
    },
  );

  // The reported case and its neighbours, by hand: a time zone that does not exist, a real one,
  // and a calendar, each after a plain date-time, a UTC instant and an instant.
  it.each`
    value                                          | plainDateTime | utcInstant | instant
    ${"2024-02-29T12:34:56"}                       | ${true}       | ${false}   | ${false}
    ${"2024-02-29T12:34:56Z"}                      | ${false}      | ${true}    | ${true}
    ${"2024-02-29T12:34:56+02:00"}                 | ${false}      | ${false}   | ${true}
    ${"2024-02-29T12:34:56[Europe/Helsinkiddddd]"} | ${false}      | ${false}   | ${false}
    ${"2024-02-29T12:34:56[Europe/Helsinki]"}      | ${false}      | ${false}   | ${false}
    ${"2024-02-29T12:34:56[!Europe/Helsinki]"}     | ${false}      | ${false}   | ${false}
    ${"2024-02-29T12:34:56[u-ca=iso8601]"}         | ${false}      | ${false}   | ${false}
    ${"2024-02-29T12:34:56Z[Europe/Helsinki]"}     | ${false}      | ${false}   | ${false}
    ${"2024-02-29T12:34:56Z[foo=bar]"}             | ${false}      | ${false}   | ${false}
    ${"2024-02-29T12:34:56+02:00[+02:00]"}         | ${false}      | ${false}   | ${false}
  `(
    "isValidDateTime, isValidUtc and isValidInstant read $value as $plainDateTime, $utcInstant and $instant",
    ({ value, plainDateTime, utcInstant, instant }) => {
      expect(isValidDateTime(value)).toBe(plainDateTime);
      expect(isValidUtc(value)).toBe(utcInstant);
      expect(isValidInstant(value)).toBe(instant);
    },
  );
});

/**
 * The functions KEEPS_THE_ZONE leaves out of the sweep read a zoned string: the body plus one
 * zone bracket and nothing after it. Helsinki is +02:00 on 2024-02-29, so the offset agrees; `now` is after the 10:34:56Z cut-off.
 */
describe("a zoned reader takes one zone bracket and nothing after it", () => {
  const zoned = "2024-02-29T12:34:56+02:00[Europe/Helsinki]";
  const now = "2024-02-29T11:00:00Z";
  const readers: Record<string, (value: string) => unknown> = {
    toOffsetInstant: (value) => toOffsetInstant(value),
    transitTime: (value) => transitTime(value, "PT1H"),
    isPastCutoff: (value) => isPastCutoff(now, value),
    timeToCutoff: (value) => timeToCutoff(now, value),
  };

  it.each(Object.keys(readers).map((name) => ({ name })))(
    "$name: no suffix after the zone bracket changes the answer",
    ({ name }) => {
      const read = readers[name]!;
      const garbage = JSON.stringify(read("garbage!"));
      // Guard: the bare zoned string is read, so a suffix that is read too would show.
      expect(JSON.stringify(read(zoned))).not.toBe(garbage);
      const leaks = ANNOTATIONS.filter(
        (suffix) => JSON.stringify(read(zoned + suffix)) !== garbage,
      );
      expect(leaks).toEqual([]);
    },
  );

  it.each(Object.keys(readers).map((name) => ({ name })))(
    "$name: a critical zone bracket reads as the plain one does",
    ({ name }) => {
      const read = readers[name]!;
      expect(
        JSON.stringify(read("2024-02-29T12:34:56+02:00[!Europe/Helsinki]")),
      ).not.toBe(JSON.stringify(read("garbage!")));
    },
  );
});

/**
 * D35: a zone bracket naming one of the nine refused names is a bracket naming no zone, so it
 * gives what `[Not/AZone]` gives, in whichever argument it stands.
 */
describe("a refused zone name in a bracket reads as a zone that does not exist", () => {
  const REFUSED_BRACKETS = [
    "[EST5EDT]",
    "[est5edt]",
    "[CET]",
    "[Factory]",
    "[!PST8PDT]",
  ];
  const ZONED_BASES = [
    "2024-02-29T12:34:56+02:00",
    "2024-02-29T12:34:56",
    "2024-07-15T12:00:00-04:00",
  ];

  it.each(Object.keys(SPACES).map((namespace) => ({ namespace })))(
    "$namespace: no refused zone bracket gives a different answer from [Not/AZone]",
    ({ namespace }) => {
      const leaks: string[] = [];
      for (const [name, fn] of Object.entries(SPACES[namespace]!)) {
        if (typeof fn !== "function" || /^[A-Z]/.test(name)) continue;
        if (takesNoInput(fn as never)) continue;
        for (const base of ZONED_BASES) {
          for (const bracket of REFUSED_BRACKETS) {
            const missing = bracket.startsWith("[!")
              ? "[!Not/AZone]"
              : "[Not/AZone]";
            for (const build of [
              (value: string) => [value],
              (value: string) => [value, "UTC"],
              (value: string) => ["2024-02-29T12:00:00Z", value],
              (value: string) => [value, value],
            ]) {
              const answer = run(fn as never, build(base + bracket));
              if (answer !== run(fn as never, build(base + missing))) {
                leaks.push(
                  `${name}(${base}${bracket}) => ${answer.slice(0, 40)}`,
                );
              }
            }
          }
        }
      }
      expect(leaks).toEqual([]);
    },
  );
});
