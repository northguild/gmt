/**
 * Sorts failures into the two kinds the site shows.
 *
 * - `one-zone`: the test assumes one zone (it hard-codes an expectation that holds in one host
 *   zone). Not a fault of the library.
 * - `wrong-answer`: the library gives a wrong answer. Carries `evidence`: `{ input, zone,
 *   temporal, library }`, the input, the zone it was run in, what Temporal returns and what the
 *   library returns.
 *
 * `TAGS` is keyed `<suite>@<version> | <test id>`. An entry may carry `zones`, a list that scopes
 * the tag to those zones; outside them the failure is untagged. Every entry has a one-line
 * `reason`. A failure with no tag stops the runner with exit code 1. A tag no failure used is
 * reported as stale.
 *
 * Tags are added only after reading a failing test and its zone. None is added from a guess, so
 * the map grows with real runs.
 */
const APIA_WEEK = {
  kind: "wrong-answer",
  reason:
    "Week 1 of 2012 starts on Saturday 31 December 2011; in Pacific/Apia, which skipped 30 December 2011, the day of year comes out as 364 and the week as 52.",
  zones: ["Pacific/Apia"],
  evidence: {
    input: "moment([2011, 11, 31]) with week { dow: 6, doy: 12 }",
    zone: "Pacific/Apia",
    temporal:
      "2011-12-31T00:00:00+14:00[Pacific/Apia]: dayOfYear 365; the Saturday-first week 2011-12-31..2012-01-06 holds 1 January, so week 1",
    library: "dayOfYear 364, week 52",
  },
};

const NOT_NEW_YORK = [
  "UTC",
  "Pacific/Niue",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Shanghai",
  "Australia/Lord_Howe",
  "Pacific/Chatham",
  "Pacific/Apia",
];

export const TAGS = {
  "moment@2.31.0 | locale/ar-ly.js › locale:ar-ly > weeks year starting sunday formatted":
    APIA_WEEK,
  "moment@2.31.0 | locale/ar.js › locale:ar > weeks year starting sunday formatted":
    APIA_WEEK,
  "moment@2.31.0 | locale/fa.js › locale:fa > weeks year starting sunday formatted":
    APIA_WEEK,
  "moment@2.31.0 | locale/ku.js › locale:ku > weeks year starting sunday formatted":
    APIA_WEEK,
  "moment@2.31.0 | locale/ps.js › locale:ps > week year starts on Saturday":
    APIA_WEEK,
  "moment@2.31.0 | locale/tzm-latn.js › locale:tzm-latn > weeks year starting sunday formatted":
    APIA_WEEK,
  "moment@2.31.0 | locale/tzm.js › locale:tzm > weeks year starting sunday formatted":
    APIA_WEEK,
  "moment@2.31.0 | moment/week_year.js › week year > weeks numbers dow:6 doy:12":
    APIA_WEEK,

  "luxon@3.7.2 | test/datetime/diff.test.js › DateTime#diff handles fractional days as fractions of those specific days":
    {
      kind: "one-zone",
      reason:
        "Expects 1 + 24/25 days because 4 November 2018 lasts 25 hours in America/New_York; in other zones that day lasts 24 hours and the value matches Temporal.",
      zones: NOT_NEW_YORK,
    },
  "luxon@3.7.2 | test/datetime/diff.test.js › DateTime#diff is precise for lower order units":
    {
      kind: "one-zone",
      reason:
        "Expects 2999 hours, which holds where one spring-forward hour falls in the span (America/New_York); in other zones the hour count matches Temporal.",
      zones: NOT_NEW_YORK.filter((z) => z !== "Europe/London"),
    },
  "luxon@3.7.2 | test/datetime/tokenParse.test.js › DateTime.format() uses local zone when setZone is false and offset in input":
    {
      kind: "one-zone",
      reason:
        "Expects the America/New_York day, hour and offset (-300) of the parsed instant.",
      zones: NOT_NEW_YORK,
    },
  "luxon@3.7.2 | test/datetime/tokenParse.test.js › DateTime.format() uses local zone when setZone is false and zone id in input":
    {
      kind: "one-zone",
      reason:
        "Expects the America/New_York day, hour, offset and zone name of the parsed instant.",
      zones: NOT_NEW_YORK,
    },
  "luxon@3.7.2 | test/datetime/zone.test.js › The local zone does local stuff":
    {
      kind: "one-zone",
      reason:
        "Expects the host zone's names to be Eastern Daylight Time and EDT.",
      zones: NOT_NEW_YORK,
    },
  "luxon@3.7.2 | test/info/zones.test.js › Info.normalizeZone converts local to system Zone":
    {
      kind: "one-zone",
      reason: "Expects the host zone to be America/New_York.",
      zones: NOT_NEW_YORK,
    },
  "luxon@3.7.2 | test/zones/local.test.js › SystemZone.instance provides valid ...":
    {
      kind: "one-zone",
      reason: "Expects the host zone name America/New_York.",
      zones: NOT_NEW_YORK,
    },

  "dayjs@1.11.23 | test/get-set.test.js › Set Month and Year in last day of month":
    {
      kind: "one-zone",
      reason:
        "The test instant 2011-07-31T14:48Z is already 1 August at offsets of +09:12 or more; the result matches Temporal for that local date.",
      zones: ["Australia/Lord_Howe", "Pacific/Chatham"],
    },
  "dayjs@1.11.23 | test/plugin/pluralGetSet.test.js › Set Month and Year in last day of month":
    {
      kind: "one-zone",
      reason:
        "The test instant 2011-07-31T14:48Z is already 1 August at offsets of +09:12 or more; the result matches Temporal for that local date.",
      zones: ["Australia/Lord_Howe", "Pacific/Chatham"],
    },
  "dayjs@1.11.23 | test/plugin/calendar.test.js › ReferenceTime": {
    kind: "one-zone",
    reason:
      "The test's now, 2015-01-15T14:21Z, is already Friday 16 January at offsets of +09:39 or more, so the calendar labels name other days; each matches Temporal's day count.",
    zones: ["Australia/Lord_Howe", "Pacific/Chatham", "Pacific/Apia"],
  },
  "dayjs@1.11.23 | test/plugin/dayOfYear.test.js › DayOfYear set": {
    kind: "one-zone",
    reason:
      "The test starts from 2015-01-01T00:00Z, which is 31 December 2014 at negative offsets; the result matches Temporal for that local date.",
    zones: ["America/New_York", "Pacific/Niue"],
  },
  "dayjs@1.11.23 | test/plugin/localizedFormat.test.js › Should not interpolate characters inside square brackets":
    {
      kind: "one-zone",
      reason:
        "The test formats the Unix epoch, 1970-01-01T00:00Z, which is still 1969 at negative offsets; the year printed matches Temporal.",
      zones: ["America/New_York", "Pacific/Apia", "Pacific/Niue"],
    },
};

export const KINDS = ["one-zone", "wrong-answer"];

export const tagKey = (suite, version, id) => `${suite}@${version} | ${id}`;

/**
 * @param {{ id: string, version: string }} suite
 * @param {string[]} failed
 * @param {string} zone
 * @param {Record<string, any>} tags
 * @returns {{ tagged: Record<string, any>, untagged: string[], used: Set<string> }}
 */
export function matchTags(suite, failed, zone, tags) {
  const tagged = {};
  const untagged = [];
  const used = new Set();
  for (const id of failed) {
    const key = tagKey(suite.id, suite.version, id);
    const tag = tags[key];
    if (tag && (!tag.zones || tag.zones.includes(zone))) {
      tagged[key] = tag;
      used.add(key);
    } else {
      untagged.push(key);
    }
  }
  return { tagged, untagged, used };
}

/** Problems in the tag map itself: unknown kind, missing reason, missing evidence. */
export function tagProblems(tags) {
  const problems = [];
  for (const [key, tag] of Object.entries(tags)) {
    if (!KINDS.includes(tag.kind))
      problems.push(`${key}: kind must be one of ${KINDS.join(", ")}`);
    if (typeof tag.reason !== "string" || tag.reason === "")
      problems.push(`${key}: no reason`);
    if (tag.kind === "wrong-answer") {
      const e = tag.evidence ?? {};
      for (const f of ["input", "zone", "temporal", "library"]) {
        if (typeof e[f] !== "string" || e[f] === "")
          problems.push(`${key}: evidence.${f} missing`);
      }
    }
  }
  return problems;
}

/** Keys of the tag map that no recorded failure in `usedKeys` matched. */
export function staleTags(tags, usedKeys) {
  return Object.keys(tags).filter((k) => !usedKeys.has(k));
}
