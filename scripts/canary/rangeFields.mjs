#!/usr/bin/env node
/**
 * The weekly sweep for D29 (CORE-112): `formatRange` text that drops, repeats or garbles a field
 * of one date. It runs GMT's own detector (`internal/rangeDetector`, which reads only `format` and
 * `formatRange`) over every locale, calendar and option set, and checks it against an oracle that
 * reads the engine's `formatRangeToParts`.
 *
 * The recorded repros in `temporalCompat/rangeFieldRepros.ts` cannot see a new locale's pattern.
 * This sweep can: the locale list is the directory listing of the `cldr-dates-full` package for the
 * CLDR version the engine reports, fetched at run time with `npm pack` into a temporary directory,
 * never a dependency and never shipped (`scripts/lib/cldr-locales.mjs`), then filtered by
 * `Intl.DateTimeFormat.supportedLocalesOf`.
 *
 * The oracle. A range's parts name the start's and the end's half. The oracle moves only the
 * start, then only the end, to see which parts belong to which half, then checks that each half
 * holds every field its date's own `formatToParts` prints, no field twice, and no number with
 * another value. It runs on 8 fixed probe ranges in a child process, because V8 without commit
 * 0426b0d1045d aborts the process in a parts call on a week-of-year year pattern (D23,
 * nodejs/node#67076): a child that exits on a signal is read from its marker file, that call is
 * skipped, and the child restarts after it. A formatter whose single `formatToParts` aborts is left
 * out of the oracle.
 *
 * What fails the run (exit 1):
 *
 * 1. A false negative: the oracle finds a probe range wrong and the detector does not flag the
 *    formatter.
 * 2. A flag nothing confirms. A flag is confirmed by the probe oracle, or by the same oracle on
 *    ranges derived from the probes (start earlier, end later, both moved). What is left must be a
 *    run-together text defect: a number printed with no separator, as in `2024年515日`, which no
 *    parts oracle can see because the engine labels the parts correctly. A flag that is neither
 *    confirmed nor run-together is a detector false positive, apart from three kinds the report
 *    keeps by locale and that never fail the run: a flag the day period check confirms (the range
 *    text lacks a day period string that a single time of the pair prints: counted under
 *    `dayPeriodB`); a flag of the detector's field-order kind (`fieldOrder`); and a flag raised
 *    only by the era pair (`eraText`), which the oracle does not probe because its far-BC years
 *    give false negatives. Any other flag is a false positive. A formatter whose parts calls abort
 *    is not judged on this count.
 *
 * What never fails it: a locale that is no longer flagged, and a repro of
 * `temporalCompat/rangeFieldRepros.ts` that now passes. Both appear in the report as fixed.
 *
 * The report (`--out report.json`) holds counts and the flagged locales per cause: `relatedYear`
 * (chinese and dangi years a year apart without the related year), `dayPeriodB` (a `B` day period
 * dropped), `hebrewMonth` (the end's month with the wrong value), `pattern` (a malformed CLDR
 * pattern), plus `runTogether`. `--diff previous.json current.json` prints the locales that newly
 * break and the ones that are fixed as Markdown, for a job summary.
 *
 * Needs `packages/gmt/dist` (run `pnpm build` first). Options: `--locales gd,ksh` and
 * `--calendars gregory,hebrew` for a quick run, `--shard 2/3` for every third locale starting at
 * the second, `--jobs 4` for the child processes at once (default: the CPU count), `--out file`.
 * The calendars are `Intl.supportedValuesOf("calendar")` without `islamic` and `islamic-rgsa`,
 * which GMT resolves to other calendars before any formatter is built (D30).
 * Exits 1 on any failure, 2 when it cannot run.
 */
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { argument, localeList } from "../lib/cldr-locales.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** The built library; `RANGE_FIELDS_DIST` names another copy of it (a long run on a fixed build). */
const DIST = process.env.RANGE_FIELDS_DIST ?? join(ROOT, "packages/gmt/dist");
const SCRIPT = fileURLToPath(import.meta.url);

const n = "numeric";
const s = "short";
const l = "long";
const d2 = "2-digit";

/** The 75 option sets of the D29 sweep. */
const OPTION_SETS = [
  { year: n },
  { year: d2 },
  { year: n, month: n },
  { year: n, month: d2 },
  { year: d2, month: d2 },
  { year: n, month: s },
  { year: n, month: l },
  { year: n, month: "narrow" },
  { year: n, month: n, day: n },
  { year: d2, month: d2, day: d2 },
  { year: n, month: s, day: n },
  { year: n, month: l, day: n },
  { year: n, month: n, day: n, weekday: s },
  { year: n, month: s, day: n, weekday: s },
  { year: n, month: l, day: n, weekday: l },
  { era: s, year: n },
  { era: s, year: n, month: l },
  { era: s, year: n, month: n, day: n },
  { era: s, year: n, month: s, day: n },
  { era: s, year: n, month: n, day: n, weekday: s },
  { era: l, year: n, month: l, day: n, weekday: l },
  { dateStyle: "full" },
  { dateStyle: "long" },
  { dateStyle: "medium" },
  { dateStyle: "short" },
  { year: n, month: s, day: n, hour: n, minute: n },
  { dateStyle: "full", timeStyle: "short" },
  { dateStyle: "short", timeStyle: "long" },
  { month: l, day: n, weekday: l },
  { hour: n, minute: n },
  { weekday: s, month: n, day: n },
  { weekday: s, month: s, day: n },
  { weekday: l, month: l, day: n },
  { weekday: s, day: n },
  { month: n, day: n },
  { month: s, day: n },
  { month: l, day: n },
  { day: n },
  { month: s },
  { month: l },
  { month: n },
  { weekday: l },
  { era: s, year: n, month: n },
  { era: s, year: n, month: s },
  { era: l, year: n, month: s, day: n, weekday: s },
  { era: "narrow", year: n, month: n, day: n },
  { hour: n },
  { hour: n, hourCycle: "h23" },
  { hour: n, minute: n, hourCycle: "h23" },
  { hour: n, minute: n, hourCycle: "h12" },
  { hour: n, minute: n, hourCycle: "h11" },
  { hour: n, minute: n, hourCycle: "h24" },
  { hour: n, dayPeriod: s },
  { hour: n, minute: n, dayPeriod: s },
  { hour: n, minute: n, dayPeriod: l },
  { hour: n, minute: n, timeZoneName: s },
  { hour: n, timeZoneName: s },
  { hour: n, minute: n, second: n },
  { weekday: s, hour: n, minute: n },
  { day: n, hour: n, minute: n },
  { year: n, month: n, day: n, hour: n, minute: n },
  { year: n, month: n, day: n, weekday: s, hour: n, minute: n },
  { month: s, day: n, weekday: s, hour: n, minute: n },
  { era: s, year: n, month: n, day: n, hour: n, minute: n },
  { dateStyle: "medium", timeStyle: "short" },
  { dateStyle: "long", timeStyle: "short" },
  { timeStyle: "short" },
  { timeStyle: "medium" },
  { year: n, month: d2, day: d2 },
  { hour: d2, minute: d2 },
  { weekday: "narrow", year: n, month: "narrow", day: n },
  { year: d2, month: n, day: n, weekday: s },
  { year: n, month: s, day: n, weekday: l },
  { year: n, month: l, day: n, weekday: s },
  { hour: n, minute: n, hour12: true, timeZoneName: l },
];

const MIN = 60_000;
const HR = 60 * MIN;
const DY = 24 * HR;

/**
 * The probe ranges, as UTC epoch milliseconds, with the largest field that differs: year, month,
 * day, day period, hour, minute, year, day. The same pairs as the detector's.
 */
const PROBES = [
  ["y", 1715779500000, 1763656800000],
  ["M", 1715779500000, 1718901600000],
  ["d", 1715779500000, 1715964000000],
  ["a", 1715765100000, 1715791200000],
  ["h", 1715779500000, 1715791200000],
  ["m", 1715779500000, 1715780400000],
  ["y", 1720622100000, 1752158100000],
  ["d", 1720622100000, 1720794900000],
];
/** The era pairs: Heisei to Reiwa in the japanese calendar, and 101 BC to AD in the others. */
const ERA_PROBES = {
  japanese: ["G", 1468161300000, 1594391700000],
  other: ["G", -65306424300000, 1752158100000],
};
const probeCache = new Map();

/** The eight probes with the calendar's era pair, and the ranges derived from them. */
function probesFor(calendar) {
  if (!probeCache.has(calendar)) {
    const era =
      calendar === "japanese" ? ERA_PROBES.japanese : ERA_PROBES.other;
    probeCache.set(calendar, {
      probes: [...PROBES, era],
      derived: derivedRanges([...PROBES, era]),
    });
  }
  return probeCache.get(calendar);
}
/** The greatest-difference limit of each class: a one-sided move below it keeps the pattern. */
const LIMIT = {
  y: Infinity,
  G: Infinity,
  M: 367 * DY,
  d: 32 * DY,
  a: DY,
  B: DY,
  h: DY,
  m: 61 * MIN,
};
/** Instant moves: minute, hour, 4 hours, a day, a week, a month, a year, 60 years, an hour back. */
const MOVES = [
  MIN,
  61 * MIN,
  4 * HR,
  DY + 61 * MIN,
  7 * DY,
  32 * DY + 61 * MIN,
  367 * DY + 61 * MIN,
  21915 * DY,
  -61 * MIN,
];
const CYCLIC = new Set(["chinese", "dangi"]);
/** Calendars GMT never hands to an engine as they are (D30). */
const NOT_SWEPT = new Set(["islamic", "islamic-rgsa"]);

/** The step number of the oracle's first parts call on the derived ranges (a marker value). */
const EXTENDED = 1000;

// ---------------------------------------------------------------------------------------------
// The oracle (child processes only: it calls the parts methods)
// ---------------------------------------------------------------------------------------------

/** Every digit character of every script, with its digit value. */
function digitTable() {
  const table = new Map();
  let run = 0;
  let prev = -2;
  for (let c = 0; c < 0x20000; c++) {
    const ch = String.fromCodePoint(c);
    if (/\p{Nd}/u.test(ch)) {
      run = c === prev + 1 ? run + 1 : 0;
      table.set(ch, run % 10);
      prev = c;
    }
  }
  return table;
}

const BIDI = /[‎‏؜  ]/gu;

/** A part's value: `N` and the number for a digit string in any script, else `S` and the text. */
function normalise(digits, value) {
  const text = value.replace(BIDI, " ").trim();
  if (text && [...text].every((ch) => digits.has(ch))) {
    return `N${Number([...text].map((ch) => digits.get(ch)).join(""))}`;
  }
  return `S${text.toLocaleLowerCase()}`;
}

/** The ranges the derived oracle adds: each probe with the start earlier, the end later, or both. */
function derivedRanges(probes) {
  const out = [];
  for (const [g, a, b] of probes) {
    out.push([g, a, b]);
    for (const m of MOVES) {
      if (Math.abs(m) < LIMIT[g]) {
        if (a - m < b) {
          out.push([g, a - m, b]);
        }
        if (a < b + m) {
          out.push([g, a, b + m]);
        }
      }
      out.push([g, a - m, b - m]);
    }
  }
  return out;
}

/**
 * Whether each half of each range holds what its date's single prints. Returns the problems; a
 * call that aborts the process is recorded by `mark` first, so the parent can skip it.
 *
 * @param formatter the formatter
 * @param calendar its calendar
 * @param ranges the `[class, start, end]` triples
 * @param base the marker step of the singles call; range `r` is `base + r + 1`
 * @param skip the marker steps already known to abort
 * @param mark records the step about to run
 * @param digits the digit table
 */
function oracle(formatter, calendar, ranges, base, skip, mark, digits) {
  const group = (type) =>
    CYCLIC.has(calendar) && (type === "year" || type === "yearName")
      ? "CY"
      : type;
  const same = (type, x, y) =>
    x === y ||
    ((type === "year" || type === "relatedYear") &&
      x[0] === "N" &&
      y[0] === "N" &&
      Number(x.slice(1)) % 100 === Number(y.slice(1)) % 100);
  const parted = (parts) =>
    parts.map((part) => ({
      type: part.type,
      v: part.type === "literal" ? part.value : normalise(digits, part.value),
    }));
  const shape = (parts) =>
    parts
      .map((part) => (part.type === "literal" ? `L${part.v}` : part.type))
      .join("\u0001");
  const numbered = new Set([
    "year",
    "relatedYear",
    "day",
    "hour",
    "minute",
    "second",
  ]);
  const bad = [];
  const singles = new Map();
  mark(base);
  for (const [, a, b] of ranges) {
    for (const t of [a, b]) {
      if (!singles.has(t)) {
        singles.set(
          t,
          parted(formatter.formatToParts(t)).filter(
            (part) => part.type !== "literal" && part.type !== "timeZoneName",
          ),
        );
      }
    }
  }
  for (let r = 0; r < ranges.length; r++) {
    if (skip.has(base + r + 1)) {
      continue;
    }
    const [g, a, b] = ranges[r];
    mark(base + r + 1);
    const raw = formatter.formatRangeToParts(a, b);
    if (
      !raw.some((p) => p.source === "startRange" || p.source === "endRange")
    ) {
      continue;
    }
    const R = parted(raw);
    const sh = shape(R);
    const changed = (x, y) => {
      const V = parted(formatter.formatRangeToParts(x, y));
      return shape(V) === sh
        ? R.map((p, j) => p.type !== "literal" && p.v !== V[j].v)
        : null;
    };
    let maxA = -1;
    let minB = R.length;
    let nA = 0;
    let nB = 0;
    for (const m of [
      DY + 61 * MIN,
      61 * MIN,
      MIN,
      4 * HR,
      32 * DY + 61 * MIN,
      367 * DY + 61 * MIN,
      -4 * HR,
    ]) {
      const x = a - m;
      if (x < b && a - x < LIMIT[g] && x - a < LIMIT[g]) {
        const c = changed(x, b);
        if (c) {
          nA++;
          c.forEach((v, j) => {
            if (v) {
              maxA = Math.max(maxA, j);
            }
          });
        }
      }
      const y = b + m;
      if (y > a && y - b < LIMIT[g] && b - y < LIMIT[g]) {
        const c = changed(a, y);
        if (c) {
          nB++;
          c.forEach((v, j) => {
            if (v && j < minB) {
              minB = j;
            }
          });
        }
      }
    }
    if (!nA || !nB) {
      continue;
    }
    const A = singles.get(a);
    const B = singles.get(b);
    const half = { a: [], b: [], mid: [] };
    R.forEach((p, j) => {
      if (p.type === "literal" || p.type === "timeZoneName") {
        return;
      }
      (j <= maxA ? half.a : j >= minB ? half.b : half.mid).push(p);
    });
    for (const p of half.mid) {
      const inA = A.some((q) => q.type === p.type && same(p.type, q.v, p.v));
      const inB = B.some((q) => q.type === p.type && same(p.type, q.v, p.v));
      if (inA && !inB) {
        half.a.push(p);
      } else if (inB && !inA) {
        half.b.push(p);
      } else {
        half.a.push({ ...p, shared: 1 });
        half.b.push({ ...p, shared: 1 });
      }
    }
    const all = R.filter((p) => p.type !== "literal");
    for (const [who, S, O, mine] of [
      ["a", A, B, half.a],
      ["b", B, A, half.b],
    ]) {
      for (const G of new Set(S.map((p) => group(p.type)))) {
        const sv = S.filter((p) => group(p.type) === G);
        const ov = O.filter((p) => group(p.type) === G);
        const shared =
          sv.length === ov.length &&
          sv.every(
            (p, j) => p.type === ov[j].type && same(p.type, p.v, ov[j].v),
          );
        if (!(shared ? all : mine).some((p) => group(p.type) === G)) {
          bad.push({ r, g, kind: "missing", who, T: G });
        }
      }
      for (const T of new Set(
        mine.filter((p) => !p.shared).map((p) => p.type),
      )) {
        const count = mine.filter((p) => !p.shared && p.type === T).length;
        const own = S.filter((p) => p.type === T);
        if (own.length && count > own.length) {
          bad.push({ r, g, kind: "twice", who, T });
        }
        if (numbered.has(T) || T === "month") {
          for (const p of mine.filter((q) => !q.shared && q.type === T)) {
            if (
              own.length &&
              p.v[0] === "N" &&
              own[0].v[0] === "N" &&
              !own.some((q) => same(T, q.v, p.v))
            ) {
              bad.push({ r, g, kind: "value", who, T });
            }
          }
        }
      }
    }
  }
  return bad;
}

/** What a set of problems comes from: the groups of the report. */
function causesOf(bad, calendar, options) {
  const causes = new Set();
  for (const b of bad) {
    if ((b.T === "relatedYear" || b.T === "CY") && CYCLIC.has(calendar)) {
      causes.add("relatedYear");
    } else if (b.T === "dayPeriod" && options.dayPeriod) {
      causes.add("dayPeriodB");
    } else if (b.kind === "value" && calendar === "hebrew") {
      causes.add("hebrewMonth");
    } else {
      causes.add("pattern");
    }
  }
  return [...causes];
}

/**
 * What the detector reads from a formatter: `format`, `formatRange` and, when the options ask for a
 * flexible day period, the period a time prints (read from an hour-only formatter of the same
 * locale, calendar, zone and hour cycle, so the detector never calls a parts method on the
 * formatter under test).
 */
function sourceOf(formatter, options) {
  const source = {
    format: (ms) => formatter.format(ms),
    formatRange: (a, b) => formatter.formatRange(a, b),
  };
  if (options.dayPeriod !== undefined) {
    const resolved = formatter.resolvedOptions();
    const reader = new Intl.DateTimeFormat(resolved.locale, {
      calendar: resolved.calendar,
      timeZone: resolved.timeZone,
      hour: "numeric",
      dayPeriod: options.dayPeriod,
      ...(resolved.hourCycle === undefined
        ? {}
        : { hourCycle: resolved.hourCycle }),
    });
    source.dayPeriod = (ms) =>
      reader.formatToParts(ms).find((part) => part.type === "dayPeriod")
        ?.value ?? "";
  }
  return source;
}

/** Pairs inside one AM/PM half, for the day period check: 01:25-02:40, 13:25-14:40, 12:25-18:40, 00:10-06:45 and more. */
const PERIOD_PAIRS = [
  [1715736300000, 1715740800000],
  [1715779500000, 1715784000000],
  [1715775900000, 1715798400000],
  [1715731800000, 1715755500000],
  [1715779500000, 1715780400000],
  [1715779500000, 1715791200000],
  [1715765100000, 1715791200000],
];

/**
 * The day period oracle, for formatters whose options ask for a day period. A range is wrong when
 * its text lacks a day period string that a single time of the pair prints. It reads `formatRange`
 * and the period of an hour-only formatter, and nothing of the detector.
 */
function periodDropped(formatter, options) {
  const resolved = formatter.resolvedOptions();
  const reader = new Intl.DateTimeFormat(resolved.locale, {
    calendar: resolved.calendar,
    timeZone: resolved.timeZone,
    hour: "numeric",
    dayPeriod: options.dayPeriod,
    ...(resolved.hourCycle === undefined
      ? {}
      : { hourCycle: resolved.hourCycle }),
  });
  const periodOf = (ms) =>
    reader.formatToParts(ms).find((part) => part.type === "dayPeriod")?.value ??
    "";
  for (const [a, b] of PERIOD_PAIRS) {
    const first = periodOf(a);
    const second = periodOf(b);
    const text = formatter.formatRange(a, b);
    if (first && second && (!text.includes(first) || !text.includes(second))) {
      return true;
    }
  }
  return false;
}

/** Whether `digits` is a concatenation of two or more members of `parts`. */
function isConcatenation(digits, parts) {
  const reach = Array.from({ length: digits.length + 1 }, () => 0);
  reach[0] = 1;
  for (let at = 0; at < digits.length; at++) {
    if (reach[at]) {
      for (const part of parts) {
        if (digits.startsWith(part, at)) {
          reach[at + part.length] = Math.max(
            reach[at + part.length],
            reach[at] + 1,
          );
        }
      }
    }
  }
  return reach[digits.length] > 2;
}

/**
 * A run-together text defect: some probe range prints a digit run that neither single prints and
 * that is two or more of the singles' digit runs written with no separator (`515` for 5 and 15).
 * The engine labels such parts correctly, so no parts oracle sees it.
 */
function runTogether(formatter, digits, probes) {
  const runs = (text) =>
    (text.match(/\p{Nd}+/gu) ?? []).map((run) =>
      [...run].map((ch) => digits.get(ch)).join(""),
    );
  for (const [g, a, b] of probes) {
    const known = new Set([
      ...runs(formatter.format(a)),
      ...runs(formatter.format(b)),
    ]);
    for (const run of runs(formatter.formatRange(a, b))) {
      if (!known.has(run) && isConcatenation(run, [...known])) {
        return g;
      }
    }
  }
  return "";
}

// ---------------------------------------------------------------------------------------------
// The child: one locale, every calendar and option set, from a resume point
// ---------------------------------------------------------------------------------------------

async function child(jobPath) {
  const job = JSON.parse(readFileSync(jobPath, "utf8"));
  const { rangeVerdict } = await import(
    pathToFileURL(join(DIST, "internal/rangeDetector.js")).href
  );
  const digits = digitTable();
  const markerFd = openSync(job.marker, "w");
  const outFd = openSync(job.out, "a");
  const mark = (step, i) => {
    const text = Buffer.from(`${i}:${step}`.padEnd(24));
    writeSync(markerFd, text, 0, text.length, 0);
  };
  for (let c = 0; c < job.calendars.length; c++) {
    const calendar = job.calendars[c];
    for (let k = 0; k < OPTION_SETS.length; k++) {
      const i = c * OPTION_SETS.length + k;
      if (i < job.from) {
        continue;
      }
      const skip = new Set(i === job.from ? job.skip : []);
      const options = { ...OPTION_SETS[k], calendar, timeZone: "UTC" };
      const record = { locale: job.locale, calendar, k };
      let formatter;
      try {
        formatter = new Intl.DateTimeFormat(job.locale, options);
      } catch {
        writeSync(outFd, `${JSON.stringify({ ...record, ctor: true })}\n`);
        continue;
      }
      const mk = (step) => mark(step, i);
      try {
        const verdict = rangeVerdict(sourceOf(formatter, options), calendar);
        record.flagged = verdict.flagged;
        record.kind = verdict.kind;
        record.classes = verdict.classes.join("");
        const unknown = verdict.classes.filter((c) => !(c in LIMIT));
        if (unknown.length) {
          record.threw = `detector class ${unknown.join("")} is not in LIMIT and PROBES of this script`;
        }
      } catch (error) {
        record.threw = String(error);
      }
      record.singleAbort = skip.has(0);
      record.rangeAborts = [...skip].filter(
        (x) => x > 0 && x < EXTENDED,
      ).length;
      record.extAborts = [...skip].filter((x) => x >= EXTENDED).length;
      if (!record.singleAbort) {
        const { probes, derived } = probesFor(calendar);
        const bad = oracle(formatter, calendar, PROBES, 0, skip, mk, digits);
        record.causes = causesOf(bad, calendar, OPTION_SETS[k]);
        record.bad = bad.length;
        if (record.flagged && bad.length === 0 && !skip.has(EXTENDED)) {
          const more = oracle(
            formatter,
            calendar,
            derived,
            EXTENDED,
            skip,
            mk,
            digits,
          );
          record.extCauses = causesOf(more, calendar, OPTION_SETS[k]);
          record.extBad = more.length;
          if (more.length === 0) {
            record.period =
              options.dayPeriod !== undefined &&
              periodDropped(formatter, options);
            if (!record.period) {
              record.togetherProbe = runTogether(formatter, digits, probes);
              record.together = record.togetherProbe !== "";
            }
          }
        }
      }
      writeSync(outFd, `${JSON.stringify(record)}\n`);
    }
  }
  mark("DONE", 0);
  closeSync(markerFd);
  closeSync(outFd);
}

// ---------------------------------------------------------------------------------------------
// The parent
// ---------------------------------------------------------------------------------------------

/** Runs the child for one locale until it finishes, restarting it after each abort. */
async function sweepLocale(locale, calendars, directory) {
  const marker = join(directory, `${locale}.marker`);
  const out = join(directory, `${locale}.jsonl`);
  let from = 0;
  let skip = [];
  let aborts = 0;
  for (;;) {
    const jobPath = join(directory, `${locale}.job.json`);
    writeFileSync(
      jobPath,
      JSON.stringify({ locale, calendars, marker, out, from, skip }),
    );
    const exit = await new Promise((resolve) => {
      const proc = spawn(process.execPath, [SCRIPT, "--child", jobPath], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk).slice(-300);
      });
      const timer = setTimeout(() => proc.kill("SIGKILL"), 30 * 60_000);
      proc.on("exit", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stderr });
      });
    });
    const where = existsSync(marker) ? readFileSync(marker, "utf8").trim() : "";
    if (exit.code === 0 && where === "0:DONE") {
      return { locale, aborts };
    }
    const at = /^(\d+):(\d+)$/.exec(where);
    const aborted = exit.signal === "SIGTRAP" || exit.code === 133;
    if (!aborted || at === null) {
      return {
        locale,
        aborts,
        failure: `child exit ${exit.code ?? exit.signal} at ${where}: ${exit.stderr}`,
      };
    }
    const [i, step] = [Number(at[1]), Number(at[2])];
    skip = i === from ? [...skip, step] : [step];
    if (skip.length !== new Set(skip).size) {
      return { locale, aborts, failure: `abort repeats at ${where}` };
    }
    from = i;
    aborts++;
  }
}

/** The records of one locale's file. */
function recordsOf(directory, locale) {
  const file = join(directory, `${locale}.jsonl`);
  return existsSync(file)
    ? readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((x) => JSON.parse(x))
    : [];
}

function shardOf(locales) {
  const given = argument("shard");
  if (given === null) {
    return locales;
  }
  const [index, count] = given[0].split("/").map(Number);
  if (!(index >= 1 && index <= count)) {
    console.error(`--shard must be i/n with 1 <= i <= n, got ${given[0]}`);
    process.exit(2);
  }
  return [...locales].sort().filter((_, at) => at % count === index - 1);
}

/** The D29 repros of `rangeFieldRepros.ts`: whether each one passes on this engine. */
async function reproStates() {
  const file = join(DIST, "internal/temporalCompat/rangeFieldRepros.js");
  if (!existsSync(file)) {
    return {};
  }
  const { rangeFieldCases, rangeFieldProblem } = await import(
    pathToFileURL(file).href
  );
  const states = {};
  for (const c of rangeFieldCases) {
    states[c.name] =
      rangeFieldProblem(c.locale, c.options, c.from, c.to) === "complete"
        ? "fixed"
        : "broken";
  }
  return states;
}

const CAUSES = ["relatedYear", "dayPeriodB", "hebrewMonth", "pattern"];

async function sweep() {
  if (!existsSync(join(DIST, "internal/rangeDetector.js"))) {
    console.error("packages/gmt/dist is missing: run pnpm build first");
    process.exit(2);
  }
  const started = performance.now(); // a stopwatch, not a date
  const calendars =
    argument("calendars") ??
    Intl.supportedValuesOf("calendar").filter((c) => !NOT_SWEPT.has(c));
  const locales = shardOf(localeList());
  const jobs = Number(argument("jobs")?.[0] ?? availableParallelism());
  const directory = mkdtempSync(join(tmpdir(), "gmt-range-"));
  const failures = [];
  const crashes = [];
  let aborts = 0;
  try {
    let next = 0;
    const worker = async () => {
      while (next < locales.length) {
        const result = await sweepLocale(locales[next++], calendars, directory);
        aborts += result.aborts;
        if (result.failure) {
          crashes.push({ locale: result.locale, why: result.failure });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
    const report = summarise(locales, calendars, directory, failures);
    report.crashes = crashes;
    report.engine = {
      node: process.version,
      v8: process.versions.v8 ?? null,
      icu: process.versions.icu ?? null,
      cldr: process.versions.cldr ?? null,
    };
    report.aborts = aborts;
    report.repros = await reproStates();
    report.seconds = Math.round((performance.now() - started) / 1000);
    const out = argument("out");
    if (out !== null) {
      writeFileSync(out[0], `${JSON.stringify(report, null, 1)}\n`);
    }
    print(report);
    process.exit(report.failures.length ? 1 : crashes.length ? 2 : 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Reads every record and sorts it into the counts, the causes and the failures. */
function summarise(locales, calendars, directory, failures) {
  const totals = {
    formatters: 0,
    flagged: 0,
    oracleBad: 0,
    truePositive: 0,
    confirmedByDerivedRanges: 0,
    runTogether: 0,
    fieldOrder: 0,
    eraText: 0,
    dayPeriodDropped: 0,
    excludedSingleAbort: 0,
    excludedRangeAbort: 0,
  };
  const causes = Object.fromEntries(
    CAUSES.map((cause) => [cause, { formatters: 0, locales: new Set() }]),
  );
  const derived = Object.fromEntries(
    CAUSES.map((cause) => [cause, { formatters: 0, locales: new Set() }]),
  );
  const together = new Set();
  const order = new Set();
  const era = new Set();
  const byProbe = {};
  totals.formatters = locales.length * calendars.length * OPTION_SETS.length;
  for (const locale of locales) {
    for (const r of recordsOf(directory, locale)) {
      const who = { locale: r.locale, calendar: r.calendar, k: r.k };
      if (r.ctor) {
        totals.formatters--;
        continue;
      }
      if (r.threw) {
        failures.push({ ...who, why: `detector threw: ${r.threw}` });
        continue;
      }
      totals.flagged += r.flagged ? 1 : 0;
      if (r.singleAbort) {
        totals.excludedSingleAbort++;
        continue;
      }
      if (r.bad > 0) {
        totals.oracleBad++;
        if (r.flagged) {
          totals.truePositive++;
        } else {
          failures.push({
            ...who,
            why: "false negative: the oracle finds a probe range wrong and the detector does not flag it",
            causes: r.causes,
          });
        }
        for (const cause of r.causes) {
          causes[cause].formatters++;
          causes[cause].locales.add(r.locale);
        }
      } else if (r.flagged) {
        if (r.extBad > 0) {
          totals.confirmedByDerivedRanges++;
          for (const cause of r.extCauses) {
            derived[cause].formatters++;
            derived[cause].locales.add(r.locale);
          }
        } else if (r.period) {
          totals.dayPeriodDropped++;
          for (const cause of ["dayPeriodB"]) {
            derived[cause].formatters++;
            derived[cause].locales.add(r.locale);
          }
        } else if (r.together) {
          totals.runTogether++;
          together.add(r.locale);
          byProbe[r.togetherProbe] = (byProbe[r.togetherProbe] ?? 0) + 1;
        } else if (r.kind === "order") {
          totals.fieldOrder++;
          order.add(r.locale);
        } else if (r.classes === "G") {
          totals.eraText++;
          era.add(r.locale);
        } else if (r.rangeAborts > 0 || r.extAborts > 0) {
          totals.excludedRangeAbort++;
        } else {
          failures.push({
            ...who,
            why: "a flag no oracle confirms and no run-together text explains: a detector false positive",
            kind: r.kind,
            classes: r.classes,
          });
        }
      }
    }
  }
  const sorted = (set) => [...set].sort();
  return {
    shard: argument("shard")?.[0] ?? null,
    calendars,
    locales: locales.length,
    totals,
    causes: Object.fromEntries(
      CAUSES.map((cause) => [
        cause,
        {
          formatters: causes[cause].formatters,
          locales: sorted(
            new Set([...causes[cause].locales, ...derived[cause].locales]),
          ),
          derivedFormatters: derived[cause].formatters,
        },
      ]),
    ),
    runTogether: {
      formatters: totals.runTogether,
      locales: sorted(together),
      byProbe,
    },
    fieldOrder: { formatters: totals.fieldOrder, locales: sorted(order) },
    eraText: { formatters: totals.eraText, locales: sorted(era) },
    failures,
  };
}

function print(report) {
  const { totals } = report;
  console.log(
    `${report.engine.node} V8 ${report.engine.v8} ICU ${report.engine.icu} CLDR ${report.engine.cldr}: ` +
      `${report.locales} locales, ${report.calendars.length} calendars, ${totals.formatters} formatters, ${report.seconds}s`,
  );
  console.log(JSON.stringify(totals));
  for (const [cause, entry] of Object.entries(report.causes)) {
    console.log(
      `${cause}: ${entry.formatters} formatters (${entry.derivedFormatters} more by derived ranges), ${entry.locales.length} locales`,
    );
  }
  console.log(
    `runTogether: ${report.runTogether.formatters} formatters, ${report.runTogether.locales.length} locales`,
  );
  console.log(
    `fieldOrder: ${report.fieldOrder.formatters} formatters, ${report.fieldOrder.locales.length} locales`,
  );
  console.log(
    `eraText: ${report.eraText.formatters} formatters, ${report.eraText.locales.length} locales`,
  );
  console.log(`aborted parts calls skipped: ${report.aborts}`);
  console.log(`repros: ${JSON.stringify(report.repros)}`);
  for (const failure of [...report.failures, ...report.crashes]) {
    console.log(JSON.stringify(failure));
  }
}

// ---------------------------------------------------------------------------------------------
// --diff previous.json current.json
// ---------------------------------------------------------------------------------------------

/** Markdown: the locales that newly break and the ones that are fixed, per cause. */
function diff(previousPath, currentPath) {
  const previous = JSON.parse(readFileSync(previousPath, "utf8"));
  const current = JSON.parse(readFileSync(currentPath, "utf8"));
  const lines = [];
  const groups = [
    ...Object.entries(current.causes).map(([name, entry]) => [
      name,
      entry.locales,
      previous.causes?.[name]?.locales ?? [],
    ]),
    ...["runTogether", "fieldOrder", "eraText"].map((name) => [
      name,
      current[name].locales,
      previous[name]?.locales ?? [],
    ]),
  ];
  for (const [name, now, before] of groups) {
    const broke = now.filter((x) => !before.includes(x));
    const fixed = before.filter((x) => !now.includes(x));
    if (broke.length) {
      lines.push(`- **${name}, newly broken:** ${broke.join(", ")}`);
    }
    if (fixed.length) {
      lines.push(`- **${name}, fixed:** ${fixed.join(", ")}`);
    }
  }
  for (const [name, state] of Object.entries(current.repros ?? {})) {
    const before = previous.repros?.[name];
    if (before !== undefined && before !== state) {
      lines.push(`- **repro ${name}:** ${before} -> ${state}`);
    }
  }
  console.log(
    lines.length ? lines.join("\n") : "- No locale changed since the last run.",
  );
}

if (process.argv[2] === "--child") {
  await child(process.argv[3]);
} else if (process.argv[2] === "--diff") {
  diff(process.argv[3], process.argv[4]);
} else {
  await sweep();
}
