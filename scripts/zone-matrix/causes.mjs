/**
 * States why a failure that counts as neither kind happens: a test that fails in the suite's
 * reference zone, or one that fails in only one of a cell's two runs (`unstable`). The pages list
 * each with its Node versions and this cause.
 *
 * `CAUSES` is keyed `<suite>@<version> | <test id>`, as `TAGS` is. An entry has a one-line `cause`,
 * stated as a fact about the test, the Node or the data it ran with, and optionally `nodes`, the
 * Node majors it covers. A failure with no cause stops the runner with exit code 1, as an untagged
 * one does. Causes are added only after reading the failing test.
 */
const LUXON = "luxon@3.7.2 | ";
const ETHIOPIC_ERA =
  "ICU 78.3 (CLDR 48) names the Ethiopic era `AM`; the test expects `ERA1`.";
const WEEK_INFO =
  "From V8 13.6 (Node 24), `Intl.Locale.prototype.getWeekInfo()` returns no `minimalDays`, so Luxon uses its fallback of 4 (src/impl/locale.js:80-84); the en-US test expects 1.";
const NARROW_SPACE =
  "V8 14.6 (Node 26) formats with U+0020 before AM or PM where the test expects U+202F.";

/** Luxon test ids by the cause they share. */
const luxon = (ids, cause, nodes) =>
  Object.fromEntries(
    ids.map((id) => [LUXON + id, nodes ? { cause, nodes } : { cause }]),
  );

export const CAUSES = {
  ...luxon(
    [
      "test/datetime/format.test.js › DateTime#toLocaleString can override the dateTime's output calendar",
      "test/interval/format.test.js › Interval#toLocaleString can override the start DateTime's output calendar",
    ],
    ETHIOPIC_ERA,
  ),
  ...luxon(
    [
      "test/datetime/create.test.js › DateTime.fromObject() w/localWeekYears handles skew with Gregorian years",
      "test/datetime/create.test.js › DateTime.fromObject() w/locale weeks handles fully specified dates",
      "test/datetime/localeWeek.test.js › weeksInLocalWeekYear 2022 should have 53 weeks in en-US",
      "test/datetime/set.test.js › DateTime#set({ localWeekNumber }) sets the date to the same weekday of the target weekNumber (en-US)",
      "test/datetime/set.test.js › DateTime#set({ localWeekYear }) sets the date to the same weekNumber/weekday of the target weekYear (en-US)",
      "test/info/localeWeek.test.js › Info.getMinimumDaysInFirstWeek reports the correct value",
      "test/info/localeWeek.test.js › Info.getStartOfWeek honors the default locale",
    ],
    WEEK_INFO,
    ["24", "26"],
  ),
  ...luxon(
    [
      "test/datetime/format.test.js › DateTime#toLocaleString uses locale-appropriate time formats",
      "test/datetime/format.test.js › DateTime#toLocaleString() does the best it can with unsupported fixed-offset zone when showing the zone",
      "test/datetime/format.test.js › DateTime#toLocaleString() does the best it can with unsupported fixed-offset zone with timeStyle full",
      "test/datetime/format.test.js › DateTime#toLocaleString() shows things in the right custom zone",
      "test/datetime/format.test.js › DateTime#toLocaleString() shows things in the right custom zone when showing the zone",
      "test/datetime/format.test.js › DateTime#toLocaleString() shows things in the right custom zone with timeStyle full",
      "test/datetime/format.test.js › DateTime#toLocaleString() shows things with UTC if fixed-offset zone with 0 offset is used",
      "test/datetime/toFormat.test.js › DateTime#toFormat('t') returns a short time representation",
      "test/datetime/toFormat.test.js › DateTime#toFormat('tt') returns a medium time representation",
      "test/interval/format.test.js › Interval#toLocaleString does the best it can with unsupported fixed-offset zone when showing the zone",
      "test/interval/format.test.js › Interval#toLocaleString shows things in the right IANA zone",
      "test/interval/format.test.js › Interval#toLocaleString shows things in the right fixed-offset zone",
      "test/interval/format.test.js › Interval#toLocaleString shows things in the right fixed-offset zone when showing the zone",
      "test/interval/format.test.js › Interval#toLocaleString shows things with UTC if fixed-offset with 0 offset is used",
      "test/interval/format.test.js › Interval#toLocaleString uses locale-appropriate time formats",
    ],
    NARROW_SPACE,
    ["26"],
  ),
  [`${LUXON}test/datetime/tokenParse.test.js › DateTime.fromFormat() makes dots optional and handles non breakable spaces`]:
    {
      cause:
        "On Node 22 and 24 (V8 12.4, 13.6) the es-ES day period is `p.` U+202F `m.`; the parser matches U+0020 or U+00A0 between its parts (src/impl/tokenParser.js:15-16).",
      nodes: ["22", "24"],
    },
  [`${LUXON}test/datetime/tokenParse.test.js › DateTime.fromFormatExplain() parses localized string with numberingSystem correctly`]:
    {
      cause:
        "ICU 78.3 (CLDR 48) gives the Thai day period as `PM`; the test parses `หลังเที่ยง`, so `rawMatches` is null.",
    },
  "dayjs@1.11.23 | test/plugin/timezone.test.js › DST edge cases vs moment parses the fall-back overlap the same way as moment":
    {
      cause:
        "For the repeated wall time 2012-11-04 01:00 in America/New_York, Day.js gives offset -05:00 and the test expects moment-timezone 0.5.31's -04:00, in every host zone.",
    },
  ...Object.fromEntries(
    [
      "src/funcApi/parity/diffUnzoned.test.ts ›  PlainDate diff parity 'constructs a fractional week in the s…'",
      "src/funcApi/parity/diffUnzoned.test.ts ›  PlainYearMonth diff parity $s ignores reference ISO days",
    ].map((id) => [
      `temporal-polyfill@1.0.8 | ${id}`,
      {
        cause:
          "On Node 26 the function API uses the built-in Temporal (src/funcApi/plainDate.ts:316), whose `total()` is rounded once; the test compares it with the polyfill's class implementation, which rounds twice and differs in the last bit (25/7 weeks: 3.5714285714285716 against 3.571428571428571; 424/365 years: 1.1616438356164382 against 1.1616438356164385).",
        nodes: ["26"],
      },
    ]),
  ),
  "temporal-polyfill@1.0.8 | src/internal/timeZoneImpl.test.ts ›  queryTimeZone finds the previous transition from far in the future in Africa/Casablanca":
    {
      cause:
        "The test expects the last Africa/Casablanca transition before 2100-07-01 at 2087-05-11T02:00Z; with tzdata 2026e the last one is 2026-09-20T01:00Z.",
    },
};

/**
 * @param {{ id: string, version: string }} suite
 * @param {string[]} ids
 * @param {string} node major
 * @param {Record<string, { cause: string, nodes?: string[] }>} causes
 */
export function matchCauses(suite, ids, node, causes) {
  const caused = {};
  const uncaused = [];
  const used = new Set();
  for (const id of ids) {
    const key = `${suite.id}@${suite.version} | ${id}`;
    const entry = causes[key];
    if (entry && (!entry.nodes || entry.nodes.includes(node))) {
      caused[key] = entry;
      used.add(key);
    } else {
      uncaused.push(`${key} (Node ${node})`);
    }
  }
  return { caused, uncaused, used };
}

/** Problems in the cause map itself: a missing cause, or a `nodes` that is not a list of majors. */
export function causeProblems(causes) {
  const problems = [];
  for (const [key, entry] of Object.entries(causes)) {
    if (typeof entry.cause !== "string" || entry.cause === "")
      problems.push(`${key}: no cause`);
    if (
      entry.nodes !== undefined &&
      !(Array.isArray(entry.nodes) && entry.nodes.every((n) => /^\d+$/.test(n)))
    )
      problems.push(`${key}: nodes must list Node majors`);
  }
  return problems;
}
