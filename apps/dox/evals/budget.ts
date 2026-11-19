/**
 * The budget guard for the live layer. Pure, so every limit is proven offline without spending
 * a Neuron or a Gemini request. `scripts/eval-live.ts` is a thin CLI around it.
 *
 * The limits are the owner's: never in CI; one brain and the live subset by default; a Neurons
 * budget per run, measured from the wrangler log; a per-model Gemini cap; `--brains all` asks
 * first. Loads under `tsx`.
 */
import { parseArgs } from "node:util";
import type { BrainStatus } from "../src/lib/chat-types";
import type { EvalCase } from "./cases";

/** Neurons per million tokens, [input, output], from the dollar prices in
 * Cloudflare's model catalog on 2026-10-27 ($0.011 per 1,000 Neurons). Only
 * used to turn logged token counts into an estimate. */
export const NEURONS_PER_MILLION: Record<string, [number, number]> = {
  "@cf/zai-org/glm-4.7-flash": [5500, 36364],
  "@cf/google/gemma-4-26b-a4b-it": [9091, 27273],
};

/** The worst case for one answer; also what an unmeasured answer counts as. A showGlobe
 * question measured 29,238 input tokens and 33 output tokens, 267 Neurons on Gemma 4 26B, on
 * 2026-11-18, and the largest live prompt is about a quarter bigger: roughly 36,000 input
 * tokens, about 330 Neurons on Gemma, so 350 leaves room for the output. */
export const WORST_CASE_NEURONS = 350;
export const DEFAULT_BUDGET = 2500;
export const DEFAULT_GEMINI_CAP = 3;
export const DEFAULT_GEMINI_RESERVE = 10;

/** The part of a brain the guard reads. */
export interface GuardBrain {
  id: string;
  provider: BrainStatus["provider"];
  model?: string;
}

export interface RunOptions {
  base: string;
  log?: string;
  brainIds: string[];
  all: boolean;
  confirmSpend: boolean;
  only: string[];
  budget: number;
  geminiCap: number;
  geminiReserve: number;
  devKey: string;
  delayMs: number;
  outDir: string;
  writeBaseline: boolean;
}

export const USAGE = `Live evals for the Dox chat: sends the live cases through a running Worker and grades each answer.

  npx tsx scripts/eval-live.ts --log <wrangler log> [--base http://localhost:8787/gmt]
    [--brains <id,...>|all [--confirm-spend]] [--only <id,...>] [--case <id>]...
    [--budget ${DEFAULT_BUDGET}] [--gemini-cap ${DEFAULT_GEMINI_CAP}] [--gemini-reserve ${DEFAULT_GEMINI_RESERVE}]
    [--dev-key probe] [--delay-ms 3500] [--out-dir .cache/evals] [--write-baseline]

It spends real quota: a question costs about 160 to 350 Neurons against 10,000 a day, and Gemini allows
about 20 requests a day per model. Never run it in CI. --brains all prints its cost and stops
unless --confirm-spend is given.`;

export type Parsed =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "preview"; lines: string[] }
  | {
      kind: "run";
      options: RunOptions;
      brains: GuardBrain[];
      cases: EvalCase[];
    };

const count = (raw: string | undefined, fallback: number): number =>
  raw === undefined ? fallback : Number(raw);

export function parseRunArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  known: {
    brains: readonly (GuardBrain & { id: string })[];
    liveCases: readonly EvalCase[];
    /** The committed live report of each brain, for the estimates. */
    committed?: Readonly<Record<string, ReportNeurons | undefined>>;
  },
): Parsed {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        help: { type: "boolean", short: "h" },
        base: { type: "string", default: "http://localhost:8787/gmt" },
        log: { type: "string" },
        brains: { type: "string" },
        "confirm-spend": { type: "boolean" },
        only: { type: "string" },
        case: { type: "string", multiple: true },
        budget: { type: "string" },
        "gemini-cap": { type: "string" },
        "gemini-reserve": { type: "string" },
        "dev-key": { type: "string", default: "probe" },
        "delay-ms": { type: "string", default: "3500" },
        "out-dir": { type: "string", default: ".cache/evals" },
        "write-baseline": { type: "boolean" },
      },
    }));
  } catch (error) {
    return { kind: "error", message: (error as Error).message };
  }
  if (values.help) return { kind: "help" };

  // The first limit: no run, and no preview, under CI.
  if (env.CI)
    return {
      kind: "error",
      message: "refusing to run under CI: live evals spend real quota",
    };

  const numbers = {
    budget: count(values.budget, DEFAULT_BUDGET),
    geminiCap: count(values["gemini-cap"], DEFAULT_GEMINI_CAP),
    geminiReserve: count(values["gemini-reserve"], DEFAULT_GEMINI_RESERVE),
    delayMs: count(values["delay-ms"], 3500),
  };
  for (const [name, value] of Object.entries(numbers)) {
    if (!Number.isFinite(value) || value < 0)
      return {
        kind: "error",
        message: `--${name} must be a non-negative number`,
      };
  }

  const all = values.brains === "all";
  let brains: GuardBrain[];
  if (all) brains = [...known.brains];
  else if (values.brains) {
    brains = [];
    for (const id of values.brains.split(",").map((s) => s.trim())) {
      const brain = known.brains.find((candidate) => candidate.id === id);
      if (!brain) return { kind: "error", message: `unknown brain id: ${id}` };
      brains.push(brain);
    }
  } else brains = known.brains.slice(0, 1);

  const asked = [
    ...(values.only ? values.only.split(",").map((s) => s.trim()) : []),
    ...(values.case ?? []),
  ];
  const unknownIds = asked.filter(
    (id) => !known.liveCases.some((c) => c.id === id),
  );
  if (unknownIds.length > 0)
    return {
      kind: "error",
      message: `unknown or non-live case id: ${unknownIds.join(", ")}`,
    };
  const cases = asked.length
    ? known.liveCases.filter((c) => asked.includes(c.id))
    : [...known.liveCases];

  const options: RunOptions = {
    base: values.base!.replace(/\/$/, ""),
    log: values.log,
    brainIds: brains.map((brain) => brain.id),
    all,
    confirmSpend: values["confirm-spend"] ?? false,
    only: asked,
    budget: numbers.budget,
    geminiCap: numbers.geminiCap,
    geminiReserve: numbers.geminiReserve,
    devKey: values["dev-key"]!,
    delayMs: numbers.delayMs,
    outDir: values["out-dir"]!,
    writeBaseline: values["write-baseline"] ?? false,
  };

  // `--brains all` asks first: it prints the cost and runs nothing without --confirm-spend.
  if (all && !options.confirmSpend)
    return {
      kind: "preview",
      lines: previewLines(brains, cases, options, known.committed ?? {}),
    };

  if (brains.some((brain) => brain.provider === "workers-ai") && !options.log)
    return {
      kind: "error",
      message:
        "--log <wrangler log> is required for a Workers AI brain: Neurons are measured from it, and with no measurement there is no budget",
    };

  return { kind: "run", options, brains, cases };
}

/** The cases a brain runs: a case with `provider` runs only on that provider's brains. */
export function casesFor(
  brain: GuardBrain,
  cases: readonly EvalCase[],
): EvalCase[] {
  return cases.filter(
    (c) => c.provider === undefined || c.provider === brain.provider,
  );
}

/** The slice of a committed report the estimates read. */
export interface ReportNeurons {
  cases: Readonly<Record<string, { neurons?: number | null } | undefined>>;
}

/** What one case is expected to cost: the committed report's figure, else the worst case. */
export function estimateNeurons(
  report: ReportNeurons | undefined,
  caseId: string,
): number {
  return report?.cases[caseId]?.neurons ?? WORST_CASE_NEURONS;
}

function previewLines(
  brains: readonly GuardBrain[],
  cases: readonly EvalCase[],
  options: RunOptions,
  committed: Readonly<Record<string, ReportNeurons | undefined>>,
): string[] {
  const lines = ["--brains all would run:"];
  for (const brain of brains) {
    const mine = casesFor(brain, cases);
    if (brain.provider === "workers-ai") {
      const total = mine.reduce(
        (sum, c) => sum + estimateNeurons(committed[brain.id], c.id),
        0,
      );
      lines.push(
        `  ${brain.id}: ${mine.length} cases, about ${total} Neurons (budget ${options.budget})`,
      );
    } else {
      lines.push(
        `  ${brain.id}: ${mine.length} cases, up to ${Math.min(mine.length, options.geminiCap)} requests (cap ${options.geminiCap})`,
      );
    }
  }
  lines.push("Nothing was sent. Add --confirm-spend to run it.");
  return lines;
}

/** One `dox-usage` line the Worker logs per answered request (`worker/brains.ts`). */
export interface UsageLine {
  brain: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Every `dox-usage` JSON line in wrangler's output, in order. */
export function parseUsageLines(log: string): UsageLine[] {
  return log.split("\n").flatMap((line) => {
    const at = line.indexOf("dox-usage ");
    if (at === -1) return [];
    try {
      return [JSON.parse(line.slice(at + "dox-usage ".length)) as UsageLine];
    } catch {
      return [];
    }
  });
}

/**
 * The Neurons one answer cost: the first new `dox-usage` line of its brain, converted with
 * `NEURONS_PER_MILLION`. An answer with no usable line counts as the worst case and is flagged.
 */
export function measureNeurons(
  brain: GuardBrain,
  fresh: readonly UsageLine[],
): { neurons: number; measured: boolean } {
  const line = fresh.find((candidate) => candidate.brain === brain.id);
  const rates = brain.model ? NEURONS_PER_MILLION[brain.model] : undefined;
  if (
    !line ||
    !rates ||
    line.inputTokens === undefined ||
    line.outputTokens === undefined
  )
    return { neurons: WORST_CASE_NEURONS, measured: false };
  return {
    neurons: Math.round(
      (line.inputTokens * rates[0] + line.outputTokens * rates[1]) / 1e6,
    ),
    measured: true,
  };
}

export type Decision =
  | { start: true }
  | { start: false; note: "budget" | "gemini cap"; endsRun: boolean };

/** Tracks what a run has spent and decides, before each case, whether it may start. */
export class RunGuard {
  spent = 0;
  stopped = false;
  private readonly requests = new Map<string, number>();

  constructor(
    private readonly limits: Pick<
      RunOptions,
      "budget" | "geminiCap" | "geminiReserve"
    >,
    private readonly committed: Readonly<
      Record<string, ReportNeurons | undefined>
    > = {},
  ) {}

  /**
   * `remaining` is the brain's `remaining` from `/api/brains`; only Gemini reads it.
   * A budget stop ends the run: that case and every later one are `ungraded`.
   */
  decide(brain: GuardBrain, caseId: string, remaining?: number): Decision {
    if (this.stopped) return { start: false, note: "budget", endsRun: true };
    if (brain.provider === "google") {
      const used = this.requests.get(brain.id) ?? 0;
      if (
        used >= this.limits.geminiCap ||
        (remaining !== undefined && remaining - 1 < this.limits.geminiReserve)
      )
        return { start: false, note: "gemini cap", endsRun: false };
      return { start: true };
    }
    const estimate = estimateNeurons(this.committed[brain.id], caseId);
    if (this.spent + estimate > this.limits.budget) {
      this.stopped = true;
      return { start: false, note: "budget", endsRun: true };
    }
    return { start: true };
  }

  /** Call after each request: a Gemini request counts against its model's cap. */
  record(brain: GuardBrain, neurons: number): void {
    this.requests.set(brain.id, (this.requests.get(brain.id) ?? 0) + 1);
    if (brain.provider === "workers-ai") this.spent += neurons;
  }
}
