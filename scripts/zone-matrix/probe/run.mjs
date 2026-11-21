#!/usr/bin/env node
/**
 * The zone probe. Feeds every library the same questions, with the machine's zone set to each of
 * the ten zones of GMT's CI job, on each Node major of that job, and counts how many answers break.
 * It writes `apps/dox/src/data/zone-probe.json`, which `zone-probe.ts` reads.
 *
 * This is not the own-suite runner beside it (`../run.mjs`), which runs each library's own tests;
 * it shares only that runner's matrix reader, cache and `fnm exec` approach. The expected answers
 * are built at the start of every run (see `build-cases.mjs`) from the Temporal specification, never
 * a library under test, and written to `.work/cases.json` for the child processes to read.
 *
 *   cd scripts/zone-matrix && pnpm install --ignore-workspace
 *   fnm exec --using=26 -- node probe/run.mjs --plan
 *   fnm exec --using=26 -- node probe/run.mjs                 # all adapters x 10 zones x Node 22, 24, 26
 *
 * Flags: `--adapter <id>`, `--zone <iana>`, `--node <major>` (each repeatable) narrow the run and
 * skip the record; `--record <path>` writes elsewhere; `--parallel <n>` (default 6).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCached, writeCached } from "../cache.mjs";
import { readMatrix } from "../matrix.mjs";
import {
  StepError,
  nodeInfoOf,
  onNode,
  parseFlags,
  pool,
  stop,
} from "../node-runner.mjs";
import { formatJson } from "../../lib/format-json.mjs";
import { loadGmt } from "../../lib/gmt.mjs";
import { gmtFingerprint } from "./fingerprint.mjs";
import { summarise } from "./aggregate.mjs";
import { casesFile, writeCases } from "./build-cases.mjs";
import { versionOf } from "./versions.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const CACHE = join(HERE, "..", ".work", "probe-cache");
const DEFAULT_RECORD = join(ROOT, "apps/dox/src/data/zone-probe.json");

const ADAPTERS = [
  "gmt",
  "moment",
  "luxon",
  "dayjs",
  "date-fns",
  "spacetime",
  "internationalized-date",
  "temporal-polyfill",
  "js-temporal",
];

function flags(argv) {
  return parseFlags(argv, {
    lists: ["adapter", "zone", "node"],
    numbers: { parallel: 6 },
    strings: { record: DEFAULT_RECORD },
  });
}

const sha = (...parts) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
};

const harnessHash = (id) =>
  sha(
    ...[
      "child.mjs",
      `adapters/${id}.mjs`,
      "adapter-util.mjs",
      "temporal-ops.mjs",
    ].map((f) => readFileSync(join(HERE, f))),
  ).slice(0, 16);

async function main() {
  const f = flags(process.argv.slice(2));
  if (typeof globalThis.Temporal === "undefined")
    stop(2, "Run this on Node 26 (fnm exec --using=26 -- node probe/run.mjs).");
  const matrix = readMatrix(join(ROOT, ".github/workflows/ci.yml"));
  const zones = f.zone.length ? f.zone : matrix.zones;
  const nodes = (f.node.length ? f.node : matrix.node)
    .map(String)
    .sort((a, b) => Number(a) - Number(b));
  for (const z of zones)
    if (!matrix.zones.includes(z)) stop(2, `${z} is not in the ci.yml matrix`);
  for (const n of nodes)
    if (!matrix.node.includes(n))
      stop(2, `Node ${n} is not in the ci.yml matrix`);
  const adapters = f.adapter.length ? f.adapter : ADAPTERS;
  for (const a of adapters)
    if (!ADAPTERS.includes(a)) stop(2, `unknown adapter ${a}`);
  const partial = f.adapter.length || f.zone.length || f.node.length;

  const cases = casesFile(globalThis.Temporal);
  const casesText = writeCases(cases);

  console.error(
    `${adapters.length} adapters x ${zones.length} zones x Node ${nodes.join(", ")} = ${adapters.length * zones.length * nodes.length} runs`,
  );
  if (f.plan) return;

  const started = process.hrtime.bigint();
  const casesHash = sha(casesText).slice(0, 16);
  const gmtKey = adapters.includes("gmt") ? gmtFingerprint(ROOT) : "";
  let info;
  try {
    info = Object.fromEntries(nodes.map((n) => [n, nodeInfoOf(n)]));
  } catch (error) {
    if (!(error instanceof StepError)) throw error;
    stop(1, error.message);
  }
  const runs = Object.fromEntries(nodes.map((n) => [n, {}]));
  let fromCache = 0;
  let ran = 0;

  const jobs = [];
  for (const node of nodes) {
    for (const id of adapters) {
      runs[node][id] = {};
      for (const zone of zones) {
        jobs.push(async () => {
          const parts = {
            suite: `probe:${id}`,
            commit:
              id === "gmt" ? gmtKey : PACKAGES[id].map(versionOf).join("+"),
            nodeVersion: info[node].version,
            tzdata: info[node].tzdata,
            zone,
            command: casesHash,
            install: "probe",
            probe: harnessHash(id),
            attempt: 1,
          };
          let run = readCached(CACHE, parts);
          if (run) fromCache += 1;
          else {
            const r = await onNode(node, "node", ["child.mjs", id], {
              cwd: HERE,
              env: { TZ: zone },
            });
            let result;
            try {
              result = JSON.parse(r.stdout.trim().split("\n").pop());
            } catch {
              result = {
                couldNotRun: `exit ${r.code}: ${r.stderr.slice(-300)}`,
              };
            }
            run = { result };
            writeCached(CACHE, parts, run);
            ran += 1;
          }
          if (run.result.couldNotRun)
            stop(
              1,
              `${id} on Node ${node} in ${zone} could not run: ${run.result.couldNotRun}`,
            );
          // The process must have run in the zone asked for: a child that fell back to another zone would count nothing.
          if (zoneName(run.result.zone) !== zoneName(zone))
            stop(1, `${id} ran in ${run.result.zone}, not ${zone}`);
          runs[node][id][zone] = run.result;
        });
      }
    }
  }
  await pool(jobs, f.parallel);

  const libraries = adapters.map((id) => {
    const r = runs[nodes[nodes.length - 1]][id][zones[0]];
    return { id, name: NAMES[id], version: r.version };
  });
  const experiments = summarise({ cases, libraries, runs, nodes, zones });
  const gmt = await loadGmt();
  const record = {
    runDate: gmt.getToday(),
    answeredBy: cases.answeredBy,
    nodes: nodes.map((n) => ({ major: n, ...info[n] })),
    zones,
    libraries,
    experiments,
    dropped: cases.dropped.length,
    seconds: Number(
      (Number(process.hrtime.bigint() - started) / 1e9).toFixed(1),
    ),
  };
  console.error(
    `done: ${ran} ran, ${fromCache} from cache, ${record.seconds}s`,
  );
  for (const e of experiments) {
    console.log(`\nE${e.number} ${e.title} (${e.cases} cases)`);
    for (const p of e.perLibrary)
      console.log(
        `  ${p.library.padEnd(24)} wrong ${String(p.wrong).padStart(5)} (everywhere ${p.wrongEverywhere}, some zones ${p.wrongSomeZones}) unsupported ${p.unsupported} nodes ${JSON.stringify(p.nodeCounts)}${p.nodesAgree ? "" : " DISAGREE"}`,
      );
  }
  if (partial) {
    console.error("partial run: the record was not written");
    return;
  }
  writeFileSync(f.record, formatJson(record));
  console.error(`wrote ${f.record}`);
}

const NAMES = {
  gmt: "GMT",
  moment: "Moment.js",
  luxon: "Luxon",
  dayjs: "Day.js",
  "date-fns": "date-fns",
  spacetime: "Spacetime",
  "internationalized-date": "@internationalized/date",
  "temporal-polyfill": "temporal-polyfill",
  "js-temporal": "@js-temporal/polyfill",
};

/** The packages each adapter loads, whose versions are part of its cache key. */
const PACKAGES = {
  moment: ["moment", "moment-timezone"],
  luxon: ["luxon"],
  dayjs: ["dayjs"],
  "date-fns": ["date-fns", "@date-fns/tz"],
  spacetime: ["spacetime"],
  "internationalized-date": ["@internationalized/date"],
  "temporal-polyfill": ["temporal-polyfill"],
  "js-temporal": ["@js-temporal/polyfill"],
  gmt: [],
};

/** A zone under the name Node reports it by: `Asia/Kolkata` is `Asia/Calcutta` to an older ICU. */
const zoneName = (zone) =>
  new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
