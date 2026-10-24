/**
 * Temporal compat canary and native oracle (see the temporalCompat README, "Canary and native oracle").
 *
 * GMT works around `@js-temporal/polyfill` and runtime-ICU defects in
 * `packages/gmt/src/internal/temporalCompat/` (calendars) and `internal/zonedWallClock*` (zoned
 * range limits). Each workaround has upstream repros in `temporalCompat/repros.ts` whose expected
 * values come from test262 or Chromium's native Temporal — never from the polyfill or GMT.
 *
 * Usage:
 *   node scripts/temporal-compat.mjs check [--fail-on-removable]
 *     Runs every repro against the installed polyfill and prints, per workaround, which probes are
 *     STILL NEEDED, REMOVABLE or GUARD, with the removal trigger, and the removal steps once every
 *     probe of a workaround passes. GUARD is a group whose probes all pass only because the installed
 *     package predates the change that would make them fail (its `guard` entry): kept, no steps, and
 *     never counted removable until the package moves past `guard.through`. Exit 0 whenever it ran:
 *     "upstream still broken" is never a failure. `--fail-on-removable` (manual release checklist
 *     only, never CI) exits 1 when any workaround is removable. Needs `pnpm build` (exit 2 without
 *     `packages/gmt/dist`).
 *
 *   node scripts/temporal-compat.mjs oracle [--chrome=<path>] [--calendars=a,b]
 *     Runs `scripts/temporal-compat/scan-body.js` in Chromium's native Temporal (Playwright from
 *     apps/dox, or the Chrome at `--chrome`), runs a GMT-level twin of the scan in Node against
 *     `packages/gmt/dist`, and writes `artifacts/temporal-oracle-<date>.{json,txt}`. Exit 0 when
 *     every mismatch is tag-listed (`TAGGED_MISMATCHES`, each with its test262 file); exit 1 on any
 *     other mismatch, which is a GMT bug; exit 2 when it cannot run (no dist, no browser, no
 *     Temporal). `--calendars` limits the twin to some calendars, for local debugging.
 *
 * Never wired into `validate` or `ci.yml`. The weekly/manual run is
 * `.github/workflows/temporal-oracle.yml`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readDates, scanBody } from "./temporal-compat/scan-body.js";
import { formatJson } from "./lib/format-json.mjs";
import { loadGmt } from "./lib/gmt.mjs";
import { snapshotRow, workaroundState } from "./lib/workaround-state.mjs";
import {
  COMPAT_README,
  WORKAROUNDS,
  polyfillVersion,
} from "./lib/workarounds.mjs";
import {
  compatCheckVerdict,
  couldNotRunVerdict,
  oracleVerdict,
  UNTAGGED_ROWS_IN_VERDICT,
  saveVerdict,
} from "./lib/canary-verdict.mjs";

// fileURLToPath, not `.pathname`: see scripts/test-markers.mjs — a percent-encoded path breaks
// any checkout whose directory name contains a space.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GMT_DIR = join(ROOT, "packages/gmt");
const DIST = join(GMT_DIR, "dist");
/** The engine this script's probes run on: Node is V8. A workaround's `engines` scope is checked against it. */
const ENGINE = "v8";
const SNAPSHOT = "apps/dox/src/data/temporal-compat.json";

// ---------------------------------------------------------------------------------------------
// Workarounds: removal triggers and removal steps (temporalCompat README)
// ---------------------------------------------------------------------------------------------

const CALENDAR_DEFECTS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

/** The message of the last `fail`, which the dispatcher turns into a could-not-run verdict. */
let lastFailure = "";

function fail(code, message) {
  console.error(message);
  lastFailure = message;
  process.exitCode = code;
}

/**
 * Writes a verdict file; a failure is only reported on stderr (see `saveVerdict`), so the console
 * text and the exit code of `check` and `oracle` are the same whether or not it can be written.
 */
function saveCompatVerdict(source, verdict) {
  saveVerdict(ROOT, verdict, source);
}

function requireDist() {
  if (!existsSync(join(DIST, "internal/temporalCompat/repros.js"))) {
    fail(2, "packages/gmt/dist is missing: run pnpm build first");
    return false;
  }
  return true;
}

function runtimeLine() {
  return `@js-temporal/polyfill ${polyfillVersion()} (Node ${process.version}, ICU ${process.versions.icu ?? "none"})`;
}

/** The runtime as the verdict files record it. */
function runtimeInfo() {
  return {
    polyfill: polyfillVersion(),
    node: process.version,
    icu: process.versions.icu ?? null,
  };
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

// ---------------------------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------------------------

/**
 * Load the compiled repros and run every one, grouped by workaround.
 *
 * `check` prints this and `snapshot` writes it, so the page's "does GMT still need this" column and
 * the canary a human reads can never disagree: both are this one function's answer.
 */
async function runProbes() {
  const compat = join(DIST, "internal/temporalCompat");
  const { repros } = await import(
    pathToFileURL(join(compat, "repros.js")).href
  );
  const { runRepro, reproPasses } = await import(
    pathToFileURL(join(compat, "capabilities.js")).href
  );

  const covered = new Set(WORKAROUNDS.flatMap((w) => w.defects));
  const unknown = repros.filter((repro) => !covered.has(repro.defect));

  const groups = WORKAROUNDS.map((workaround) => {
    const results = repros
      .filter((repro) => workaround.defects.includes(repro.defect))
      .map((repro) => {
        const output = runRepro(repro);
        return { repro, output, passes: reproPasses(repro, output) };
      });
    const passing = results.filter((result) => result.passes).length;
    return {
      workaround,
      results,
      passing,
      allPass: results.length > 0 && passing === results.length,
    };
  });

  return { groups, unknown };
}

/**
 * A repro whose defect no group in `WORKAROUNDS` claims means the canary and this script have
 * drifted apart, and a group missing from the snapshot would understate what GMT still works
 * around. Both commands that read the probes stop on it, so the check lives here rather than twice.
 *
 * @returns whether it reported a problem, in which case the caller must not carry on.
 */
function reportedUnknownRepros(unknown) {
  if (unknown.length === 0) return false;
  fail(
    2,
    `repros with no workaround group in temporal-compat.mjs: ${[...new Set(unknown.map((r) => r.defect))].join(", ")}`,
  );
  return true;
}

/** A passing probe's label in a group whose state does not make it removable. */
const PASSING_PROBE_LABEL = {
  guard: "GUARD",
  "out-of-scope": "OUT OF SCOPE",
};

/**
 * One probe's line: what it is, and whether it still returns the wrong value. A passing probe in a
 * group whose state is `guard` says GUARD, because it passes by design rather than by a fix, and
 * one in an `out-of-scope` group says OUT OF SCOPE, because this engine never had the defect.
 */
function probeLine({ repro, output, passes }, state) {
  const calendar = repro.calendar === "iso8601" ? "" : ` ${repro.calendar}`;
  const label = `${repro.defect}.${repro.name}${calendar}`.padEnd(42);
  return passes
    ? `  ${label} ${PASSING_PROBE_LABEL[state] ?? "REMOVABLE"} (returns spec value)`
    : `  ${label} STILL NEEDED (${truncate(output, 90)})`;
}

/**
 * `05ce7a3` fixes the max end of the zoned.A range and not the min end, so a run where every
 * `max.*` probe passes looks like progress and is not enough to retire the workaround. Saying so
 * here saves the next reader rediscovering it from the probe names.
 */
function zonedAPartialFixNote(workaround, results) {
  const isZonedA = workaround.defects.includes("zoned.A");
  const onlyMinFails = results.every(
    ({ repro, passes }) => passes || !repro.name.startsWith("max."),
  );
  return isZonedA && onlyMinFails
    ? "     Every max.* probe passes but a min.* probe fails: 05ce7a3 alone does not retire this workaround."
    : null;
}

/** The numbered removal steps of a group. */
function printSteps(workaround) {
  workaround.steps.forEach((step, index) =>
    console.log(`     ${index + 1}. ${step}`),
  );
}

/** A guard's reason without its closing period, for placing it inside parentheses. */
function guardReason(guard) {
  return guard.reason.replace(/\.$/, "");
}

/**
 * The verdict under one group's probes: a guard that holds, removable with its steps (and a note
 * when a guard has lapsed), or how many probes still fail.
 */
function printGroupVerdict({
  workaround,
  results,
  passing,
  state,
  guardLapsed,
}) {
  const { guard } = workaround;
  if (state === "guard") {
    console.log(
      `  => GUARD: all ${results.length} probes return the spec value by design (${guardReason(guard)}). Holds through ${guard.package} ${guard.through}; installed ${polyfillVersion()}. Keep the workaround; no removal steps.`,
    );
    return;
  }
  if (state === "out-of-scope") {
    console.log(
      `  => OUT OF SCOPE: all ${results.length} probes return the spec value, but this defect is ${workaround.engines.join(" and ")} only and this run is on ${ENGINE}. Passing here does not make the workaround removable; the native suite on ${workaround.engines.join(" and ")} decides. Keep the workaround; no removal steps.`,
    );
    return;
  }
  if (state === "removable") {
    console.log(
      `  => REMOVABLE: all ${results.length} probes return the spec value. Steps:`,
    );
    if (guardLapsed) {
      console.log(
        `     Guard lapsed: it held through ${guard.package} ${guard.through} (${guardReason(guard)}). Before removing, confirm the installed release is the trigger; if it is not, raise guard.through to it.`,
      );
    }
    printSteps(workaround);
    return;
  }
  console.log(
    `  => STILL NEEDED: ${results.length - passing} of ${results.length} probes fail`,
  );
  const note = zonedAPartialFixNote(workaround, results);
  if (note) console.log(note);
}

function printGroup(group) {
  console.log(group.workaround.title);
  console.log(`  Remove when: ${group.workaround.trigger}`);
  for (const result of group.results) {
    console.log(probeLine(result, group.state));
  }
  printGroupVerdict(group);
  console.log("");
}

/** Whether every workaround covering a calendar defect (D1–D7) is now removable. */
const calendarWorkaroundsDone = (removable) =>
  WORKAROUNDS.filter((w) =>
    w.defects.some((defect) => CALENDAR_DEFECTS.includes(defect)),
  ).every((w) => removable.includes(w));

function printRemovalSummary(removable, guarded, stillNeeded, outOfScope = []) {
  if (calendarWorkaroundsDone(removable)) {
    console.log(
      `D1–D7 are all removable: also delete nonIsoArithmetic.ts, readArithmeticModel.ts and the whole-operation seams (${COMPAT_README} § Removal steps 6).`,
    );
  }
  if (removable.length === WORKAROUNDS.length) {
    console.log(
      "Every workaround is removable (temporalCompat README, Removal steps): inline or keep temporalCompat/index.ts as a facade, delete temporalCompat/ and these check groups, keep `oracle`, bump the dependency floor, and add a changeset note (drops workarounds; no behaviour change).",
    );
  }
  console.log(
    `${removable.length} of ${WORKAROUNDS.length} workarounds removable on this runtime (${stillNeeded} still needed, ${guarded.length} guard${keptGroupsDetail(guarded, outOfScope)}).`,
  );
}

/** The summary's guard ids, then how many groups are out of scope on this engine and which. */
function keptGroupsDetail(guarded, outOfScope) {
  const ids = (workarounds) =>
    workarounds.map((workaround) => workaround.defects.join("+")).join(", ");
  const guards = guarded.length > 0 ? `: ${ids(guarded)}` : "";
  const scoped =
    outOfScope.length > 0
      ? `, ${outOfScope.length} out of scope on ${ENGINE}: ${ids(outOfScope)}`
      : "";
  return guards + scoped;
}

/** Adds each group's state on the installed runtime; the one place `check` decides it. */
function withStates(groups) {
  const installed = polyfillVersion();
  return groups.map((group) => ({
    ...group,
    ...workaroundState(
      {
        probes: group.results.length,
        failing: group.results.length - group.passing,
        guard: group.workaround.guard,
        engines: group.workaround.engines,
      },
      installed,
      ENGINE,
    ),
  }));
}

async function check(args) {
  if (!requireDist()) return;
  const probed = await runProbes();
  const { unknown } = probed;

  console.log(runtimeLine());
  console.log("");

  if (reportedUnknownRepros(unknown)) return;

  let groups;
  try {
    groups = withStates(probed.groups);
  } catch (error) {
    fail(2, error.message);
    return;
  }

  for (const group of groups) printGroup(group);

  const inState = (state) =>
    groups.filter((group) => group.state === state).map((g) => g.workaround);
  const removable = inState("removable");
  printRemovalSummary(
    removable,
    inState("guard"),
    inState("still-needed").length,
    inState("out-of-scope"),
  );

  saveCompatVerdict(
    "temporal-compat-check",
    compatCheckVerdict({
      runtime: runtimeInfo(),
      groups,
      snapshotCurrent: snapshotIsCurrent(groups),
    }),
  );

  if (args.includes("--fail-on-removable") && removable.length > 0) {
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// oracle: tag list
// ---------------------------------------------------------------------------------------------

/**
 * Mismatches that are not GMT bugs: rows where test262 and Chromium's native Temporal disagree
 * (test262 wins; the order of authorities is in CORE-6 Decisions). Each entry names its test262 file and matches mismatches by
 * `{ scan, calendar, op }` plus an optional `row` predicate. All owner decisions
 * (calendar-standards-decisions.md) are resolved, so no row is tagged for an open decision.
 */
const TAGGED_MISMATCHES = [];

function tagFor(mismatch) {
  return TAGGED_MISMATCHES.find(
    (tag) =>
      tag.scan === mismatch.scan &&
      tag.calendar === mismatch.calendar &&
      tag.op === mismatch.op &&
      (tag.row === undefined || tag.row(mismatch)),
  );
}

// ---------------------------------------------------------------------------------------------
// oracle: GMT string conventions
// ---------------------------------------------------------------------------------------------

/**
 * Temporal calendar id in the scan → GMT's public CalendarSystem name. Since 1.16.0 GMT's ids are
 * Temporal's canonical ids, so this is the identity; it stays as the list of calendars GMT supports.
 */
const GMT_CALENDAR = {
  buddhist: "buddhist",
  hebrew: "hebrew",
  "islamic-civil": "islamic-civil",
  "islamic-tbla": "islamic-tbla",
  "islamic-umalqura": "islamic-umalqura",
  persian: "persian",
  indian: "indian",
  ethioaa: "ethioaa",
  japanese: "japanese",
  roc: "roc",
  gregory: "gregory",
};

/**
 * GMT's calendar string for an ISO date (coding-standards "Calendar-annotated strings are
 * RFC 9557"): exactly native `Temporal.PlainDate.from(iso).withCalendar(calendar).toString()`.
 */
function annotatedDate(iso, calendar) {
  return calendar === "iso8601"
    ? iso
    : `${iso}[u-ca=${GMT_CALENDAR[calendar]}]`;
}

/** An RFC 9557 ISO date for epoch days (proleptic Gregorian, H. Hinnant's civil_from_days). */
function isoFromEpochDays(epochDays) {
  const z = epochDays + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  const yearText =
    year >= 0 && year <= 9999
      ? String(year).padStart(4, "0")
      : `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`;
  return `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Epoch days of an RFC 9557 ISO date (H. Hinnant's days_from_civil). */
function epochDaysFromIso(iso) {
  const [, sign, yearText, monthText, dayText] =
    /^([+-]?)(\d{4,6})-(\d{2})-(\d{2})/.exec(iso);
  const month = Number(monthText);
  const day = Number(dayText);
  const year =
    (sign === "-" ? -1 : 1) * Number(yearText) - (month <= 2 ? 1 : 0);
  const era = Math.floor(year / 400);
  const yoe = year - era * 400;
  const doy =
    Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function addIsoDays(iso, days) {
  return isoFromEpochDays(epochDaysFromIso(iso) + days);
}

/** The ISO date of a native `toString()` (drops any `[u-ca=…]` annotation). */
function stripAnnotation(value) {
  return value.replace(/\[.*$/, "");
}

// ---------------------------------------------------------------------------------------------
// oracle: GMT twin of the scan
// ---------------------------------------------------------------------------------------------

/**
 * Walks the native scan and compares each native result with the matching public GMT function.
 * `dateString(iso, calendar)` is the GMT string for an ISO date (from native reads), `gmt` the
 * public GMT functions, `compare` receives each comparison. Run once with recording stand-ins to
 * collect the dates that need native reads, then for real.
 */
/**
 * The per-calendar comparison helpers the three scans share.
 *
 * `expectDate`/`expectValue` turn Chromium's `"ERR"` sentinel into the empty string GMT returns
 * for input it refuses, so "both refused" compares equal instead of looking like a mismatch.
 */
function twinHelpers(calendar, dateString, gmt, compare) {
  const gmtCalendar = GMT_CALENDAR[calendar];
  if (!gmtCalendar)
    throw new Error(`scan calendar ${calendar} has no GMT name`);

  const expectDate = (nativeIso) =>
    nativeIso === "ERR" ? "" : (dateString(nativeIso, calendar) ?? "");
  const expectValue = (value) => (value === "ERR" ? "" : value);

  /** GMT's read of an ISO date into `calendar`, against the native read (`"ERR"` when it failed). */
  const compareRead = (at, iso, native) =>
    compare(
      {
        ...at,
        op: "read",
        input: iso,
        native,
        expected: annotatedDate(iso, calendar),
      },
      () => gmt.convertDateToCalendar(iso, gmtCalendar),
    );

  /** One comparison of a GMT call against the native answer for the same operation. */
  const compareOp = (at, op, input, native, expected, run) =>
    compare({ ...at, op, input, native, expected }, run);

  /** GMT's one-month and one-year additions to `date`, against the native ones. */
  const compareAdds = (at, date, addMonth, addYear) => {
    compareOp(at, "addMonth", date, addMonth, expectDate(addMonth), () =>
      gmt.addDate(date, { months: 1 }),
    );
    compareOp(at, "addYear", date, addYear, expectDate(addYear), () =>
      gmt.addDate(date, { years: 1 }),
    );
  };

  /** A `from → to` difference in `unit`, in whichever direction the scan walks. */
  const compareUntil = (at, op, from, to, native) =>
    compareOp(at, op, `${from} → ${to}`, native, expectValue(native), () =>
      gmt.diffDateAsDuration(
        from,
        to,
        op.endsWith("Months") ? "months" : "years",
      ),
    );

  return {
    expectDate,
    expectValue,
    compareRead,
    compareOp,
    compareAdds,
    compareUntil,
  };
}

/** One row of `xscan.edge`: a date stepped `n` days in from the supported range's edge. */
function compareEdgeRow(row, n, context) {
  const { at, iso, calendar, dateString, gmt, edge, far, dir, h } = context;
  if (row.length === 1) {
    h.compareRead(at, iso, "ERR");
    return;
  }
  const date = dateString(iso, calendar);
  const [
    ,
    fromFields,
    addMonth,
    addYear,
    subMonth,
    subYear,
    untilEdge,
    untilFar,
  ] = row;
  h.compareRead(at, iso, row[0]);
  if (date === null) return;

  h.compareOp(
    at,
    "fromFields",
    date,
    fromFields,
    h.expectValue(fromFields),
    () => gmt.convertDateToCalendar(date, "iso8601"),
  );
  h.compareOp(
    at,
    "isValidCalendarDate",
    date,
    fromFields,
    String(fromFields !== "ERR"),
    () => String(gmt.isValidCalendarDate(date)),
  );
  h.compareAdds(at, date, addMonth, addYear);
  h.compareOp(at, "subtractMonth", date, subMonth, h.expectDate(subMonth), () =>
    gmt.subtractDate(date, { months: 1 }),
  );
  h.compareOp(at, "subtractYear", date, subYear, h.expectDate(subYear), () =>
    gmt.subtractDate(date, { years: 1 }),
  );

  if (edge !== null) {
    const [from, to] = dir < 0 ? [date, edge] : [edge, date];
    h.compareUntil(at, "untilEdgeMonths", from, to, untilEdge);
  }
  if (far !== null) {
    const [from, to] = dir < 0 ? [far, date] : [date, far];
    h.compareUntil(at, "untilFarYears", from, to, untilFar);
  }
}

/** Both ends of the supported range, walking inwards a day at a time. */
function compareEdgeScan(xscan, calendar, dateString, gmt, h) {
  for (const [tag, edgeIso, dir] of [
    ["max", xscan.max, -1],
    ["min", xscan.min, 1],
  ]) {
    const edge = dateString(edgeIso, calendar);
    const far = dateString(addIsoDays(edgeIso, dir * xscan.farDays), calendar);
    xscan.edge[calendar][tag].forEach((row, n) => {
      const iso = addIsoDays(edgeIso, dir * n);
      const at = { scan: `xscan.edge.${tag}`, calendar, row: n, iso };
      compareEdgeRow(row, n, {
        at,
        iso,
        calendar,
        dateString,
        gmt,
        edge,
        far,
        dir,
        h,
      });
    });
  }
}

/** Evenly spaced dates across the whole range, rather than only its ends. */
function compareStrideScan(xscan, calendar, dateString, gmt, h) {
  xscan.stride[calendar].forEach((row, k) => {
    const [iso, read, fromFields, addMonth, addYear, untilYears] = row;
    const at = { scan: "xscan.stride", calendar, row: k, iso };
    if (read === "ERR") {
      h.compareRead(at, iso, "ERR");
      return;
    }
    const date = dateString(iso, calendar);
    h.compareRead(at, iso, read);
    if (date === null) return;

    h.compareOp(
      at,
      "fromFields",
      date,
      fromFields,
      h.expectValue(fromFields),
      () => gmt.convertDateToCalendar(date, "iso8601"),
    );
    h.compareAdds(at, date, addMonth, addYear);

    const later = dateString(addIsoDays(iso, xscan.strideUntilDays), calendar);
    if (later !== null) {
      h.compareUntil(at, "untilYears", date, later, untilYears);
    }
  });
}

/** The `until` differences between a grid row and each of the scan's offsets. */
function compareGridOffsets(row, at, date, i, grid, calendar, dateString, h) {
  grid.offsets.forEach((offset, j) => {
    const other = dateString(addIsoDays(grid.base, i + offset), calendar);
    if (other === null) return;
    const [months, years, yearsBack] = row.slice(1 + 3 * j, 4 + 3 * j);
    h.compareUntil(at, `until+${offset}Months`, date, other, months);
    h.compareUntil(at, `until+${offset}Years`, date, other, years);
    h.compareUntil(at, `until-${offset}Years`, other, date, yearsBack);
  });
}

/** The arithmetic at the tail of a grid row, after its offset columns. */
function compareGridArithmetic(row, at, date, grid, gmt, h) {
  const tail = 1 + 3 * grid.offsets.length;
  const [addMonth, addMonthReject, addYear, subtract13] = row
    .slice(tail)
    .map((value) => (value === "ERR" ? "ERR" : stripAnnotation(value)));

  h.compareOp(at, "addMonth", date, addMonth, h.expectDate(addMonth), () =>
    gmt.addDate(date, { months: 1 }),
  );
  h.compareOp(
    at,
    "addMonthReject",
    date,
    addMonthReject,
    h.expectDate(addMonthReject),
    () => gmt.addDate(date, { months: 1 }, { overflow: "reject" }),
  );
  h.compareOp(at, "addYear", date, addYear, h.expectDate(addYear), () =>
    gmt.addDate(date, { years: 1 }),
  );
  h.compareOp(
    at,
    "subtract13Months",
    date,
    subtract13,
    h.expectDate(subtract13),
    () => gmt.subtractDate(date, { months: 13 }),
  );
}

/** A dense run of consecutive days, each compared against several offsets from it. */
function compareGridScan(grid, calendar, dateString, gmt, h) {
  grid.rows[calendar].forEach((row, i) => {
    const iso = addIsoDays(grid.base, i);
    const date = dateString(iso, calendar);
    if (date === null) return;
    const at = { scan: "grid", calendar, row: i, iso };
    compareGridOffsets(row, at, date, i, grid, calendar, dateString, h);
    compareGridArithmetic(row, at, date, grid, gmt, h);
  });
}

/**
 * Replays every native scan through GMT, handing each comparison to `compare`.
 *
 * Three scans, one per shape of question: the range's two edges, an even stride across the whole
 * range, and a dense grid of consecutive days. Each is its own function below, because they share
 * only the per-calendar helpers.
 */
function runTwin(native, calendars, dateString, gmt, compare) {
  const { xscan, grid } = native;
  for (const calendar of calendars) {
    const h = twinHelpers(calendar, dateString, gmt, compare);
    compareEdgeScan(xscan, calendar, dateString, gmt, h);
    compareStrideScan(xscan, calendar, dateString, gmt, h);
    compareGridScan(grid, calendar, dateString, gmt, h);
  }
}

/**
 * Builds `dateString` over native reads (`year|month|day|era|eraYear` per `iso|calendar`): the
 * RFC 9557 string for the date, or null when Chromium cannot read it in that calendar, so the ops
 * that start from it are skipped.
 */
function dateStringFromReads(reads) {
  return (iso, calendar) => {
    const read = reads.get(`${iso}|${calendar}`);
    if (read === undefined)
      throw new Error(`no native read for ${iso} ${calendar}`);
    if (read === "ERR") return null;
    return annotatedDate(iso, calendar);
  };
}

// ---------------------------------------------------------------------------------------------
// oracle: browser
// ---------------------------------------------------------------------------------------------

const INSTALL_HINT =
  "Install a Playwright Chromium with `pnpm --filter @gmt/dox exec playwright install chromium`, or pass --chrome=<path> to a Chrome for Testing / headless shell with native Temporal.";

function loadPlaywright() {
  try {
    return createRequire(join(ROOT, "apps/dox/package.json"))(
      "@playwright/test",
    );
  } catch {
    return null;
  }
}

/** Runs the scan and the native reads in Chromium; null (with exit code 2) when it cannot. */
async function runNative(chromePath, calendarsFor) {
  const playwright = loadPlaywright();
  if (!playwright) {
    fail(
      2,
      `@playwright/test is not installed (apps/dox devDependency): run pnpm install. ${INSTALL_HINT}`,
    );
    return null;
  }
  let browser;
  try {
    browser = await playwright.chromium.launch(
      chromePath ? { executablePath: chromePath } : {},
    );
  } catch (error) {
    fail(
      2,
      `Could not launch Chromium: ${String(error.message).split("\n")[0]}\n${INSTALL_HINT}`,
    );
    return null;
  }
  try {
    const page = await browser.newPage();
    const browserVersion = browser.version();
    if (!(await page.evaluate("typeof Temporal !== 'undefined'"))) {
      fail(
        2,
        `Chromium ${browserVersion} has no native Temporal; use a newer Chromium (--chrome=<path>).`,
      );
      return null;
    }
    console.log(`Chromium ${browserVersion}: running the scan…`);
    const scan = JSON.parse(
      await page.evaluate(
        (source) =>
          JSON.stringify((0, eval)(`(${source})`)(globalThis.Temporal)),
        String(scanBody),
      ),
    );

    const pairs = new Map();
    const recordingDateString = (iso, calendar) => {
      pairs.set(`${iso}|${calendar}`, [iso, calendar]);
      return "";
    };
    const noGmt = new Proxy({}, { get: () => () => "" });
    runTwin(scan, calendarsFor(scan), recordingDateString, noGmt, () => {});
    const pairList = [...pairs.values()];
    console.log(`Chromium: reading ${pairList.length} dates…`);
    const values = JSON.parse(
      await page.evaluate(
        ([source, list]) =>
          JSON.stringify((0, eval)(`(${source})`)(globalThis.Temporal, list)),
        [String(readDates), pairList],
      ),
    );
    const reads = new Map(
      pairList.map(([iso, calendar], index) => [
        `${iso}|${calendar}`,
        values[index],
      ]),
    );
    return { scan, reads, browserVersion };
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------
// oracle
// ---------------------------------------------------------------------------------------------

const MAX_STORED_MISMATCHES = 5000;

/** `--name=value` from the command line, or `undefined`. */
const flagValue = (args, name) =>
  args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

/** Collects every comparison the twin makes, grouping the mismatches by scan, calendar and op. */
function makeOracleTally() {
  const counts = { comparisons: 0, mismatches: 0, tagged: 0, untagged: 0 };
  const groups = new Map();
  const stored = [];
  /** The first untagged mismatches, kept apart so tagged ones never crowd them out of `stored`. */
  const untagged = [];

  /** GMT's answer, or the throw as a string so a crash compares as a value rather than escaping. */
  const answerOf = (run) => {
    try {
      return run();
    } catch (error) {
      return `THREW ${error?.name}: ${error?.message}`;
    }
  };

  const record = (row, actual) => {
    const tag = tagFor(row);
    const mismatch = {
      ...row,
      gmt: actual,
      ...(tag ? { tag: tag.test262 } : {}),
    };
    counts.mismatches++;
    counts[tag ? "tagged" : "untagged"]++;
    const key = `${row.scan} ${row.calendar} ${row.op}${tag ? " [tagged]" : ""}`;
    const group = groups.get(key) ?? { key, count: 0, example: mismatch };
    group.count++;
    groups.set(key, group);
    if (stored.length < MAX_STORED_MISMATCHES) stored.push(mismatch);
    if (!tag && untagged.length < UNTAGGED_ROWS_IN_VERDICT) {
      untagged.push(mismatch);
    }
  };

  /** The `compare` callback `runTwin` calls once per comparison. */
  const compare = (row, run) => {
    counts.comparisons++;
    const actual = answerOf(run);
    if (actual !== row.expected) record(row, actual);
  };

  return { counts, groups, stored, untagged, compare };
}

/** Runs the twin one calendar at a time, printing how long each took. */
function runTwinByCalendar(native, calendars, dateString, gmt, compare) {
  for (const calendar of calendars) {
    // `performance.now()` because this is elapsed time for a progress line, not a date: a
    // monotonic clock cannot be dragged backwards by an NTP correction mid-scan, and GMT is
    // string-in, string-out for date values rather than a stopwatch.
    const started = performance.now();
    runTwin(native.scan, [calendar], dateString, gmt, compare);
    console.log(
      `GMT twin: ${calendar} done in ${((performance.now() - started) / 1000).toFixed(1)} s`,
    );
  }
}

async function oracle(args) {
  if (!requireDist()) return;
  const chromePath = flagValue(args, "--chrome");
  const only = flagValue(args, "--calendars")?.split(",").filter(Boolean);
  const calendarsFor = (scan) =>
    only
      ? scan.calendars.filter((calendar) => only.includes(calendar))
      : scan.calendars;

  console.log(runtimeLine());
  const native = await runNative(chromePath, calendarsFor);
  if (!native) return;

  const gmt = await import(pathToFileURL(join(DIST, "plain/index.js")).href);
  const calendars = calendarsFor(native.scan);
  const dateString = dateStringFromReads(native.reads);
  const { counts, groups, stored, untagged, compare } = makeOracleTally();

  runTwinByCalendar(native, calendars, dateString, gmt, compare);

  const summary = [
    runtimeLine(),
    `Chromium ${native.browserVersion}${only ? ` (calendars: ${calendars.join(", ")})` : ""}`,
    `${counts.comparisons} comparisons, ${counts.mismatches} mismatches (${counts.tagged} tagged, ${counts.untagged} untagged)`,
    ...[...groups.values()].map(
      ({ key, count, example }) =>
        `  ${key}: ${count} (e.g. row ${example.row} ${example.iso}: input ${example.input} | native ${example.native} | expected ${JSON.stringify(example.expected)} | gmt ${JSON.stringify(example.gmt)})`,
    ),
  ].join("\n");

  // GMT's own clock and parser rather than `new Date().toISOString()`: this repo's scripts read and
  // write dates with the library they support. `getUtcNow` returns an ISO instant and
  // `parseDateFromUtc` takes the calendar day out of it.
  const { getUtcNow, parseDateFromUtc } = await loadGmt();
  const generatedAt = getUtcNow();
  const date = parseDateFromUtc(generatedAt);
  const artifacts = join(ROOT, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  const jsonPath = join(artifacts, `temporal-oracle-${date}.json`);
  const textPath = join(artifacts, `temporal-oracle-${date}.txt`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt,
        polyfill: polyfillVersion(),
        node: process.version,
        icu: process.versions.icu ?? null,
        chromium: native.browserVersion,
        calendars,
        counts,
        groups: [...groups.values()].map(({ key, count, example }) => ({
          key,
          count,
          example,
        })),
        mismatches: stored,
        mismatchesTruncated: counts.mismatches > stored.length,
      },
      null,
      1,
    ),
  );
  writeFileSync(textPath, `${summary}\n`);
  // Before the exit-1 below, so a run that found GMT bugs still leaves a `ran` verdict.
  saveCompatVerdict(
    "temporal-oracle",
    oracleVerdict({
      runtime: runtimeInfo(),
      chromium: native.browserVersion,
      calendars,
      counts,
      groups: [...groups.values()],
      untagged,
      report: relative(ROOT, jsonPath),
    }),
  );

  console.log("");
  console.log(summary);
  console.log(
    `Wrote ${relative(ROOT, jsonPath)} and ${relative(ROOT, textPath)}`,
  );
  if (counts.untagged > 0) {
    fail(
      1,
      `${counts.untagged} untagged mismatches: GMT differs from native Temporal (a GMT bug unless test262 disagrees with Chromium; then tag it with its test262 file).`,
    );
  }
}

/** The snapshot file as committed, or an empty string when it does not exist. */
function committedSnapshot() {
  const path = `${ROOT}${SNAPSHOT}`;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/**
 * The snapshot file's text for these probe results. `snapshot` writes it, `snapshot --check` and
 * `check` compare the committed file against it, so the verdict and `validate` can never disagree
 * about whether the committed copy is current.
 */
function snapshotText(groups) {
  const installed = polyfillVersion();
  return formatJson({
    groups: groups.map(({ workaround, results, passing }) =>
      snapshotRow(
        workaround,
        // `failing` is how many probes still return the wrong value on the installed polyfill.
        { probes: results.length, failing: results.length - passing },
        installed,
        ENGINE,
      ),
    ),
  });
}

/** Whether the committed snapshot equals what `snapshot` would write now. */
const snapshotIsCurrent = (groups) =>
  committedSnapshot() === snapshotText(groups);

/**
 * The canary as data: one row per workaround group, for the `/upstream/` page.
 *
 * The page's "does GMT still need this" column is this file, so the figure a reader sees is the
 * same probe run `pnpm compat` prints rather than a sentence someone typed. `snapshot` writes it and
 * `--check` fails when the committed copy no longer matches the probes, the way `stats.mjs check`
 * guards the published figures.
 */
async function snapshot(args) {
  if (!requireDist()) return;
  const { groups, unknown } = await runProbes();
  if (reportedUnknownRepros(unknown)) return;

  // `snapshotRow` throws only for a guarded group whose probes all pass while the installed version
  // cannot be compared with `guard.through`: a fault in the local install, so nothing is written.
  let next;
  try {
    next = snapshotText(groups);
  } catch (error) {
    fail(2, `compat snapshot: ${error.message}`);
    return;
  }
  const path = `${ROOT}${SNAPSHOT}`;

  if (args.includes("--check")) {
    if (committedSnapshot() !== next) {
      fail(1, `${SNAPSHOT} is out of date — run: pnpm compat:snapshot`);
      return;
    }
    console.log(snapshotCountLine(JSON.parse(next).groups));
    return;
  }

  writeFileSync(path, next);
  console.log(
    `compat snapshot: wrote ${groups.length} group(s) to ${SNAPSHOT}`,
  );
}

/** The `snapshot --check` summary, read from each row's `state` rather than re-derived. */
function snapshotCountLine(rows) {
  const count = (state) => rows.filter((row) => row.state === state).length;
  const removable = count("removable");
  const guard = count("guard");
  const outOfScope = count("out-of-scope");
  return [
    `compat snapshot: ${rows.length} group(s) recorded`,
    `${count("still-needed")} still needed`,
    ...(removable > 0 ? [`${removable} removable`] : []),
    ...(guard > 0 ? [`${guard} guard`] : []),
    ...(outOfScope > 0 ? [`${outOfScope} out of scope`] : []),
  ].join(", ");
}

// ---------------------------------------------------------------------------------------------

/**
 * Runs `command` and, for `check` and `oracle`, leaves a could-not-run verdict when it exits 2 or
 * throws, so every run of those two commands ends with exactly one verdict file.
 */
async function runWithVerdict(source, command) {
  try {
    await command();
  } catch (error) {
    saveCompatVerdict(
      source,
      couldNotRunVerdict(source, String(error?.message ?? error)),
    );
    throw error;
  }
  if (process.exitCode === 2) {
    saveCompatVerdict(source, couldNotRunVerdict(source, lastFailure));
  }
}

const [command, ...args] = process.argv.slice(2);
if (command === "check") {
  await runWithVerdict("temporal-compat-check", () => check(args));
} else if (command === "snapshot") {
  await snapshot(args);
} else if (command === "oracle") {
  await runWithVerdict("temporal-oracle", () => oracle(args));
} else {
  fail(
    2,
    "Usage: node scripts/temporal-compat.mjs check [--fail-on-removable] | snapshot [--check] | oracle [--chrome=<path>] [--calendars=a,b]",
  );
}
