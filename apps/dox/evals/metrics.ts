/**
 * Scores for the offline layer: pure functions over each case's `prepareTurn` result.
 *
 * Imports no `.md` and no `import.meta.glob`, so the live script can reuse `resolveName` under
 * `tsx`. A gmt name resolves through `gmt-corpus.json` to the chunk id the retrieval corpus
 * gives that entry.
 */
import corpusJson from "../src/generated/reference/gmt-corpus.json";
import type { PreparedTurn } from "../worker/prepare-turn";
import type { ChunkExpectation, EvalCase } from "./cases";

export const PASS_FAIL_METRICS = [
  "retrieval.recallAt10",
  "retrieval.withinK",
  "fit.kept",
  "vocabulary.hit",
  "tools.offered",
  "refusal.quiet",
] as const;

export const METRIC_NAMES = ["retrieval.mrr", ...PASS_FAIL_METRICS] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

/** The slice of a prepared turn the scores read. */
export type TurnResult = Pick<
  PreparedTurn,
  "searched" | "retrieved" | "offered" | "chosen"
>;

export interface Scores {
  metrics: Record<MetricName, number>;
  /** Case ids that missed each pass/fail metric. Always empty for `retrieval.mrr`. */
  failures: Record<MetricName, string[]>;
  /** Each `chunks` case's rank (1-based) of its first expectation; 0 when absent. */
  ranks: Record<string, number>;
}

/** How many `searched` hits count for recall and for `fit.kept`. */
const RECALL_DEPTH = 10;

/** `refusal.quiet` passes below this many hits. */
export const QUIET_BOUND = 5;

const chunkIdByName = new Map(
  corpusJson.map((entry) => [
    entry.name,
    `${entry.namespace}/${entry.module}/${entry.name}`,
  ]),
);

/** The retrieval chunk id of a gmt name; throws when the library has no such name. */
export function resolveName(name: string): string {
  const id = chunkIdByName.get(name);
  if (id === undefined) throw new Error(`"${name}" is not in the gmt corpus`);
  return id;
}

interface Located {
  id: string;
  url: string;
}

/** Whether a chunk answers one name or URL prefix of an expectation. */
function matches(entry: string, chunk: Located): boolean {
  return entry.startsWith("/")
    ? chunk.url.startsWith(entry)
    : chunk.id === resolveName(entry);
}

/** Whether a chunk satisfies an expectation (any one of its alternatives). */
export function satisfies(
  expectation: ChunkExpectation,
  chunk: Located,
): boolean {
  const alternatives =
    typeof expectation === "string" ? [expectation] : expectation;
  return alternatives.some((entry) => matches(entry, chunk));
}

/** 1-based rank of the first chunk that satisfies the expectation; 0 when none does. */
const rankOf = (
  expectation: ChunkExpectation,
  chunks: readonly Located[],
): number => chunks.findIndex((chunk) => satisfies(expectation, chunk)) + 1;

/** Truncated, never rounded, to 3 decimals: both sides of a floor comparison use it. */
export function trunc3(value: number): number {
  return Math.trunc(value * 1000 + 1e-9) / 1000;
}

export function scoreCases(
  cases: readonly EvalCase[],
  run: Readonly<Record<string, TurnResult>>,
): Scores {
  const failures = Object.fromEntries(
    METRIC_NAMES.map((name) => [name, [] as string[]]),
  ) as Record<MetricName, string[]>;
  const eligible = Object.fromEntries(
    METRIC_NAMES.map((name) => [name, 0]),
  ) as Record<MetricName, number>;
  const ranks: Record<string, number> = {};
  let expectations = 0;
  let expectationHits = 0;
  let reciprocalSum = 0;

  const check = (name: MetricName, id: string, passed: boolean) => {
    eligible[name] += 1;
    if (!passed) failures[name].push(id);
  };

  for (const c of cases) {
    const turn = run[c.id];
    if (turn === undefined) throw new Error(`no result for case ${c.id}`);
    const top = turn.searched.slice(0, RECALL_DEPTH);

    if (c.chunks !== undefined) {
      const hits = c.chunks.filter((e) => rankOf(e, top) > 0);
      expectations += c.chunks.length;
      expectationHits += hits.length;
      check("retrieval.recallAt10", c.id, hits.length === c.chunks.length);

      const first = c.chunks[0];
      const rank = first === undefined ? 0 : rankOf(first, turn.searched);
      ranks[c.id] = rank;
      eligible["retrieval.mrr"] += 1;
      if (rank > 0) reciprocalSum += 1 / rank;

      if (c.k !== undefined) {
        check("retrieval.withinK", c.id, rank > 0 && rank <= c.k);
      }
      check(
        "fit.kept",
        c.id,
        hits.every((e) => rankOf(e, turn.retrieved) > 0),
      );
    }
    if (c.skill !== undefined) {
      const names = turn.chosen.map((skill) => skill.name);
      check(
        "vocabulary.hit",
        c.id,
        c.skill === null ? names.length === 0 : names.includes(c.skill),
      );
    }
    if (c.tool !== undefined) {
      check("tools.offered", c.id, turn.offered.includes(c.tool));
    }
    if (c.kind === "offTopic") {
      check("refusal.quiet", c.id, turn.searched.length < QUIET_BOUND);
    }
  }

  for (const name of METRIC_NAMES) {
    if (eligible[name] === 0) {
      throw new Error(`no case is eligible for the ${name} metric`);
    }
  }

  const metrics = {} as Record<MetricName, number>;
  metrics["retrieval.mrr"] = reciprocalSum / eligible["retrieval.mrr"];
  for (const name of PASS_FAIL_METRICS) {
    metrics[name] =
      name === "retrieval.recallAt10"
        ? expectationHits / expectations
        : (eligible[name] - failures[name].length) / eligible[name];
  }
  return { metrics, failures, ranks };
}
