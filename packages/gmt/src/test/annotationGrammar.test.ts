import { describe, expect, it } from "vitest";

import { isValidCalendarDate, isValidDate, isValidDateTime } from "../plain";
import { isValidUtc } from "../utc";
import { isValidCalendarZonedDateTime, isValidZonedDateTime } from "../zoned";

/**
 * RFC 9557 annotations, swept shape by shape against every validator that reads them.
 *
 * The per-function suites cover a handful of shapes each; the sweep here is the whole grammar in
 * one table, applied to every parser, so no parser can drift from the rest. Two rules do the work
 * (RFC 9557 §3.3, and Temporal's `ParseISODateTime`):
 *
 * - an **elective** annotation whose key the parser doesn't know is read and ignored;
 * - a **critical** one (`[!key=value]`) whose key it doesn't know is rejected, and so is a second
 *   `u-ca` when either `u-ca` is critical.
 *
 * `accepted` is what `Temporal.PlainDate.from` returns in Chromium 153.0.8010.12 — native V8, not
 * the polyfill and not GMT. `@js-temporal/polyfill` 0.5.1 agrees on every row.
 *
 * The `u-ca` rows are the one place the validators legitimately differ: the calendar-aware ones
 * take a calendar annotation, and the strict-ISO ones reject any string that names a calendar.
 */

type Kind = "plain" | "instant" | "zoned";

interface Shape {
  readonly annotation: string;
  /**
   * What Temporal itself does with the shape in Chromium 153.0.8010.12 — native V8, not the
   * polyfill and not GMT: `PlainDate.from` / `PlainDateTime.from` (plain), `Instant.from`
   * (instant) and `ZonedDateTime.from` (zoned). `@js-temporal/polyfill` 0.5.1 agrees on every row.
   *
   * The three differ in only two places, and both are the spec being consistent rather than
   * fussy: an instant never reads the calendar, so a `u-ca` it cannot resolve is still ignored;
   * and a zoned string already carries a time zone annotation, so a bare `[foo]` after it is a
   * second one rather than a key-value.
   */
  readonly native: Readonly<Record<Kind, boolean>>;
  /** Whether the annotation names a calendar other than ISO, which only some validators take. */
  readonly namesNonIsoCalendar: boolean;
  readonly why: string;
}

const all = (value: boolean): Record<Kind, boolean> => ({
  plain: value,
  instant: value,
  zoned: value,
});

const SHAPES: readonly Shape[] = [
  {
    annotation: "",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "no annotation",
  },
  {
    annotation: "[u-ca=hebrew]",
    native: all(true),
    namesNonIsoCalendar: true,
    why: "known key",
  },
  {
    annotation: "[!u-ca=hebrew]",
    native: all(true),
    namesNonIsoCalendar: true,
    why: "critical, known key",
  },
  {
    annotation: "[u-ca=iso8601]",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "the ISO calendar, named",
  },
  {
    annotation: "[u-ca=hebrew][u-ca=roc]",
    native: all(true),
    namesNonIsoCalendar: true,
    why: "repeated u-ca, neither critical: the first wins",
  },
  {
    annotation: "[!u-ca=hebrew][u-ca=roc]",
    native: all(false),
    namesNonIsoCalendar: true,
    why: "repeated u-ca, the first critical",
  },
  {
    annotation: "[u-ca=hebrew][!u-ca=roc]",
    native: all(false),
    namesNonIsoCalendar: true,
    why: "repeated u-ca, the second critical",
  },
  {
    annotation: "[u-ca=bogus]",
    native: { plain: false, instant: true, zoned: false },
    namesNonIsoCalendar: true,
    why: "not a calendar id, and an instant never reads one",
  },
  {
    annotation: "[!u-ca=bogus]",
    native: { plain: false, instant: true, zoned: false },
    namesNonIsoCalendar: true,
    why: "critical, not a calendar id",
  },
  {
    annotation: "[foo=bar]",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "elective, unknown key: ignored",
  },
  {
    annotation: "[!foo=bar]",
    native: all(false),
    namesNonIsoCalendar: false,
    why: "critical, unknown key",
  },
  {
    annotation: "[foo=bar][baz=qux]",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "two elective unknowns",
  },
  {
    annotation: "[foo=bar][foo=baz]",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "a repeated elective unknown key",
  },
  {
    annotation: "[foo=bar][!baz=qux]",
    native: all(false),
    namesNonIsoCalendar: false,
    why: "one of them critical and unknown",
  },
  {
    annotation: "[foo=bar-baz]",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "a hyphen in the value",
  },
  {
    annotation: "[foo=BAR]",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "an uppercase value",
  },
  {
    annotation: "[_foo=bar]",
    native: all(true),
    namesNonIsoCalendar: false,
    why: "a leading underscore in the key",
  },
  {
    annotation: "[FOO=bar]",
    native: all(false),
    namesNonIsoCalendar: false,
    why: "an uppercase key",
  },
  {
    annotation: "[]",
    native: all(false),
    namesNonIsoCalendar: false,
    why: "an empty annotation",
  },
  {
    annotation: "[=bar]",
    native: all(false),
    namesNonIsoCalendar: false,
    why: "no key",
  },
  {
    annotation: "[foo=]",
    native: all(false),
    namesNonIsoCalendar: false,
    why: "no value",
  },
  {
    annotation: "[foo]",
    native: { plain: true, instant: true, zoned: false },
    namesNonIsoCalendar: false,
    why: "not a key-value: a time zone annotation",
  },
];

interface Parser {
  readonly name: string;
  readonly base: string;
  readonly kind: Kind;
  /** Whether this validator takes a calendar annotation, or requires a plain ISO string. */
  readonly readsCalendar: boolean;
  readonly validate: (value: string) => boolean;
}

const PARSERS: readonly Parser[] = [
  {
    name: "isValidCalendarDate",
    base: "2024-10-03",
    kind: "plain",
    readsCalendar: true,
    validate: isValidCalendarDate,
  },
  {
    name: "isValidDate",
    base: "2024-10-03",
    kind: "plain",
    readsCalendar: false,
    validate: isValidDate,
  },
  {
    name: "isValidDateTime",
    base: "2024-10-03T12:00:00",
    kind: "plain",
    readsCalendar: false,
    validate: isValidDateTime,
  },
  {
    name: "isValidUtc",
    base: "2024-10-03T12:00:00Z",
    kind: "instant",
    readsCalendar: true,
    validate: isValidUtc,
  },
  {
    name: "isValidCalendarZonedDateTime",
    base: "2024-10-03T12:00:00+00:00[UTC]",
    kind: "zoned",
    readsCalendar: true,
    validate: isValidCalendarZonedDateTime,
  },
  {
    name: "isValidZonedDateTime",
    base: "2024-10-03T12:00:00+00:00[UTC]",
    kind: "zoned",
    readsCalendar: false,
    validate: isValidZonedDateTime,
  },
];

describe("RFC 9557 annotations, per parser", () => {
  for (const parser of PARSERS) {
    describe(parser.name, () => {
      for (const shape of SHAPES) {
        const expected =
          shape.native[parser.kind] &&
          (parser.readsCalendar || !shape.namesNonIsoCalendar);

        it(`${expected ? "accepts" : "rejects"} ${shape.annotation || "a bare string"} — ${shape.why}`, () => {
          expect(parser.validate(`${parser.base}${shape.annotation}`)).toBe(
            expected,
          );
        });
      }
    });
  }
});
