/**
 * Temporal compat canary and native oracle (CORE-6 calendar-correctness spec §6.3).
 *
 * GMT works around `@js-temporal/polyfill` and runtime-ICU defects in
 * `packages/gmt/src/internal/temporalCompat/` (calendars) and `internal/zonedWallClock*` (zoned
 * range limits). Each workaround has upstream repros in `temporalCompat/repros.ts` whose expected
 * values come from test262 or Chromium's native Temporal — never from the polyfill or GMT.
 *
 * Usage:
 *   node scripts/temporal-compat.mjs check [--fail-on-removable]
 *     Runs every repro against the installed polyfill and prints, per workaround, which probes are
 *     STILL NEEDED or REMOVABLE, with the removal trigger, and the removal steps once every probe of
 *     a workaround passes. Exit 0 whenever it ran: "upstream still broken" is never a failure.
 *     `--fail-on-removable` (manual release checklist only, never CI) exits 1 when any workaround is
 *     removable. Needs `pnpm build` (exit 2 without `packages/gmt/dist`).
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

// fileURLToPath, not `.pathname`: see scripts/test-markers.mjs — a percent-encoded path breaks
// any checkout whose directory name contains a space.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GMT_DIR = join(ROOT, "packages/gmt");
const DIST = join(GMT_DIR, "dist");
const COMPAT_README = "packages/gmt/src/internal/temporalCompat/README.md";

// ---------------------------------------------------------------------------------------------
// Workarounds: removal triggers (spec §6.5) and removal steps (spec §6.4, compat README)
// ---------------------------------------------------------------------------------------------

const WORKAROUNDS = [
  {
    defects: ["D1"],
    title:
      "D1 — calendar fields → ISO, add, until and Duration relativeTo near the limits (temporalCompat)",
    trigger:
      "a js-temporal release ports proposal-temporal a41eb67 (+ af0cb4b) and becomes GMT's @js-temporal/polyfill floor (upstream-issue draft C)",
    steps: [
      "Delete the D1 entries in repros.ts, the D1 term of needsFieldSearch in calendarDateFromFields.ts, and the D1 fallbacks in calendarDateArithmetic.ts (the catch branch of calendarDateAdd, the D1 term of untilWorkaroundNeeded).",
      "Delete fieldSearch.ts + test once no range guard (D2–D5) is left.",
      `Full wording: ${COMPAT_README} § Removal steps 1.`,
    ],
  },
  {
    defects: ["D2"],
    title: "D2 — buddhist read through ICU4C's Julian/Gregorian hybrid",
    trigger: "a js-temporal release contains 2bb6ba1 (already on main)",
    steps: [
      "Delete buddhistFields' arithmetic branch, the buddhist case of hasReadCorrection, usesIsoArithmetic in calendarDateArithmetic.ts, and the D2 repros.",
      `Full wording: ${COMPAT_README} § Removal steps 2.`,
    ],
  },
  {
    defects: ["D3", "D4"],
    title:
      "D3 + D4 — Hebrew years <= 0 (polyfill leap-year %, ICU4C one day off)",
    trigger:
      "BOTH a js-temporal release ports proposal-temporal 0df570c AND GMT's engines.node floor bundles an ICU containing 5267bb5778 (ICU-23007)",
    steps: [
      "Delete hebrewArithmetic.ts + test, hebrewFields' arithmetic branch, the hebrew case of hasReadCorrection and ownedModels, and the D3/D4 repros.",
      `Full wording: ${COMPAT_README} § Removal steps 3.`,
    ],
  },
  {
    defects: ["D5"],
    title: "D5 — Indian before ISO year 1 (stale V8 bug 10529 detector)",
    trigger: "a js-temporal release ports proposal-temporal 314b112",
    steps: [
      "Delete indianArithmetic.ts + test, indianFields' arithmetic branch, the indian case of hasReadCorrection and ownedModels, and the D5 repros; fixedDay.ts once unused.",
      `Full wording: ${COMPAT_README} § Removal steps 4.`,
    ],
  },
  {
    defects: ["D6"],
    title: "D6 — non-ISO until re-constrains the day while counting months",
    trigger: "a js-temporal release contains 10aeb98 (already on main)",
    steps: [
      "Delete the D6 repros and the D6 terms in calendarDateArithmetic.ts.",
      `Full wording: ${COMPAT_README} § Removal steps 5.`,
    ],
  },
  {
    defects: ["D7"],
    title:
      "D7 — Hebrew until by years throws mixed-sign (tc39/proposal-temporal#3159)",
    trigger: "a js-temporal release ports proposal-temporal 0e32ee0",
    steps: [
      "Delete the D7 repro and the D7 terms in calendarDateArithmetic.ts.",
      `Full wording: ${COMPAT_README} § Removal steps 5.`,
    ],
  },
  {
    defects: ["D8"],
    title: "D8 — japanese pre-proposal era codes",
    trigger: "a js-temporal release contains 2bb6ba1",
    steps: [
      "Delete japaneseFields' remap, PRE_PROPOSAL_ERAS, and the D8 repros.",
      `Full wording: ${COMPAT_README} § Removal steps 7.`,
    ],
  },
  {
    defects: ["D9"],
    title:
      "D9 — non-ISO months added and counted one month at a time (heap OOM for in-range amounts; temporalCompat/largeMonthSpan.ts)",
    trigger:
      "a js-temporal release adds and differences non-ISO months in bounded work: each D9 probe reads at most 100 Intl dates for 1,200 months",
    steps: [
      "Delete largeMonthSpan.ts, its two calls in readArithmeticModel.ts (addMonths, monthsBetween), the two D9 branches in calendarDateArithmetic.ts, and the D9 repros with withBoundedIntlReads in repros.ts.",
      "Keep largeMonthArithmetic.test.ts: its rows are spec values and must still pass, in bounded time, on the fixed polyfill.",
      `Full wording: ${COMPAT_README} § Removal steps 9.`,
    ],
  },
  {
    defects: ["zoned.A"],
    title:
      "zoned.A — wall clock → exact time at the range limits (zonedWallClock.ts defect 1, zonedWallClockDifference.ts defect 1)",
    trigger:
      "a js-temporal release contains 05ce7a3 (fixes the max.* probes only) AND an upstream fix for the minimum edge (min.* probes still fail with 05ce7a3 applied); upstream-issue draft A must ask for both",
    steps: [
      "Delete the defect-1 fallbacks described in the header notes of internal/zonedWallClock.ts and internal/zonedWallClockOperations.ts, and the *AtLimit fallbacks with their mirrored abstract operations in internal/zonedWallClockDifference.ts; each wrapper returns its plain polyfill call.",
      "Delete the zoned.A repros. Run internal/zonedWallClock*.test.ts: no expected value changes.",
    ],
  },
  {
    defects: ["zoned.B"],
    title:
      "zoned.B — next transition missed near the maximum (zonedWallClock.ts defect 2)",
    trigger:
      "a js-temporal release fixes GetNamedTimeZoneNextTransition near the maximum (upstream-issue draft B; not fixed on main)",
    steps: [
      "Delete the defect-2 (transition-less null) fallback described in the header note of internal/zonedWallClock.ts, and the zoned.B repros.",
      "Run internal/zonedWallClock*.test.ts: no expected value changes.",
    ],
  },
  {
    defects: ["zoned.D"],
    title:
      "zoned.D — UTC fast path skips IsValidEpochNanoseconds (zonedWallClockDifference.ts defect 2)",
    trigger:
      "a js-temporal release validates the UTC fast path of GetPossibleEpochNanoseconds (upstream-issue draft D; not fixed on main)",
    steps: [
      "Delete checkUtcValidity and its call in runAtRangeLimit (internal/zonedWallClockDifference.ts), and the zoned.D repros.",
      "Run internal/zonedWallClockDifference.test.ts: no expected value changes.",
    ],
  },
];

const CALENDAR_DEFECTS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

function fail(code, message) {
  console.error(message);
  process.exitCode = code;
}

function requireDist() {
  if (!existsSync(join(DIST, "internal/temporalCompat/repros.js"))) {
    fail(2, "packages/gmt/dist is missing: run pnpm build first");
    return false;
  }
  return true;
}

/** The installed `@js-temporal/polyfill` version, resolved the way packages/gmt resolves it. */
function polyfillVersion() {
  const entry = createRequire(join(GMT_DIR, "package.json")).resolve(
    "@js-temporal/polyfill",
  );
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const { name, version } = JSON.parse(readFileSync(manifest, "utf8"));
    if (name === "@js-temporal/polyfill") return version;
  }
  return "unknown";
}

function runtimeLine() {
  return `@js-temporal/polyfill ${polyfillVersion()} (Node ${process.version}, ICU ${process.versions.icu ?? "none"})`;
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

// ---------------------------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------------------------

async function check(args) {
  if (!requireDist()) return;
  const compat = join(DIST, "internal/temporalCompat");
  const { repros } = await import(
    pathToFileURL(join(compat, "repros.js")).href
  );
  const { runRepro, reproPasses } = await import(
    pathToFileURL(join(compat, "capabilities.js")).href
  );

  console.log(runtimeLine());
  console.log("");

  const covered = new Set(WORKAROUNDS.flatMap((w) => w.defects));
  const unknown = repros.filter((repro) => !covered.has(repro.defect));
  if (unknown.length > 0) {
    fail(
      2,
      `repros with no workaround group in temporal-compat.mjs: ${[...new Set(unknown.map((r) => r.defect))].join(", ")}`,
    );
    return;
  }

  const removable = [];
  for (const workaround of WORKAROUNDS) {
    const results = repros
      .filter((repro) => workaround.defects.includes(repro.defect))
      .map((repro) => {
        const output = runRepro(repro);
        return { repro, output, passes: reproPasses(repro, output) };
      });
    const passing = results.filter((result) => result.passes).length;
    const allPass = results.length > 0 && passing === results.length;

    console.log(workaround.title);
    console.log(`  Remove when: ${workaround.trigger}`);
    for (const { repro, output, passes } of results) {
      const calendar = repro.calendar === "iso8601" ? "" : ` ${repro.calendar}`;
      const label = `${repro.defect}.${repro.name}${calendar}`.padEnd(42);
      console.log(
        passes
          ? `  ${label} REMOVABLE (returns spec value)`
          : `  ${label} STILL NEEDED (${truncate(output, 90)})`,
      );
    }
    if (allPass) {
      removable.push(workaround);
      console.log(
        `  => REMOVABLE: all ${results.length} probes return the spec value. Steps:`,
      );
      workaround.steps.forEach((step, index) =>
        console.log(`     ${index + 1}. ${step}`),
      );
    } else {
      console.log(
        `  => STILL NEEDED: ${results.length - passing} of ${results.length} probes fail`,
      );
      if (
        workaround.defects.includes("zoned.A") &&
        results.every(
          ({ repro, passes }) => passes || !repro.name.startsWith("max."),
        )
      ) {
        console.log(
          "     Every max.* probe passes but a min.* probe fails: 05ce7a3 alone does not retire this workaround.",
        );
      }
    }
    console.log("");
  }

  const calendarDone = WORKAROUNDS.filter((w) =>
    w.defects.some((defect) => CALENDAR_DEFECTS.includes(defect)),
  ).every((w) => removable.includes(w));
  if (calendarDone) {
    console.log(
      `D1–D7 are all removable: also delete nonIsoArithmetic.ts, readArithmeticModel.ts and the whole-operation seams (${COMPAT_README} § Removal steps 6).`,
    );
  }
  if (removable.length === WORKAROUNDS.length) {
    console.log(
      "Every workaround is removable (spec §6.4 Final removal): inline or keep temporalCompat/index.ts as a facade, delete temporalCompat/ and these check groups, keep `oracle`, bump the dependency floor, and add a changeset note (drops workarounds; no behaviour change).",
    );
  }
  console.log(
    `${removable.length} of ${WORKAROUNDS.length} workarounds removable on this runtime.`,
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
 * (test262 wins, spec §0/§6.3). Each entry names its test262 file and matches mismatches by
 * `{ scan, calendar, op }` plus an optional `row` predicate. All owner decisions (spec §9) are
 * resolved, so no row is tagged for an open decision.
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

/** Temporal calendar id in the scan → GMT's public CalendarSystem name. */
const GMT_CALENDAR = {
  buddhist: "buddhist",
  hebrew: "hebrew",
  "islamic-civil": "islamic-civil",
  "islamic-tbla": "islamic-tabular",
  "islamic-umalqura": "islamic-umalqura",
  persian: "persian",
  indian: "indian",
  ethioaa: "ethiopic-amete-alem",
  japanese: "japanese",
  roc: "taiwan",
  gregory: "gregorian",
};

/** GMT's calendar year digits (coding-standards E1 with PadISOYear signs). */
function calendarYear(year) {
  return year < 0
    ? `-${String(-year).padStart(6, "0")}`
    : String(year).padStart(4, "0");
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
function runTwin(native, calendars, dateString, gmt, compare) {
  const { xscan, grid } = native;
  const expectDate = (nativeIso, calendar) =>
    nativeIso === "ERR" ? "" : (dateString(nativeIso, calendar) ?? "");
  const expectValue = (value) => (value === "ERR" ? "" : value);

  for (const calendar of calendars) {
    const gmtCalendar = GMT_CALENDAR[calendar];
    if (!gmtCalendar)
      throw new Error(`scan calendar ${calendar} has no GMT name`);

    for (const [tag, edgeIso, dir] of [
      ["max", xscan.max, -1],
      ["min", xscan.min, 1],
    ]) {
      const edge = dateString(edgeIso, calendar);
      const far = dateString(
        addIsoDays(edgeIso, dir * xscan.farDays),
        calendar,
      );
      xscan.edge[calendar][tag].forEach((row, n) => {
        const iso = addIsoDays(edgeIso, dir * n);
        const at = { scan: `xscan.edge.${tag}`, calendar, row: n, iso };
        if (row.length === 1) {
          compare(
            { ...at, op: "read", input: iso, native: "ERR", expected: "" },
            () => gmt.convertDateToCalendar(iso, gmtCalendar),
          );
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
        compare(
          {
            ...at,
            op: "read",
            input: iso,
            native: row[0],
            expected: date ?? "",
          },
          () => gmt.convertDateToCalendar(iso, gmtCalendar),
        );
        if (date === null) return;
        compare(
          {
            ...at,
            op: "fromFields",
            input: date,
            native: fromFields,
            expected: expectValue(fromFields),
          },
          () => gmt.convertDateToCalendar(date, "gregorian"),
        );
        compare(
          {
            ...at,
            op: "isValidCalendarDate",
            input: date,
            native: fromFields,
            expected: String(fromFields !== "ERR"),
          },
          () => String(gmt.isValidCalendarDate(date)),
        );
        compare(
          {
            ...at,
            op: "addMonth",
            input: date,
            native: addMonth,
            expected: expectDate(addMonth, calendar),
          },
          () => gmt.addDate(date, { months: 1 }),
        );
        compare(
          {
            ...at,
            op: "addYear",
            input: date,
            native: addYear,
            expected: expectDate(addYear, calendar),
          },
          () => gmt.addDate(date, { years: 1 }),
        );
        compare(
          {
            ...at,
            op: "subtractMonth",
            input: date,
            native: subMonth,
            expected: expectDate(subMonth, calendar),
          },
          () => gmt.subtractDate(date, { months: 1 }),
        );
        compare(
          {
            ...at,
            op: "subtractYear",
            input: date,
            native: subYear,
            expected: expectDate(subYear, calendar),
          },
          () => gmt.subtractDate(date, { years: 1 }),
        );
        if (edge !== null) {
          const [from, to] = dir < 0 ? [date, edge] : [edge, date];
          compare(
            {
              ...at,
              op: "untilEdgeMonths",
              input: `${from} → ${to}`,
              native: untilEdge,
              expected: expectValue(untilEdge),
            },
            () => gmt.diffDateAsDuration(from, to, "months"),
          );
        }
        if (far !== null) {
          const [from, to] = dir < 0 ? [far, date] : [date, far];
          compare(
            {
              ...at,
              op: "untilFarYears",
              input: `${from} → ${to}`,
              native: untilFar,
              expected: expectValue(untilFar),
            },
            () => gmt.diffDateAsDuration(from, to, "years"),
          );
        }
      });
    }

    xscan.stride[calendar].forEach((row, k) => {
      const [iso, read, fromFields, addMonth, addYear, untilYears] = row;
      const at = { scan: "xscan.stride", calendar, row: k, iso };
      if (read === "ERR") {
        compare(
          { ...at, op: "read", input: iso, native: "ERR", expected: "" },
          () => gmt.convertDateToCalendar(iso, gmtCalendar),
        );
        return;
      }
      const date = dateString(iso, calendar);
      compare(
        { ...at, op: "read", input: iso, native: read, expected: date ?? "" },
        () => gmt.convertDateToCalendar(iso, gmtCalendar),
      );
      if (date === null) return;
      compare(
        {
          ...at,
          op: "fromFields",
          input: date,
          native: fromFields,
          expected: expectValue(fromFields),
        },
        () => gmt.convertDateToCalendar(date, "gregorian"),
      );
      compare(
        {
          ...at,
          op: "addMonth",
          input: date,
          native: addMonth,
          expected: expectDate(addMonth, calendar),
        },
        () => gmt.addDate(date, { months: 1 }),
      );
      compare(
        {
          ...at,
          op: "addYear",
          input: date,
          native: addYear,
          expected: expectDate(addYear, calendar),
        },
        () => gmt.addDate(date, { years: 1 }),
      );
      const later = dateString(
        addIsoDays(iso, xscan.strideUntilDays),
        calendar,
      );
      if (later !== null) {
        compare(
          {
            ...at,
            op: "untilYears",
            input: `${date} → ${later}`,
            native: untilYears,
            expected: expectValue(untilYears),
          },
          () => gmt.diffDateAsDuration(date, later, "years"),
        );
      }
    });

    grid.rows[calendar].forEach((row, i) => {
      const iso = addIsoDays(grid.base, i);
      const date = dateString(iso, calendar);
      if (date === null) return;
      const at = { scan: "grid", calendar, row: i, iso };
      grid.offsets.forEach((offset, j) => {
        const other = dateString(addIsoDays(grid.base, i + offset), calendar);
        if (other === null) return;
        const [months, years, yearsBack] = row.slice(1 + 3 * j, 4 + 3 * j);
        compare(
          {
            ...at,
            op: `until+${offset}Months`,
            input: `${date} → ${other}`,
            native: months,
            expected: expectValue(months),
          },
          () => gmt.diffDateAsDuration(date, other, "months"),
        );
        compare(
          {
            ...at,
            op: `until+${offset}Years`,
            input: `${date} → ${other}`,
            native: years,
            expected: expectValue(years),
          },
          () => gmt.diffDateAsDuration(date, other, "years"),
        );
        compare(
          {
            ...at,
            op: `until-${offset}Years`,
            input: `${other} → ${date}`,
            native: yearsBack,
            expected: expectValue(yearsBack),
          },
          () => gmt.diffDateAsDuration(other, date, "years"),
        );
      });
      const tail = 1 + 3 * grid.offsets.length;
      const [addMonth, addMonthReject, addYear, subtract13] = row
        .slice(tail)
        .map((value) => (value === "ERR" ? "ERR" : stripAnnotation(value)));
      compare(
        {
          ...at,
          op: "addMonth",
          input: date,
          native: addMonth,
          expected: expectDate(addMonth, calendar),
        },
        () => gmt.addDate(date, { months: 1 }),
      );
      compare(
        {
          ...at,
          op: "addMonthReject",
          input: date,
          native: addMonthReject,
          expected: expectDate(addMonthReject, calendar),
        },
        () => gmt.addDate(date, { months: 1 }, { overflow: "reject" }),
      );
      compare(
        {
          ...at,
          op: "addYear",
          input: date,
          native: addYear,
          expected: expectDate(addYear, calendar),
        },
        () => gmt.addDate(date, { years: 1 }),
      );
      compare(
        {
          ...at,
          op: "subtract13Months",
          input: date,
          native: subtract13,
          expected: expectDate(subtract13, calendar),
        },
        () => gmt.subtractDate(date, { months: 13 }),
      );
    });
  }
}

/** Builds `dateString` over native reads: `year|month|day|era|eraYear` per `iso|calendar`. */
function dateStringFromReads(reads) {
  return (iso, calendar) => {
    if (calendar === "gregory") return iso;
    const read = reads.get(`${iso}|${calendar}`);
    if (read === undefined)
      throw new Error(`no native read for ${iso} ${calendar}`);
    if (read === "ERR") return null;
    const [year, month, day, era, eraYear] = read.split("|");
    const japanese = calendar === "japanese";
    const yearText = calendarYear(Number(japanese ? eraYear : year));
    const suffix = japanese ? `;era=${era}` : "";
    return `${yearText}-${month.padStart(2, "0")}-${day.padStart(2, "0")}[u-ca=${GMT_CALENDAR[calendar]}${suffix}]`;
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
      if (calendar !== "gregory")
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

async function oracle(args) {
  if (!requireDist()) return;
  const chromePath = args
    .find((arg) => arg.startsWith("--chrome="))
    ?.slice("--chrome=".length);
  const only = args
    .find((arg) => arg.startsWith("--calendars="))
    ?.slice("--calendars=".length)
    .split(",")
    .filter(Boolean);
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
  const counts = { comparisons: 0, mismatches: 0, tagged: 0, untagged: 0 };
  const groups = new Map();
  const stored = [];

  for (const calendar of calendars) {
    const started = Date.now();
    runTwin(native.scan, [calendar], dateString, gmt, (row, run) => {
      counts.comparisons++;
      let actual;
      try {
        actual = run();
      } catch (error) {
        actual = `THREW ${error?.name}: ${error?.message}`;
      }
      if (actual === row.expected) return;
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
    });
    console.log(
      `GMT twin: ${calendar} done in ${((Date.now() - started) / 1000).toFixed(1)} s`,
    );
  }

  const summary = [
    runtimeLine(),
    `Chromium ${native.browserVersion}${only ? ` (calendars: ${calendars.join(", ")})` : ""}`,
    `${counts.comparisons} comparisons, ${counts.mismatches} mismatches (${counts.tagged} tagged, ${counts.untagged} untagged)`,
    ...[...groups.values()].map(
      ({ key, count, example }) =>
        `  ${key}: ${count} (e.g. row ${example.row} ${example.iso}: input ${example.input} | native ${example.native} | expected ${JSON.stringify(example.expected)} | gmt ${JSON.stringify(example.gmt)})`,
    ),
  ].join("\n");

  const date = new Date().toISOString().slice(0, 10);
  const artifacts = join(ROOT, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  const jsonPath = join(artifacts, `temporal-oracle-${date}.json`);
  const textPath = join(artifacts, `temporal-oracle-${date}.txt`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
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

// ---------------------------------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);
if (command === "check") {
  await check(args);
} else if (command === "oracle") {
  await oracle(args);
} else {
  fail(
    2,
    "Usage: node scripts/temporal-compat.mjs check [--fail-on-removable] | oracle [--chrome=<path>] [--calendars=a,b]",
  );
}
