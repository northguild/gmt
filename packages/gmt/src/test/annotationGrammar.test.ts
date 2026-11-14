import { isValidCalendarDate, isValidDate, isValidDateTime } from "../plain";
import { isValidUtc } from "../utc";
import { isValidCalendarZonedDateTime, isValidZonedDateTime } from "../zoned";

/**
 * RFC 9557 annotations, swept shape by shape against every validator that has a pattern for them.
 *
 * Every validator matches its kind's exact pattern over the whole string (coding-standards §
 * Calendar & zone semantics): a plain, UTC or zoned validator takes no annotation beyond what its
 * kind carries (nothing, nothing, and the zone bracket), and a calendar-aware validator takes at
 * most one calendar annotation (`u-ca`) after the body. Temporal reads many more annotations than
 * that (elective and unknown ones are ignored, a zone annotation is read on a plain string); GMT
 * rejects them, so the table says what is accepted, not what Temporal does.
 */

type Kind = "plain" | "instant" | "zoned";

interface Shape {
  readonly annotation: string;
  /** Whether a calendar-aware validator takes it: one `u-ca` naming a calendar, critical or not. */
  readonly oneCalendar: boolean;
  readonly why: string;
}

const SHAPES: readonly Shape[] = [
  {
    annotation: "",
    oneCalendar: false,
    why: "no annotation",
  },
  {
    annotation: "[u-ca=hebrew]",
    oneCalendar: true,
    why: "known key",
  },
  {
    annotation: "[!u-ca=hebrew]",
    oneCalendar: true,
    why: "critical, known key",
  },
  {
    annotation: "[u-ca=iso8601]",
    oneCalendar: true,
    why: "the ISO calendar, named",
  },
  {
    annotation: "[u-ca=hebrew][u-ca=roc]",
    oneCalendar: false,
    why: "repeated u-ca, neither critical: the first wins",
  },
  {
    annotation: "[!u-ca=hebrew][u-ca=roc]",
    oneCalendar: false,
    why: "repeated u-ca, the first critical",
  },
  {
    annotation: "[u-ca=hebrew][!u-ca=roc]",
    oneCalendar: false,
    why: "repeated u-ca, the second critical",
  },
  {
    annotation: "[u-ca=bogus]",
    oneCalendar: false,
    why: "not a calendar id, and an instant never reads one",
  },
  {
    annotation: "[!u-ca=bogus]",
    oneCalendar: false,
    why: "critical, not a calendar id",
  },
  {
    annotation: "[foo=bar]",
    oneCalendar: false,
    why: "elective, unknown key: ignored",
  },
  {
    annotation: "[!foo=bar]",
    oneCalendar: false,
    why: "critical, unknown key",
  },
  {
    annotation: "[foo=bar][baz=qux]",
    oneCalendar: false,
    why: "two elective unknowns",
  },
  {
    annotation: "[foo=bar][foo=baz]",
    oneCalendar: false,
    why: "a repeated elective unknown key",
  },
  {
    annotation: "[foo=bar][!baz=qux]",
    oneCalendar: false,
    why: "one of them critical and unknown",
  },
  {
    annotation: "[foo=bar-baz]",
    oneCalendar: false,
    why: "a hyphen in the value",
  },
  {
    annotation: "[foo=BAR]",
    oneCalendar: false,
    why: "an uppercase value",
  },
  {
    annotation: "[_foo=bar]",
    oneCalendar: false,
    why: "a leading underscore in the key",
  },
  {
    annotation: "[FOO=bar]",
    oneCalendar: false,
    why: "an uppercase key",
  },
  {
    annotation: "[]",
    oneCalendar: false,
    why: "an empty annotation",
  },
  {
    annotation: "[=bar]",
    oneCalendar: false,
    why: "no key",
  },
  {
    annotation: "[foo=]",
    oneCalendar: false,
    why: "no value",
  },
  {
    annotation: "[foo]",
    oneCalendar: false,
    why: "not a key-value: a time zone annotation",
  },
  {
    annotation: "[Europe/Helsinki]",
    oneCalendar: false,
    why: "a time zone",
  },
  {
    annotation: "[Europe/Helsinkiddddd]",
    oneCalendar: false,
    why: "a time zone that does not exist",
  },
  {
    annotation: "[!Europe/Helsinki]",
    oneCalendar: false,
    why: "a critical time zone",
  },
  {
    annotation: "[+02:00]",
    oneCalendar: false,
    why: "an offset time zone",
  },
  {
    annotation: "[u-ca=iso8601][Europe/Helsinki]",
    oneCalendar: false,
    why: "a calendar, then a time zone",
  },
];

interface Parser {
  readonly name: string;
  readonly base: string;
  readonly kind: Kind;
  /** Whether this validator takes one calendar annotation, or no annotation at all. */
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
    readsCalendar: false,
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

describe("annotations, per validator", () => {
  for (const parser of PARSERS) {
    describe(parser.name, () => {
      for (const shape of SHAPES) {
        const expected =
          shape.annotation === "" ||
          (parser.readsCalendar && shape.oneCalendar);

        it(`${expected ? "accepts" : "rejects"} ${shape.annotation || "a bare string"} — ${shape.why}`, () => {
          expect(parser.validate(`${parser.base}${shape.annotation}`)).toBe(
            expected,
          );
        });
      }
    });
  }
});
