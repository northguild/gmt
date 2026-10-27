#!/usr/bin/env node
/**
 * Behaviour matrix: runs every case in `cases.mjs` against Temporal, GMT and five date libraries,
 * and writes the committed record `apps/dox/src/data/behaviour-matrix.json`.
 *
 * Run it by hand, in this folder, with a host time zone that is not UTC so that a library which
 * reads the host zone shows it:
 *
 *   pnpm install
 *   TZ=Asia/Kolkata pnpm matrix
 *
 * Re-run it whenever a pinned version in `package.json` changes. It never builds `packages/gmt`:
 * GMT's source is bundled with esbuild into `.cache/gmt.mjs`.
 *
 * Each Temporal call runs twice, on `@js-temporal/polyfill` and on the runtime's native
 * `Temporal`. The run stops at the first case where the two differ, so the expected value never
 * rests on one implementation.
 *
 * Exit codes: 0 written, 1 the polyfill and native Temporal disagree, 2 the run cannot start.
 */
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

const UTC_ZONES = new Set([
  "UTC",
  "Etc/UTC",
  "Etc/UCT",
  "Etc/Universal",
  "Etc/Zulu",
  "Etc/GMT",
  "GMT",
  "UCT",
  "Universal",
  "Zulu",
]);

function stop(code, message) {
  console.error(message);
  process.exit(code);
}

const hostTimeZone = new Intl.DateTimeFormat("en").resolvedOptions().timeZone;
if (!process.env.TZ || UTC_ZONES.has(hostTimeZone)) {
  stop(
    2,
    `The host time zone is ${process.env.TZ ? "UTC" : "not set"}. ` +
      "A library that reads the host zone would look correct in UTC. Run: TZ=Asia/Kolkata pnpm matrix",
  );
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

mkdirSync(join(HERE, ".cache"), { recursive: true });
const bundle = join(HERE, ".cache/gmt.mjs");
await build({
  entryPoints: [join(ROOT, "packages/gmt/src/index.ts")],
  outfile: bundle,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "error",
});
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

const results = [];
for (const c of cases) {
  let expected;
  if (c.temporal) {
    const onPolyfill = attempt(c.norm, () => c.temporal(Polyfill));
    const onNative = attempt(c.norm, () => c.temporal(NativeTemporal));
    if (onPolyfill.form !== onNative.form) {
      stop(
        1,
        `${c.id}: the polyfill and native Temporal disagree.\n  polyfill: ${onPolyfill.returns}\n  native:   ${onNative.returns}`,
      );
    }
    expected = onNative;
  } else {
    expected = { returns: c.expected, form: c.expected };
  }
  const verdict = (form) => (form === expected.form ? "same" : "differs");

  const gmtRun = attempt(c.norm, () => c.gmt.run(gmt));
  const rows = LIBRARIES.map((library) => {
    const lib = c.libs[library.id];
    if (!lib) throw new Error(`${c.id} has no entry for ${library.id}`);
    if (lib.none)
      return {
        library: library.id,
        verdict: "unsupported",
        reason: lib.none,
        issues: [],
      };
    const out = attempt(c.norm, () => lib.run(L));
    const verdictNow = verdict(out.form);
    return {
      library: library.id,
      call: lib.call,
      returns: out.returns,
      ...(out.detail ? { detail: out.detail } : {}),
      verdict: verdictNow,
      issues: verdictNow === "differs" ? (c.issues[library.id] ?? []) : [],
    };
  });
  for (const library of Object.keys(c.issues)) {
    const row = rows.find((r) => r.library === library);
    if (!row || row.verdict !== "differs") {
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
    tz: process.env.TZ,
    icu: process.versions.icu,
    hostTimeZone,
  },
  libraries: LIBRARIES,
  cases: results,
};
writeFileSync(OUTPUT, formatJson(matrix));

const tally = {};
for (const r of results) {
  for (const row of [r.gmt, ...r.libraries]) {
    const who = row.library ?? "gmt";
    tally[who] ??= { same: 0, differs: 0, unsupported: 0 };
    tally[who][row.verdict] += 1;
  }
}
console.log(`Wrote ${OUTPUT}`);
console.log(
  `Polyfill and native Temporal agree on all ${results.filter((r) => r.temporal).length} Temporal calls.`,
);
console.table(tally);
