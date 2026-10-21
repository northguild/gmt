/**
 * What the native-suite runner already knows about: failures of the GMT test suite on a native
 * Temporal engine that have a stated cause. A tag never skips a test. The test still runs on every
 * leg; a tag only sorts its failure for the reporter and goes stale, with a finding, once the test
 * stops failing that way.
 *
 * Node built-ins only and no `Date`: the runner and its tests import this file directly.
 *
 * Two lists, because there are two kinds of known failure (see `classify`):
 *
 * - `KNOWN_NATIVE_FAILURES`: a test fails on the native engine and passes on
 *   `@js-temporal/polyfill` in the same runtime. One row per test, one defect per row.
 * - `KNOWN_HOST_FAILURES`: a test fails on both engines in one runtime, so the runtime's data or
 *   setup is the cause, not Temporal. One group per cause, matched by pattern.
 *
 * `TAGGED_MISMATCHES` in `scripts/temporal-compat.mjs` keys oracle rows and cannot key a test, so
 * these lists are separate. A defect behind both names the same `defect` anchor in both.
 */

/** @typedef {"node" | "chromium" | "firefox"} Leg */

const L_ANCHOR = "l-a-one-character-annotation-key-is-refused";
const M_ANCHOR = "m-u-caislamic-is-accepted-instead-of-refused";
const ICU4X_8620 = "https://github.com/unicode-org/icu4x/issues/8620";
const BOA_529 = "https://github.com/boa-dev/temporal/issues/529";

/**
 * One test that fails natively and passes on the polyfill, for a known defect. `file` is
 * package-relative (`src/zoned/calculate/roundZoned.test.ts`); `test` is the Vitest `fullName`
 * exactly; `defect` is the heading anchor of the defect's record in
 * `context/domination/js-temporal-polyfill-bugs.md`; `upstream` is the filed report's URL, or
 * `null` until one is filed.
 *
 * The 13 tests that fail on Node 26 and Chromium 153 (V8 on `temporal_rs`) and pass on the
 * polyfill. Ten are L (`ixdtf` rejects a one-character annotation key, fixed in unicode-org/icu4x#8623,
 * not yet in an `ixdtf` release or a V8 roll); three are M (`temporal_rs` reads `islamic` as a
 * calendar, boa-dev/temporal#529). Evidence: the records. Firefox is not listed: it has not run yet.
 * Goose Bay day rounding is not here: it was a GMT defect and is fixed (temporalCompat D14).
 *
 * @type {ReadonlyArray<{ file: string, test: string, legs: Leg[], defect: string, upstream: string | null }>}
 */
export const KNOWN_NATIVE_FAILURES = [
  {
    file: "src/internal/calendarDateString.test.ts",
    test: "parseCalendarDateValue parses '2024-10-03[x=y][u-ca=roc]' to ISO 2024-10-03 computed in 'roc', ignoring the other annotations",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/duration/calculate/totalDuration.test.ts",
    test: "totalDuration totals P1D as 24 hours relativeTo '2024-01-01T00:00:00+00:00[UTC][x=T123…' ('an annotation value is not a time of …')",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/plain/validate/isValidDate.test.ts",
    test: "isValidDate returns true for a PlainDate with annotations Temporal reads and ignores: '2024-03-10[a=bc]'",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/plain/validate/isValidDateTime.test.ts",
    test: "isValidDateTime returns true for a PlainDateTime with annotations Temporal reads and ignores: '2024-03-10T12:30[a=bc]'",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/plain/validate/isValidTime.test.ts",
    test: "isValidTime returns true for a PlainTime with annotations Temporal reads and ignores: '12:30[a=bc]'",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/span/calculate/spanNs.test.ts",
    test: "spanNs returns 1000000000n nanoseconds from '2024-01-01T00:00:00Z[x=T123460Z]' to '2024-01-01T00:00:01Z'",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/precision/validate/isValidInstant.test.ts",
    test: "isValidInstant returns true for '2024-01-01T00:00:00Z[x=T123460Z]', whose annotation is not checked ('elective annotation value shaped like…')",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/precision/validate/isValidInstant.test.ts",
    test: "isValidInstant returns true for '2024-01-01T00:00:00Z[x=t000060-y]', whose annotation is not checked ('elective annotation value shaped like…')",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/utc/validate/isValidUtc.test.ts",
    test: "isValidUtc returns true for a UTC instant with annotations Temporal reads and ignores: '2024-03-10T12:30Z[a=bc]'",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/zoned/get/getTimeZoneOffset.test.ts",
    test: "getTimeZoneOffset still reads an instant whose elective annotation value looks like a leap second",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/zoned/validate/isValidCalendarZonedDateTime.test.ts",
    test: "isValidCalendarZonedDateTime returns false for the unsupported calendar id in '2024-01-10T12:00:00+00:00[UTC][u-ca=i…' ('not in the proposal\\'s calendar table')",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/internal/calendarDateString.test.ts",
    test: "parseCalendarDateValue throws for '2024-10-03[u-ca=islamic]' ('not in the proposal\\'s calendar table')",
    legs: ["node", "chromium"],
    defect: M_ANCHOR,
    upstream: BOA_529,
  },
  {
    file: "src/plain/validate/isValidCalendarDate.test.ts",
    test: "isValidCalendarDate returns false for the unsupported calendar id in '2024-10-03[u-ca=islamic]' ('not in the proposal\\'s calendar table')",
    legs: ["node", "chromium"],
    defect: M_ANCHOR,
    upstream: BOA_529,
  },
];
/**
 * A group of tests that fail on both engines in a runtime, for one stated reason. `id` is
 * kebab-case and unique; `reason` is one plain sentence naming the runtime and the data it lacks;
 * at least one of `file` and `test` is given, and both must match when both are. Never a pattern
 * that matches everything.
 *
 * @type {ReadonlyArray<{ id: string, legs: Leg[], reason: string, file?: RegExp, test?: RegExp }>}
 */
export const KNOWN_HOST_FAILURES = [
  {
    // Evidence, Chromium 153.0.8010.12 under Playwright: `Intl.DateTimeFormat.supportedLocalesOf(["is-IS"])`
    // is `[]`, and `new Intl.DateTimeFormat("is-IS").resolvedOptions().locale` is "en-US", as is
    // `Intl.RelativeTimeFormat`'s. The other nine locales GMT tests are all supported. Node 26 (ICU 78.3)
    // supports `is-IS`.
    id: "chromium-icelandic-locale-data",
    legs: ["chromium"],
    reason:
      "Chromium ships no Icelandic (is) locale data, so is-IS formats fall back to English.",
    test: /\bis-IS\b/,
  },
  {
    // Evidence, same browser: for America/New_York with `timeZoneName: "shortGeneric"`, es-ES gives
    // "hora de New York" (expected "hora de Nueva York"), ko-KR "New York 시간", ru-RU "New York", and
    // ja-JP, zh-CN, ar-SA, he-IL, pt-PT the same English city. `timeZoneName: "short"` and
    // `longGeneric` are localised. Only the localised exemplar city name is missing.
    id: "chromium-zone-city-names",
    legs: ["chromium"],
    reason:
      "Chromium has no localised exemplar city names for time zones, so a generic zone name shows the English city (New York) in every locale.",
    file: /\/formatTimeZoneName\.test\.ts$/,
    test: /season-independent styles \(shortGeneric\/longGeneric\) returns the same name in January and July for /,
  },
  {
    // Evidence, same browser: `new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "UTC" })
    // .formatRange(2024-02-03, 2024-02-05)` is "2024년 2월 3일 ~ 5일" (spaces around the tilde);
    // Node 26 gives "2024년 2월 3일~5일". The range pattern differs between the two ICU data builds.
    id: "chromium-korean-range-pattern",
    legs: ["chromium"],
    reason:
      "Chromium's Korean date-range pattern puts spaces around the tilde (3일 ~ 5일) where Node's ICU data has none.",
    file: /\/formatDateRange\.test\.ts$/,
    test: /locale 'ko-KR' with options \{ dateStyle: 'long' \}/,
  },
];

/** The pseudo test name a file that failed to load counts as. */
const FILE_DID_NOT_LOAD = "(file did not load)";

/**
 * The pseudo test name a file counts as when Vitest marks the file failed but no test in it failed:
 * a `beforeAll` or `afterAll` hook threw, or a test left an error behind.
 */
const FILE_FAILED = "(file failed)";

/** The pseudo file and test an error no test caught counts as. */
const VITEST_FILE = "(vitest)";
const UNHANDLED_ERROR = "(unhandled error)";

const HOOK_SKIPPED = "did not run natively (skipped by a failed hook)";

const FILE_FAILED_MESSAGE =
  "The file failed without a failed test: a hook threw or an error was left unhandled. See the Vitest report.";

/**
 * @typedef {{ file: string, test: string, message: string }} Failure
 * @typedef {{ file: string, test: string, defect: string }} TaggedFailure
 * @typedef {{ kind: "divergence", file: string, test: string, defect: string }
 *   | { kind: "host", group: string, reason: string }} StaleTag
 * @typedef {{
 *   counts: { files: number, tests: number, passed: number, skipped: number, tagged: number, untagged: number,
 *             hostTagged: number, hostUntagged: number, staleTags: number },
 *   tagged: TaggedFailure[], untagged: Failure[],
 *   hostTagged: { group: string, count: number, reason: string }[], hostUntagged: Failure[],
 *   staleTags: StaleTag[],
 * }} Classification
 */

/**
 * A failure message up to its stack, so an issue shows the assertion and not the paths of the
 * machine that ran it. A frame is `    at ...` (V8) or `name@url:line:column` (Firefox, Safari).
 * @param {string} message
 */
function withoutStack(message) {
  return message.split(/\n\s+at |\n[^\n@]*@\S+:\d+:\d+/)[0].trim();
}

/**
 * @typedef {{ file: string, test: string, n: number, passed: number, skipped: number,
 *             failed: boolean, message: string }} Entry
 */

/**
 * @typedef {(file: string, test: string, status: "passed" | "failed" | "skipped", message: string,
 *   key?: string, hookSkipped?: boolean) => void} AddTest
 */

/**
 * An `add` that merges the tests sharing a key into `out`.
 * @param {Map<string, Entry>} out
 * @returns {AddTest}
 */
function tallyInto(out) {
  return (file, test, status, message, key = "", hookSkipped = false) => {
    const id = `${file} > ${test}${key}`;
    const e = out.get(id) ?? {
      file,
      test,
      n: 0,
      passed: 0,
      skipped: 0,
      failed: false,
      message: "",
    };
    e.n += 1;
    if (status === "passed") e.passed += 1;
    else if (status === "skipped") e.skipped += 1;
    if ((status === "failed" || hookSkipped) && !e.failed) {
      e.failed = true;
      e.message = message;
    }
    out.set(id, e);
  };
}

/** @param {string} name  a suite's path, absolute or not */
function packageRelative(name) {
  const at = name.lastIndexOf("packages/gmt/");
  return at === -1 ? name : name.slice(at + "packages/gmt/".length);
}

/** @param {string} status  a Vitest assertion status */
function testStatus(status) {
  return status === "passed" || status === "failed" ? status : "skipped";
}

/**
 * Adds one test of a suite. Vitest skips the tests a failed hook leaves unrun: a failure, not a
 * skip.
 * @param {AddTest} add
 * @param {string} file
 * @param {boolean} fileFailed
 * @param {string} message  the suite's message
 * @param {any} r  the assertion result
 */
function addAssertion(add, file, fileFailed, message, r) {
  const test = String(r.fullName ?? r.title ?? "");
  if (r.status === "skipped" && fileFailed) {
    const detail = message === "" ? "" : `: ${message}`;
    add(file, test, "skipped", `${HOOK_SKIPPED}${detail}`, "", true);
    return;
  }
  add(
    file,
    test,
    testStatus(r.status),
    withoutStack(String((r.failureMessages ?? [])[0] ?? "")),
  );
}

/**
 * A failed file gets its own row when it carries a message (a hook threw, even beside failing
 * tests; an ordinary test failure leaves the file's message empty), or when no test of it failed
 * or was left unrun, so nothing else says why the file failed.
 * @param {AddTest} add
 * @param {string} file
 * @param {string} message
 * @param {any[]} results
 */
function addFileRow(add, file, message, results) {
  const explained = results.some((r) =>
    ["failed", "skipped"].includes(r.status),
  );
  if (message === "" && explained) return;
  add(
    file,
    results.length === 0 ? FILE_DID_NOT_LOAD : FILE_FAILED,
    "failed",
    message === "" && results.length > 0 ? FILE_FAILED_MESSAGE : message,
  );
}

/**
 * Every test of a parsed Vitest JSON report, keyed `<file> > <fullName>`, with the tests that share
 * a key merged: the key failed when any test under it failed (keeping that test's message), and
 * counts the tests under it. The file is made package-relative (everything up to `packages/gmt/`
 * is dropped).
 *
 * A file Vitest marks failed with no failed test in it is one failed test, `(file did not load)`
 * when it has no test results at all and `(file failed)` otherwise, carrying the file's message.
 *
 * @param {any} report
 * @param {ReadonlyArray<{ message: string }>} [errors]  the run's unhandled errors, each one a
 *   failed `(unhandled error)` told apart by its message
 * @returns {Map<string, Entry>}
 */
function testsOf(report, errors = []) {
  /** @type {Map<string, Entry>} */
  const out = new Map();
  const add = tallyInto(out);
  for (const suite of report?.testResults ?? []) addSuite(add, suite);
  for (const e of errors) {
    const message = withoutStack(String(e.message ?? ""));
    add(VITEST_FILE, UNHANDLED_ERROR, "failed", message, `: ${message}`);
  }
  return out;
}

/**
 * @param {AddTest} add
 * @param {any} suite  one file of a Vitest JSON report
 */
function addSuite(add, suite) {
  const file = packageRelative(String(suite.name ?? ""));
  const results = suite.assertionResults ?? [];
  const fileFailed = suite.status === "failed";
  const message = withoutStack(String(suite.message ?? ""));
  for (const r of results) addAssertion(add, file, fileFailed, message, r);
  if (fileFailed) addFileRow(add, file, message, results);
}

/** @param {RegExp | undefined} pattern @param {string} text */
function matches(pattern, text) {
  if (!pattern) return true;
  pattern.lastIndex = 0;
  return pattern.test(text);
}

/**
 * The tags that matched nothing.
 * @param {ReadonlyArray<typeof KNOWN_NATIVE_FAILURES[number]>} rows
 * @param {Set<unknown>} usedRows
 * @param {ReadonlyArray<typeof KNOWN_HOST_FAILURES[number]>} groups
 * @param {Map<string, number>} hostCounts
 * @returns {StaleTag[]}
 */
function staleTagsOf(rows, usedRows, groups, hostCounts) {
  return [
    ...rows
      .filter((r) => !usedRows.has(r))
      .map((r) => ({
        kind: /** @type {const} */ ("divergence"),
        file: r.file,
        test: r.test,
        defect: r.defect,
      })),
    ...groups
      .filter((g) => !hostCounts.has(g.id))
      .map((g) => ({
        kind: /** @type {const} */ ("host"),
        group: g.id,
        reason: g.reason,
      })),
  ];
}

/**
 * Sorts every failing test of the native pass by the control pass (the polyfill, same runtime).
 * Pure: parsed Vitest JSON reports in, lists out. A test absent from the control counts as passing
 * there (the native run is the subject). A divergence is never matched against host groups, and
 * a host failure never against divergence rows.
 *
 * @param {any} nativeResults  Vitest JSON report of the native pass
 * @param {any} controlResults  Vitest JSON report of the control (polyfill) pass
 * @param {Leg} leg
 * @param {ReadonlyArray<typeof KNOWN_NATIVE_FAILURES[number]>} divergenceRows
 * @param {ReadonlyArray<typeof KNOWN_HOST_FAILURES[number]>} hostGroups
 * @param {ReadonlyArray<{ message: string }>} [nativeErrors]  unhandled errors of the native pass
 * @param {ReadonlyArray<{ message: string }>} [controlErrors]  unhandled errors of the control pass
 * @returns {Classification}
 */
export function classify(
  nativeResults,
  controlResults,
  leg,
  divergenceRows,
  hostGroups,
  nativeErrors = [],
  controlErrors = [],
) {
  const native = testsOf(nativeResults, nativeErrors);
  const control = testsOf(controlResults, controlErrors);
  const rows = divergenceRows.filter((r) => r.legs.includes(leg));
  const groups = hostGroups.filter((g) => g.legs.includes(leg));

  /** @type {TaggedFailure[]} */
  const tagged = [];
  /** @type {Failure[]} */
  const untagged = [];
  /** @type {Failure[]} */
  const hostUntagged = [];
  /** @type {Map<string, number>} */
  const hostCounts = new Map();
  const usedRows = new Set();
  let hostTaggedTests = 0;
  let passed = 0;
  let skipped = 0;
  let tests = 0;

  /** @param {Entry} t  a test that failed natively and not on the control */
  const sortDivergence = ({ file, test, message }) => {
    const row = rows.find((r) => r.file === file && r.test === test);
    if (row) {
      usedRows.add(row);
      tagged.push({ file, test, defect: row.defect });
    } else {
      untagged.push({ file, test, message });
    }
  };
  /** @param {Entry} t  a test that failed natively and on the control */
  const sortHostFailure = ({ file, test, message }) => {
    const hit = groups.filter(
      (g) => matches(g.file, file) && matches(g.test, test),
    );
    if (hit.length === 0) {
      hostUntagged.push({ file, test, message });
      return;
    }
    hostTaggedTests += 1;
    for (const g of hit) hostCounts.set(g.id, (hostCounts.get(g.id) ?? 0) + 1);
  };

  for (const [id, t] of native) {
    tests += t.n;
    passed += t.passed;
    skipped += t.skipped;
    if (!t.failed) continue;
    if (control.get(id)?.failed === true) sortHostFailure(t);
    else sortDivergence(t);
  }

  const staleTags = staleTagsOf(rows, usedRows, groups, hostCounts);
  const hostTagged = groups
    .filter((g) => hostCounts.has(g.id))
    .map((g) => ({
      group: g.id,
      count: hostCounts.get(g.id) ?? 0,
      reason: g.reason,
    }));

  return {
    counts: {
      files: new Set([...native.values()].map((t) => t.file)).size,
      tests,
      passed,
      skipped,
      tagged: tagged.length,
      untagged: untagged.length,
      hostTagged: hostTaggedTests,
      hostUntagged: hostUntagged.length,
      staleTags: staleTags.length,
    },
    tagged,
    untagged,
    hostTagged,
    hostUntagged,
    staleTags,
  };
}
