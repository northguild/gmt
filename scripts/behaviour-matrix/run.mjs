#!/usr/bin/env node
/**
 * Behaviour matrix: runs every case in `cases.mjs` against Temporal, GMT and five date libraries,
 * and writes the committed record `apps/dox/src/data/behaviour-matrix.json`.
 *
 * Run it by hand, in this folder:
 *
 *   pnpm install --ignore-workspace
 *   pnpm matrix
 *
 * The run repeats on several host time zones, one child process per zone, because a library that
 * reads the host zone looks correct on a host where the zone happens to agree. The zones are in
 * `HOST_ZONES`: one without daylight saving time and zones that observe it in both hemispheres.
 * A library cell whose result changes with the host gets the verdict "varies" and keeps the result
 * of each host. Temporal and GMT read no host zone, so the run stops when either differs between
 * hosts.
 *
 * Re-run it whenever a pinned version in `package.json` changes. It never builds `packages/gmt`:
 * GMT's source is bundled with esbuild into `.cache/gmt.mjs`.
 *
 * Each Temporal call runs twice, on `@js-temporal/polyfill` and on the runtime's native
 * `Temporal`. The run stops at the first case where the two differ, so the expected value never
 * rests on one implementation.
 *
 * Exit codes: 0 written, 1 the polyfill and native Temporal disagree or GMT or Temporal depends
 * on the host zone, 2 the run cannot start.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Temporal as Polyfill } from "@js-temporal/polyfill";
import * as dateFns from "date-fns";
import { TZDate } from "@date-fns/tz";
import { DateTime } from "luxon";
import dayjs from "dayjs";
import dayjsUtc from "dayjs/plugin/utc.js";
import dayjsTimezone from "dayjs/plugin/timezone.js";
import dayjsParse from "dayjs/plugin/customParseFormat.js";
import dayjsIsoWeek from "dayjs/plugin/isoWeek.js";
import moment from "moment-timezone";
import * as intl from "@internationalized/date";
import { formatJson } from "../lib/format-json.mjs";
import { cases, REJECTED } from "./cases.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUTPUT = join(ROOT, "apps/dox/src/data/behaviour-matrix.json");

/** The host zones every library cell runs under: no daylight saving time, then both hemispheres. */
const HOST_ZONES = [
  "Asia/Kolkata",
  "Europe/London",
  "Australia/Sydney",
  "America/Santiago",
];

function stop(code, message) {
  console.error(message);
  process.exit(code);
}

const NativeTemporal = globalThis.Temporal;
if (!NativeTemporal)
  stop(
    2,
    "This Node has no native Temporal. Run the matrix on Node 26 or newer.",
  );

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);
dayjs.extend(dayjsParse);
dayjs.extend(dayjsIsoWeek);

const bundle = process.env.BM_BUNDLE ?? join(HERE, ".cache/gmt.mjs");
if (!process.env.BM_CHILD) {
  mkdirSync(join(HERE, ".cache"), { recursive: true });
  await build({
    entryPoints: [join(ROOT, "packages/gmt/src/index.ts")],
    outfile: bundle,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "error",
  });
}
const gmt = await import(pathToFileURL(bundle).href);

const L = { df: dateFns, TZDate, DateTime, dayjs, moment, intl };

function readPackage(name) {
  return JSON.parse(
    readFileSync(join(HERE, "node_modules", name, "package.json"), "utf8"),
  ).version;
}

const LIBRARIES = [
  {
    id: "date-fns",
    name: "date-fns",
    version: readPackage("date-fns"),
    with: ["@date-fns/tz"],
  },
  { id: "luxon", name: "Luxon", version: readPackage("luxon"), with: [] },
  { id: "dayjs", name: "Day.js", version: readPackage("dayjs"), with: [] },
  {
    id: "moment",
    name: "Moment.js",
    version: readPackage("moment"),
    with: ["moment-timezone"],
  },
  {
    id: "internationalized-date",
    name: "@internationalized/date",
    version: readPackage("@internationalized/date"),
    with: [],
  },
].map(({ with: companions, ...library }) => ({
  ...library,
  companions: companions.map((name) => ({ name, version: readPackage(name) })),
}));

/** Reduce a result to the comparable form the case names. */
function normalise(kind, value) {
  if (value === REJECTED || kind === "plain") return value;
  let text = value
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\.0+(?=Z|[+-]\d\d:\d\d$|$)/, "");
  if (kind === "instant") text = text.replace(/\+00:00$/, "Z");
  return text;
}

/** Run one call. A throw, GMT's empty-string sentinel and null all mean "rejected". */
function attempt(kind, run) {
  try {
    const raw = run();
    if (raw === "" || raw === null || raw === undefined)
      return { returns: REJECTED, form: REJECTED };
    if (typeof raw !== "string")
      throw new TypeError(`A runner returned ${typeof raw}, not a string`);
    return { returns: raw, form: normalise(kind, raw) };
  } catch (error) {
    if (error instanceof TypeError && /not a string/.test(error.message))
      throw error;
    return {
      returns: REJECTED,
      form: REJECTED,
      detail: `${error.name}: ${error.message}`,
    };
  }
}

/** Run every case once, on this process's host zone, and return the comparable forms. */
function runAllCases() {
  return cases.map((c) => {
    let temporal = null;
    if (c.temporal) {
      const onPolyfill = attempt(c.norm, () => c.temporal(Polyfill));
      const onNative = attempt(c.norm, () => c.temporal(NativeTemporal));
      if (onPolyfill.form !== onNative.form) {
        stop(
          1,
          `${c.id}: the polyfill and native Temporal disagree.\n  polyfill: ${onPolyfill.returns}\n  native:   ${onNative.returns}`,
        );
      }
      temporal = onNative;
    }
    const libs = {};
    for (const library of LIBRARIES) {
      const lib = c.libs[library.id];
      if (!lib) throw new Error(`${c.id} has no entry for ${library.id}`);
      if (!lib.none) libs[library.id] = attempt(c.norm, () => lib.run(L));
    }
    return {
      id: c.id,
      temporal,
      gmt: attempt(c.norm, () => c.gmt.run(gmt)),
      libs,
    };
  });
}

if (process.env.BM_CHILD) {
  // Child process: one host zone. The parent merges what this prints.
  const zone = new Intl.DateTimeFormat("en").resolvedOptions().timeZone;
  if (zone === "UTC" || zone.startsWith("Etc/"))
    stop(2, `The child resolved the host zone ${zone}, not ${process.env.TZ}.`);
  writeFileSync(process.env.BM_OUT, JSON.stringify(runAllCases()));
  process.exit(0);
}

// Parent process: one child per host zone, so a library that reads the host zone is measured
// where it can show it.
const perHost = HOST_ZONES.map((zone, index) => {
  const out = join(HERE, `.cache/host-${index}.json`);
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: {
      ...process.env,
      TZ: zone,
      BM_CHILD: "1",
      BM_BUNDLE: bundle,
      BM_OUT: out,
    },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (child.status !== 0) {
    stop(
      child.status === 1 ? 1 : 2,
      `The run on host zone ${zone} failed.\n${child.stderr}`,
    );
  }
  return { zone, results: JSON.parse(readFileSync(out, "utf8")) };
});

const results = [];
for (const c of cases) {
  const runs = perHost.map(({ zone, results: all }) => ({
    zone,
    ...all.find((r) => r.id === c.id),
  }));
  const [first] = runs;

  // Temporal and GMT read no host zone: their result must be identical on every host.
  for (const run of runs) {
    if (run.gmt.returns !== first.gmt.returns) {
      stop(
        1,
        `${c.id}: GMT depends on the host zone.\n  ${first.zone}: ${first.gmt.returns}\n  ${run.zone}: ${run.gmt.returns}`,
      );
    }
    if (c.temporal && run.temporal.returns !== first.temporal.returns) {
      stop(
        1,
        `${c.id}: Temporal depends on the host zone.\n  ${first.zone}: ${first.temporal.returns}\n  ${run.zone}: ${run.temporal.returns}`,
      );
    }
  }
  const expected = c.temporal
    ? first.temporal
    : { returns: c.expected, form: c.expected };
  const verdict = (form) => (form === expected.form ? "same" : "differs");
  const gmtRun = first.gmt;

  const rows = LIBRARIES.map((library) => {
    const lib = c.libs[library.id];
    if (lib.none)
      return {
        library: library.id,
        verdict: "unsupported",
        reason: lib.none,
        issues: [],
      };
    const outs = runs.map((run) => ({
      zone: run.zone,
      ...run.libs[library.id],
    }));
    const varies = outs.some((o) => o.form !== outs[0].form);
    const verdictNow = varies ? "varies" : verdict(outs[0].form);
    const showHosts = outs.some((o) => o.returns !== outs[0].returns);
    return {
      library: library.id,
      call: lib.call,
      ...(varies ? {} : { returns: outs[0].returns }),
      ...(!varies && outs[0].detail ? { detail: outs[0].detail } : {}),
      verdict: verdictNow,
      ...(showHosts
        ? {
            hosts: outs.map((o) => ({
              zone: o.zone,
              returns: o.returns,
              verdict: verdict(o.form),
              ...(o.detail ? { detail: o.detail } : {}),
            })),
          }
        : {}),
      issues: verdictNow === "same" ? [] : (c.issues[library.id] ?? []),
    };
  });
  for (const library of Object.keys(c.issues)) {
    const row = rows.find((r) => r.library === library);
    if (!row || (row.verdict !== "differs" && row.verdict !== "varies")) {
      console.warn(
        `${c.id}: issue listed for ${library}, but it does not differ here. It is left out.`,
      );
    }
  }

  results.push({
    id: c.id,
    title: c.title,
    input: c.input,
    compare: c.compare,
    clauses: c.clauses,
    temporal: c.temporal ? { returns: expected.returns } : null,
    ...(c.temporal ? {} : { expected: c.expected }),
    gmt: {
      fn: c.gmt.fn,
      call: c.gmt.call,
      returns: gmtRun.returns,
      ...(gmtRun.detail ? { detail: gmtRun.detail } : {}),
      verdict: verdict(gmtRun.form),
      ...(c.gmtNote ? { note: c.gmtNote } : {}),
    },
    libraries: rows,
  });
}

const matrix = {
  measuredOn: Polyfill.Now.plainDateISO("UTC").toString(),
  runtime: {
    node: process.version,
    icu: process.versions.icu,
    hostZones: HOST_ZONES,
  },
  libraries: LIBRARIES,
  cases: results,
};
writeFileSync(OUTPUT, formatJson(matrix));

const tally = {};
for (const r of results) {
  for (const row of [r.gmt, ...r.libraries]) {
    const who = row.library ?? "gmt";
    tally[who] ??= { same: 0, differs: 0, varies: 0, unsupported: 0 };
    tally[who][row.verdict] += 1;
  }
}
console.log(`Wrote ${OUTPUT}`);
console.log(
  `Polyfill and native Temporal agree on all ${results.filter((r) => r.temporal).length} Temporal calls.`,
);
console.table(tally);
