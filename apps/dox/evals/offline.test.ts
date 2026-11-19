/**
 * The offline eval: every case runs through the same `prepareTurn` the Worker runs, with the
 * real corpus and skills, and each score must sit exactly on its committed floor. A rise fails
 * too, so the floor is raised in the same change: `pnpm --filter @gmt/dox evals:baseline`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildRetrievalCorpus } from "../src/lib/retrieval/corpus";
import { searchChunks } from "../src/lib/retrieval/search";
import { prepareTurn } from "../worker/prepare-turn";
import { VOCABULARY_SKILLS } from "../worker/vocabulary";
import { CASES } from "./cases";
import {
  METRIC_NAMES,
  scoreCases,
  trunc3,
  type MetricName,
  type Scores,
  type TurnResult,
} from "./metrics";

const BASELINE = new URL("./baseline.json", import.meta.url);
const REWRITE = "pnpm --filter @gmt/dox evals:baseline";

interface Baseline {
  metrics: Record<MetricName, number>;
  failures: Record<MetricName, string[]>;
  ranks: Record<string, number>;
}

/** Keys sorted at every level, so the file diffs cleanly. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => [key, sorted(inner)]),
    );
  }
  return value;
}

const difference = (a: readonly string[], b: readonly string[]) =>
  a.filter((id) => !b.includes(id));

let scores: Scores;
let baseline: Baseline | undefined;

beforeAll(async () => {
  const corpus = buildRetrievalCorpus();
  const run: Record<string, TurnResult> = {};
  for (const c of CASES) {
    run[c.id] = await prepareTurn({
      messages: [
        ...(c.history ?? []),
        {
          id: `${c.id}-q`,
          role: "user",
          parts: [{ type: "text", text: c.question }],
        },
      ],
      pageContext: c.page,
      search: (query, options) => searchChunks(corpus, query, options),
      skills: VOCABULARY_SKILLS,
    });
  }
  scores = scoreCases(CASES, run);

  if (process.env.EVALS_WRITE_BASELINE) {
    const written: Baseline = {
      metrics: Object.fromEntries(
        METRIC_NAMES.map((name) => [name, trunc3(scores.metrics[name])]),
      ) as Baseline["metrics"],
      failures: scores.failures,
      ranks: scores.ranks,
    };
    writeFileSync(BASELINE, `${JSON.stringify(sorted(written), null, 2)}\n`);
  }
  try {
    baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  } catch {
    baseline = undefined;
  }
});

describe("the offline evals", () => {
  it.each(METRIC_NAMES)("%s sits on its committed floor", (name) => {
    if (baseline === undefined) {
      throw new Error(`evals/baseline.json is missing. Write it: ${REWRITE}`);
    }
    const measured = trunc3(scores.metrics[name]);
    const floor = baseline.metrics[name];
    if (measured === floor) return;

    const detail =
      name === "retrieval.mrr"
        ? `ranks that moved: ${
            Object.keys(scores.ranks)
              .filter((id) => scores.ranks[id] !== baseline?.ranks[id])
              .map(
                (id) =>
                  `${id} ${baseline?.ranks[id] ?? "new"} -> ${scores.ranks[id]}`,
              )
              .join(", ") || "none"
          }`
        : `now failing: ${
            difference(scores.failures[name], baseline.failures[name]).join(
              ", ",
            ) || "none"
          }; now passing: ${
            difference(baseline.failures[name], scores.failures[name]).join(
              ", ",
            ) || "none"
          }`;
    expect.fail(
      `${name} measured ${measured}, floor ${floor} (${measured < floor ? "below" : "above"}). ${detail}. ` +
        `If the change is intended, rewrite the floor: ${REWRITE}`,
    );
  });
});
