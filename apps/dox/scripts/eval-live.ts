/**
 * DOX-G12 (#511) — the live layer of the Dox chat evals, through a running Worker.
 *
 * Sends the `LIVE_CASES` subset to one brain (`BRAINS[0]` by default), grades each streamed
 * answer with code (`evals/graders.ts`), records latency and Neurons, and compares the run with
 * the committed report `evals/live-<brainId>.json`. It replaces the DOX-C4 probe. It takes any
 * brain id, so it also serves the brain-list runbook in context/dox/built/tier-6-ops.md.
 *
 * **It spends real quota.** AI models never run locally, so every case draws on the account's
 * 10,000 Neurons for the day, the pool the live site answers from. `evals/budget.ts` holds the
 * limits and `--help` states them. Never in CI or `pnpm test`.
 *
 * From apps/dox, after `pnpm run generate` and with `dist/` built (the Worker serves the site
 * and its API under `/gmt`, so `--base` defaults to `http://localhost:8787/gmt`):
 *
 *   npx wrangler dev --var DOX_DEV_KEY:probe --var NORTHGUILD_GMT_GEMINI_API_KEY: \
 *     2>&1 | tee /tmp/dox-wrangler.log
 *   pnpm run evals:live --log /tmp/dox-wrangler.log
 *
 * Emptying the Gemini key stops a failing Workers AI brain from failing over onto Gemini's far
 * smaller allowance mid-run; the `brain` check flags any answer from a brain other than the one
 * asked.
 *
 * Exit: 0 clean; 1 a case that passed in the committed report now fails; 2 a usage error;
 * 3 the run stopped with cases ungraded (a 429, a data-refusal part, the budget).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrainStatus } from "../src/lib/chat-types";
import { USAGE, parseRunArgs } from "../evals/budget";
import type { CaseReport, LiveReport } from "../evals/report";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVALS = join(APP, "evals");

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

// `chat-constants.ts` imports a generated file. Without it tsx falls back to a bare package and
// fails with "Cannot find package '~'", which names the wrong cause. Everything that reaches
// `chat-constants.ts` is imported below, after this check.
if (!existsSync(join(APP, "src/generated/corpus-counts.ts"))) {
  console.error(
    "Run `pnpm --filter @gmt/dox generate` first: src/generated/corpus-counts.ts is missing.",
  );
  process.exit(2);
}

const [
  { BRAINS },
  { LIVE_CASES },
  graders,
  stream,
  reports,
  budget,
  unixGet,
  unixConvert,
] = await Promise.all([
  import("../src/lib/chat-constants"),
  import("../evals/cases"),
  import("../evals/graders"),
  import("../evals/read-stream"),
  import("../evals/report"),
  import("../evals/budget"),
  import("@northguild/gmt/unix/get"),
  import("@northguild/gmt/unix/convert"),
]);

const reportPath = (brainId: string) => join(EVALS, `live-${brainId}.json`);
const readCommitted = (brainId: string): LiveReport | undefined =>
  existsSync(reportPath(brainId))
    ? (JSON.parse(readFileSync(reportPath(brainId), "utf8")) as LiveReport)
    : undefined;

const committed = Object.fromEntries(
  BRAINS.map((brain) => [brain.id, readCommitted(brain.id)]),
);

const parsed = parseRunArgs(argv, process.env, {
  brains: BRAINS,
  liveCases: LIVE_CASES,
  committed,
});

if (parsed.kind === "help") {
  console.log(USAGE);
  process.exit(0);
}
if (parsed.kind === "error") {
  console.error(parsed.message);
  console.error("Run with --help for usage.");
  process.exit(2);
}
if (parsed.kind === "preview") {
  console.log(parsed.lines.join("\n"));
  process.exit(0);
}

const { options, brains, cases } = parsed;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const usageLinesNow = () =>
  options.log ? budget.parseUsageLines(readFileSync(options.log, "utf8")) : [];

async function devCookie(): Promise<string> {
  // Not `/gmt/?key=`: a path that matches a static asset is served before the Worker runs, so
  // the `?key=` exchange never happens there. `/gmt/api/*` is never an asset.
  const response = await fetch(
    `${options.base}/api/brains?key=${options.devKey}`,
    {
      redirect: "manual",
    },
  ).catch(() => {
    // Nothing spent yet: no Worker answers at --base. Usually `wrangler dev` stopped at start-up,
    // for example on a missing `dist/` (the site build the Worker serves the corpus from).
    console.error(
      `No Worker at ${options.base}. Start wrangler dev on that port after \`pnpm run build\`, and read its log for a start-up error.`,
    );
    process.exit(2);
  });
  const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie) {
    console.error(
      "No dev cookie. Start wrangler dev with --var DOX_DEV_KEY:<key> and pass the same --dev-key; without it the 5-per-visitor cap ends the run early.",
    );
    process.exit(2);
  }
  return cookie;
}

const cookie = await devCookie();
const listed = (await (
  await fetch(`${options.base}/api/brains`, { headers: { cookie } })
).json()) as { brains: BrainStatus[] };
const offered = new Map(listed.brains.map((status) => [status.id, status]));

if (
  listed.brains.some((status) => status.provider === "google") &&
  brains.every((brain) => brain.provider === "workers-ai")
) {
  console.warn(
    "! Gemini brains are configured; a failing Workers AI brain may fail over onto them.",
  );
}

const guard = new budget.RunGuard(options, committed);
const generatedAt = unixConvert.convertUnixToUtc(unixGet.getUnixNow());
let seenUsage = usageLinesNow().length;
let stoppedUngraded = false;
let regression = false;
const ungraded = (): CaseReport => ({
  status: "ungraded",
  checks: {},
  neurons: null,
  firstTokenMs: null,
  totalMs: null,
});

async function ask(brainId: string, evalCase: (typeof cases)[number]) {
  const messages = [
    ...(evalCase.history ?? []),
    {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: evalCase.question }],
    },
  ];
  const response = await fetch(`${options.base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      model: brainId,
      messages,
      pageContext: evalCase.page,
    }),
  });
  if (!response.ok || !response.body) {
    await response.text().catch(() => "");
    return stream.emptyRecord(response.status);
  }
  return stream.readStream(stream.linesOf(response.body), response.status);
}

outer: for (const brain of brains) {
  const status = offered.get(brain.id);
  if (!status) {
    console.warn(`! ${brain.id} is not offered by this Worker; skipping`);
    continue;
  }
  const mine = budget.casesFor(brain, cases);
  const results: Record<string, CaseReport> = {};
  const full: unknown[] = [];
  let remaining = status.remaining;

  for (const evalCase of mine) {
    const decision = guard.decide(brain, evalCase.id, remaining);
    if (!decision.start) {
      results[evalCase.id] = ungraded();
      console.log(
        `SKIP  ${brain.id.padEnd(22)} ${evalCase.id.padEnd(36)} ungraded: ${decision.note}`,
      );
      if (decision.endsRun) stoppedUngraded = true;
      continue;
    }

    const record = await ask(brain.id, evalCase);
    remaining -= 1;

    // Give wrangler a moment to flush the onFinish log line.
    await sleep(250);
    const usage = usageLinesNow();
    const fresh = usage.slice(seenUsage);
    seenUsage = usage.length;
    let neurons: number | null = null;
    let note = "";
    if (brain.provider === "workers-ai" && record.status === 200) {
      const measured = budget.measureNeurons(brain, fresh);
      neurons = measured.neurons;
      if (!measured.measured)
        note = " (no usage line: counted as the worst case)";
    }
    guard.record(brain, neurons ?? 0);

    const verdict = await graders.grade(
      evalCase,
      record,
      graders.buildGraderContext(brain.id),
    );
    results[evalCase.id] = {
      status: verdict.status,
      checks: verdict.checks,
      neurons,
      firstTokenMs: record.timings?.firstToken ?? null,
      totalMs: record.timings?.total ?? null,
    };
    full.push({ id: evalCase.id, verdict, record });
    console.log(
      `${verdict.status.toUpperCase().padEnd(8)} ${brain.id.padEnd(22)} ${evalCase.id.padEnd(36)} ${String(record.timings?.total ?? "?").padStart(6)}ms  ${neurons ?? "?"}N${note}  ${verdict.notes.join("; ")}`,
    );

    if (verdict.status === "ungraded") {
      console.warn(
        "! The pool or the visitor cap is spent; stopping, because the rest would only measure the quota.",
      );
      stoppedUngraded = true;
      break;
    }
    await sleep(options.delayMs);
  }

  const gradedAny = Object.keys(results).length > 0;
  if (gradedAny) {
    mkdirSync(resolve(APP, options.outDir), { recursive: true });
    writeFileSync(
      resolve(
        APP,
        options.outDir,
        `${brain.id}-${generatedAt.replace(/:/g, "-")}.json`,
      ),
      JSON.stringify({ brain: brain.id, generatedAt, cases: full }, null, 2),
    );

    const before = committed[brain.id];
    const diffs = reports.diffReports(before, results);
    console.log(
      `\n${brain.id}: case, committed -> new, checks changed (latency and Neurons are never gated)`,
    );
    for (const diff of diffs) {
      console.log(
        `  ${diff.id.padEnd(36)} ${diff.before} -> ${diff.after}${diff.regression ? "  REGRESSION" : ""}  ${diff.changedChecks.join(", ")}  | ${diff.totalMs.before ?? "-"} -> ${diff.totalMs.after ?? "-"} ms, ${diff.neurons.before ?? "-"} -> ${diff.neurons.after ?? "-"} N`,
      );
    }
    if (diffs.some((diff) => diff.regression)) regression = true;

    if (options.writeBaseline) {
      const blocker = reports.baselineBlocker(results);
      if (blocker) {
        console.warn(
          `! ${brain.id}: no report written, because only a run where every case passed may write one (${blocker}).`,
        );
      } else {
        const next = reports.mergeReport(before, {
          brain: brain.id,
          model: brain.model ?? brain.id,
          generatedAt,
          budget: options.budget,
          cases: results,
          partial: options.only.length > 0,
        });
        writeFileSync(reportPath(brain.id), reports.serialiseReport(next));
        console.log(`wrote ${reportPath(brain.id)}`);
      }
    }
  }
  if (stoppedUngraded) break outer;
}

console.log(`\nspent ${guard.spent} of ${options.budget} Neurons`);
process.exit(regression ? 1 : stoppedUngraded ? 3 : 0);
