import * as gmt from "@northguild/gmt";
import {
  bugzillaBugUrl,
  bugzillaCommentsUrl,
  chromiumIssueUrl,
  identityOf,
  isJiraKey,
  jiraDiscoveryUrl,
  jiraIssueUrl,
  keyOf,
  makeDays,
  parseBugzilla,
  parseChromium,
  parseJira,
  parseJiraDiscovery,
  SYNCED_FIELDS,
  urlOf,
} from "../../../../scripts/lib/upstream-trackers.mjs";

// The readers take a recorded response as text and know nothing of the network, so each test
// feeds one a trimmed copy of what the tracker returned (Jira on 2026-11-14, Chromium's page
// JSON, Bugzilla's REST API) and never calls out.
const days = makeDays(gmt);
const OURS = "712020:edbd7a30-b6e5-42d7-b938-06b19b5d87a9";

describe("makeDays", () => {
  it("reads a time in the reporter's offset as the UTC day", () => {
    // 21:53 in California on the 13th is the 14th in UTC; slicing the text would say the 13th.
    expect(days.fromIso("2026-11-13T21:53:32.451-0800")).toBe("2026-11-14");
    expect(days.fromIso("2026-11-13T21:53:32.451-08:00")).toBe("2026-11-14");
    expect(days.fromIso("2026-11-14T01:00:00Z")).toBe("2026-11-14");
  });

  it("answers null for anything that is not a time", () => {
    expect(days.fromIso("")).toBeNull();
    expect(days.fromIso(undefined)).toBeNull();
    expect(days.fromEpochSeconds("x")).toBeNull();
  });

  it("reads epoch seconds as a UTC day", () => {
    expect(days.fromEpochSeconds(1794679042)).toBe("2026-11-14");
  });
});

describe("tracker identities", () => {
  it("names and links each tracker's entries", () => {
    const refs = [
      { tracker: "github", repo: "nodejs/node", number: 67076, kind: "issue" },
      { tracker: "jira", key: "ICU-23619" },
      { tracker: "chromium", id: 585635918 },
      { tracker: "bugzilla", host: "bugs.webkit.org", id: 330688 },
    ];
    expect(refs.map(keyOf)).toEqual([
      "nodejs/node#67076",
      "ICU-23619",
      "chromium#585635918",
      "bugs.webkit.org#330688",
    ]);
    expect(refs.map(urlOf)).toEqual([
      "https://github.com/nodejs/node/issues/67076",
      "https://unicode-org.atlassian.net/browse/ICU-23619",
      "https://issues.chromium.org/issues/585635918",
      "https://bugs.webkit.org/show_bug.cgi?id=330688",
    ]);
  });

  it("keeps only the identity members of an entry", () => {
    expect(
      identityOf({ tracker: "jira", key: "ICU-23619", status: "New" }),
    ).toEqual({ key: "ICU-23619" });
  });

  it("accepts keys of the projects we file in and no others", () => {
    expect(isJiraKey("ICU-23619")).toBe(true);
    expect(isJiraKey("CLDR-19912")).toBe(true);
    expect(isJiraKey("ABC-1")).toBe(false);
    expect(isJiraKey("ICU-0")).toBe(false);
  });

  it("gives GitHub-only fields to GitHub alone", () => {
    for (const tracker of ["jira", "chromium", "bugzilla"] as const) {
      for (const field of ["draft", "reviewDecision", "mergedAt"]) {
        expect(SYNCED_FIELDS[tracker]).not.toContain(field);
      }
    }
    expect(SYNCED_FIELDS.github).toContain("mergedAt");
  });
});

const jiraIssue = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    key: "ICU-23609",
    fields: {
      summary: "PersianCalendar::isLeapYear returns true for every year < 0",
      status: {
        name: "New",
        statusCategory: { key: "new", name: "To Do" },
      },
      resolution: null,
      resolutiondate: null,
      fixVersions: [],
      created: "2026-11-10T16:41:07.000-0800",
      updated: "2026-11-10T17:02:44.118-0800",
      comment: {
        total: 3,
        comments: [
          { author: { accountId: OURS }, body: "Adding the support thread." },
          { author: { accountId: OURS }, body: "More detail." },
          { author: { accountId: "557058:someone-else" }, body: "Thanks." },
        ],
      },
      ...over,
    },
  });

describe("Jira", () => {
  it("searches by our reporter id in ICU and CLDR", () => {
    const url = decodeURIComponent(jiraDiscoveryUrl());
    expect(url).toContain("/rest/api/3/search/jql?");
    expect(url).toContain(OURS);
    expect(url).toContain("project in (ICU, CLDR)");
    expect(jiraIssueUrl("ICU-23609")).toContain("/rest/api/2/issue/ICU-23609?");
  });

  it("lists the keys a search found and says whether the list is complete", () => {
    const raw = JSON.stringify({
      issues: [{ key: "ICU-23609" }, { key: "CLDR-19912" }, { key: "XYZ-1" }],
      isLast: true,
    });
    expect(parseJiraDiscovery(raw)).toEqual({
      keys: ["ICU-23609", "CLDR-19912"],
      complete: true,
    });
    expect(
      parseJiraDiscovery(JSON.stringify({ issues: [], isLast: false }))
        .complete,
    ).toBe(false);
  });

  it("refuses a search response without an issues list", () => {
    expect(() => parseJiraDiscovery("{}")).toThrow(/no issues array/);
  });

  it("reads an open issue and counts only replies from others", () => {
    expect(parseJira(jiraIssue(), "ICU-23609", days)).toEqual({
      title: "PersianCalendar::isLeapYear returns true for every year < 0",
      url: "https://unicode-org.atlassian.net/browse/ICU-23609",
      state: "open",
      status: "New",
      resolution: null,
      fixVersions: [],
      comments: 3,
      maintainerComments: 1,
      createdAt: "2026-11-11",
      updatedAt: "2026-11-11",
      closedAt: null,
    });
  });

  it("reads a resolved issue as closed, with its fix versions and day", () => {
    const parsed = parseJira(
      jiraIssue({
        status: { name: "Done", statusCategory: { key: "done" } },
        resolution: { name: "Fixed" },
        resolutiondate: "2026-11-20T09:00:00.000-0800",
        fixVersions: [{ name: "79.1" }],
      }),
      "ICU-23609",
      days,
    );
    expect(parsed).toMatchObject({
      state: "closed",
      status: "Done",
      resolution: "Fixed",
      fixVersions: ["79.1"],
      closedAt: "2026-11-20",
    });
  });

  it("refuses a response for another issue or of another shape", () => {
    expect(() => parseJira(jiraIssue(), "ICU-1", days)).toThrow(/unexpected/);
    expect(() => parseJira("{}", "ICU-23609", days)).toThrow(/unexpected/);
  });
});

// A trimmed copy of the page JSON for an open issue: `)]}'`, then positional arrays, with the
// issue at response[0][1][22] as `[null, id, core, null, created, modified, resolved?, …]`.
const chromiumPage = (id: number, { resolved }: { resolved?: number } = {}) => {
  const issue: unknown[] = [
    null,
    id,
    [1456516, 1, 2, 3, 3, "Intl.DateTimeFormat keeps the islamic calendar"],
    null,
    [1794679042, 304000000],
    [1794679086, 219000000],
  ];
  if (resolved !== undefined) issue[6] = [resolved];
  const slots: unknown[] = Array.from({ length: 22 }, () => null);
  return `)]}'\n\n${JSON.stringify([["b.IssueFetchResponse", [...slots, issue]]])}`;
};

describe("Chromium", () => {
  it("asks the tracker's own page endpoint", () => {
    expect(chromiumIssueUrl(585635918)).toBe(
      "https://issues.chromium.org/action/issues/585635918",
    );
  });

  it("reads an open issue, with comment counts it cannot know left null", () => {
    expect(parseChromium(chromiumPage(585635918), 585635918, days)).toEqual({
      title: "Intl.DateTimeFormat keeps the islamic calendar",
      url: "https://issues.chromium.org/issues/585635918",
      state: "open",
      comments: null,
      maintainerComments: null,
      createdAt: "2026-11-14",
      updatedAt: "2026-11-14",
      closedAt: null,
    });
  });

  it("reads an issue with a resolved time as closed", () => {
    expect(
      parseChromium(
        chromiumPage(585635918, { resolved: 1794765442 }),
        585635918,
        days,
      ),
    ).toMatchObject({ state: "closed", closedAt: "2026-11-15" });
  });

  it("throws on a shape it does not recognise, so the caller keeps the last state", () => {
    expect(() => parseChromium(")]}'\n[]", 585635918, days)).toThrow(
      /unexpected response shape/,
    );
    expect(() => parseChromium(chromiumPage(1), 585635918, days)).toThrow(
      /unexpected response shape/,
    );
    expect(() =>
      parseChromium("<html>blocked</html>", 585635918, days),
    ).toThrow();
  });
});

const bugzillaBug = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    bugs: [
      {
        id: 330688,
        summary: "Temporal and Intl reject the time zone ids CST6CDT",
        status: "NEW",
        resolution: "",
        is_open: true,
        creator: "owner@example.test",
        creation_time: "2026-11-09T20:15:00Z",
        last_change_time: "2026-11-10T08:00:00Z",
        ...over,
      },
    ],
  });
const bugzillaComments = (creators: string[]) =>
  JSON.stringify({
    bugs: {
      "330688": {
        comments: creators.map((creator, count) => ({ count, creator })),
      },
    },
  });

describe("Bugzilla", () => {
  it("asks the host's REST API for the bug and its comments", () => {
    expect(bugzillaBugUrl("bugs.webkit.org", 330688)).toContain(
      "https://bugs.webkit.org/rest/bug/330688?include_fields=",
    );
    expect(bugzillaCommentsUrl("bugzilla.mozilla.org", 2085525)).toBe(
      "https://bugzilla.mozilla.org/rest/bug/2085525/comment",
    );
  });

  it("does not count the description, and counts replies by others as maintainers'", () => {
    const parsed = parseBugzilla(
      bugzillaBug(),
      bugzillaComments([
        "owner@example.test",
        "owner@example.test",
        "triager@example.test",
      ]),
      "bugs.webkit.org",
      330688,
      days,
    );
    expect(parsed).toMatchObject({
      url: "https://bugs.webkit.org/show_bug.cgi?id=330688",
      state: "open",
      status: "NEW",
      resolution: null,
      comments: 2,
      maintainerComments: 1,
      createdAt: "2026-11-09",
      updatedAt: "2026-11-10",
      closedAt: null,
    });
  });

  it("reads a resolved bug as closed on the day it was resolved", () => {
    const parsed = parseBugzilla(
      bugzillaBug({
        status: "RESOLVED",
        resolution: "FIXED",
        is_open: false,
        cf_last_resolved: "2026-11-12T10:00:00Z",
      }),
      bugzillaComments(["owner@example.test"]),
      "bugs.webkit.org",
      330688,
      days,
    );
    expect(parsed).toMatchObject({
      state: "closed",
      resolution: "FIXED",
      closedAt: "2026-11-12",
      comments: 0,
    });
  });

  it("refuses a response for another bug", () => {
    expect(() =>
      parseBugzilla(
        bugzillaBug({ id: 1 }),
        bugzillaComments([]),
        "bugs.webkit.org",
        330688,
        days,
      ),
    ).toThrow(/unexpected response shape/);
  });
});
