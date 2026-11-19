import { createHash } from "node:crypto";

/**
 * The agent's answer on `one-clock`: the owner's transcript (`quotes/agent-answer.json`) and the
 * record of running its code (`quotes/agent-run.json`, written by
 * `scripts/zone-matrix/agent-answer.mjs`). The slide is `ready` only when every transcript field is
 * set, the run record exists, its hash matches the code and the call, and it holds the run the slide
 * shows. Anything less is a marked panel that says what is missing, so the dev server and the build
 * keep working and `slides-check` can fail with the file and the command. No answer is invented.
 */
export interface AgentQuoteRecord {
  question: string;
  model: string;
  /** The day the answer was recorded, as the owner states it. */
  date: string;
  /** The agent's prose around the code. */
  answer: string;
  /** The module as the agent wrote it. */
  code: string;
  /** The expression that calls it, for example `setReminder()`. */
  call: string;
  /** Line ranges (1-based, inclusive) of `code` the slide shows when the code is long. */
  excerpt?: [number, number][];
}

/** What the run of one cell returned: the value as text, or the error it threw. */
export type RunValue = string | { threw: string };

export interface AgentRun {
  node: string;
  tzdata: string;
  zone: string;
  value: RunValue;
}

export interface AgentRunRecord {
  sha256: string;
  command: string;
  instant: string;
  libraries: Record<string, string>;
  runs: AgentRun[];
}

/** The transcript fields that must be set, in the order `agent-answer.mjs` reports them. */
export const TRANSCRIPT_FIELDS = [
  "question",
  "model",
  "date",
  "answer",
  "code",
  "call",
] as const;

/** The Node major and zone whose value the slide shows. */
export const SHOWN = { node: "26", zone: "Europe/Helsinki" } as const;

/** Where the transcript is kept and the command that records its run, for messages. */
export const ANSWER_PATH =
  "apps/dox/src/slides/give-me-temporal/quotes/agent-answer.json";
export const RUN_COMMAND =
  "cd scripts/zone-matrix && fnm exec --using=26 -- node agent-answer.mjs";

export type AgentQuote =
  | {
      ready: false;
      /** `transcript`: a field is empty. `run`: the record is missing, stale or lacks the shown run. */
      why: "transcript" | "run";
      /** The question, when the owner has set it, so the panel can still show what was asked. */
      question: string;
      /** What `slides-check` prints: the file and the command. */
      problem: string;
    }
  | ({
      ready: true;
      /** The code the slide shows: `excerpt` applied. */
      shownCode: string;
      /** The run on `SHOWN.node` at `SHOWN.zone`. */
      shown: AgentRun;
      /** How many different values the runs hold, and how many runs there are. */
      distinct: number;
      runs: number;
      instant: string;
      libraries: Record<string, string>;
    } & AgentQuoteRecord);

/** The hash that ties a run record to its code: `code`, a NUL character, `call`. */
export const hashOf = (code: string, call: string): string =>
  createHash("sha256").update(`${code}\0${call}`).digest("hex");

const filled = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== "";

/** The lines of `code` the ranges name, joined by a comment line where lines were left out. */
export function excerptOf(
  code: string,
  ranges: readonly (readonly [number, number])[] | undefined,
): string | undefined {
  if (!ranges || ranges.length === 0) return code;
  const lines = code.split("\n");
  const parts: string[] = [];
  for (const [from, to] of ranges) {
    if (!Number.isInteger(from) || !Number.isInteger(to)) return undefined;
    if (from < 1 || to < from || to > lines.length) return undefined;
    parts.push(lines.slice(from - 1, to).join("\n"));
  }
  return parts.join("\n// …\n");
}

const sameValue = (a: RunValue, b: RunValue): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function agentQuote(
  record: AgentQuoteRecord,
  run: AgentRunRecord | null | undefined,
): AgentQuote {
  const question = filled(record.question) ? record.question : "";
  const empty = TRANSCRIPT_FIELDS.filter((f) => !filled(record[f]));
  if (empty.length > 0)
    return {
      ready: false,
      why: "transcript",
      question,
      problem: `${ANSWER_PATH} has empty fields: ${empty.join(", ")}. Fill them from the owner's transcript, then run: ${RUN_COMMAND}`,
    };

  const stale = (reason: string): AgentQuote => ({
    ready: false,
    why: "run",
    question,
    problem: `The run record for ${ANSWER_PATH} ${reason}. Run: ${RUN_COMMAND}`,
  });
  if (
    !run ||
    !filled(run.sha256) ||
    !Array.isArray(run.runs) ||
    run.runs.length === 0
  )
    return stale("is missing");
  if (run.sha256 !== hashOf(record.code, record.call))
    return stale("is out of date: the code or the call changed");
  const shown = run.runs.find(
    (r) => r.node === SHOWN.node && r.zone === SHOWN.zone,
  );
  if (!shown)
    return stale(
      `is out of date: it has no run on Node ${SHOWN.node} at ${SHOWN.zone}`,
    );
  const shownCode = excerptOf(record.code, record.excerpt);
  if (shownCode === undefined)
    return {
      ready: false,
      why: "transcript",
      question,
      problem: `${ANSWER_PATH} has an excerpt that is not whole line ranges inside the ${record.code.split("\n").length} lines of the code. Fix it.`,
    };

  const distinct = run.runs.reduce<RunValue[]>(
    (seen, r) =>
      seen.some((v) => sameValue(v, r.value)) ? seen : [...seen, r.value],
    [],
  ).length;
  return {
    ready: true,
    ...record,
    shownCode,
    shown,
    distinct,
    runs: run.runs.length,
    instant: run.instant,
    libraries: run.libraries,
  };
}

/** The text of a run's value: the value itself, or what it threw. */
export const valueLabel = (value: RunValue): string =>
  typeof value === "string" ? value : `Threw ${value.threw}`;
