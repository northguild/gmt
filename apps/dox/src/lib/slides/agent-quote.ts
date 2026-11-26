import { createHash } from "node:crypto";

/**
 * The agents' answers to the running question: the owner's transcript (`quotes/agent-answer.json`,
 * one question and an answer per agent asked, `quoted` naming the one the deck quotes) and the
 * record of running each answer's code (`quotes/agent-run.json`, written by
 * `scripts/zone-matrix/agent-answer.mjs`, one record per answer id). An answer is `ready` only when
 * every transcript field is set, its run record exists, the hash matches the code and the call, and
 * it holds the run the slide shows. Anything less is a marked panel that says what is missing, so
 * the dev server and the build keep working and `slides-check` can fail with the file and the
 * command. No answer is invented.
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

/** One agent's answer as the transcript keeps it: the question is the transcript's own. */
interface AgentAnswer extends Omit<AgentQuoteRecord, "question"> {
  /** Lower-case words joined by hyphens, the key of its run record. */
  id: string;
}

export interface AgentTranscript {
  question: string;
  /** The id of the answer the deck quotes. */
  quoted: string;
  answers: AgentAnswer[];
}

/** What the run of one cell returned: the value as text, or the error it threw. */
export type RunValue = string | { threw: string };

/** One cell of the run: the Node major, the zone and what the code returned there. */
interface AgentRun {
  node: string;
  zone: string;
  value: RunValue;
}

export interface AgentRunRecord {
  sha256: string;
  command: string;
  instant: string;
  libraries: Record<string, string>;
  /** Each Node major the code ran on, with its exact version and tzdata. */
  nodes: { node: string; version: string; tzdata: string }[];
  /** The zones each Node major ran in, in order. */
  zones: string[];
  /** `values[i][j]`: what the code returned on `nodes[i]` in `zones[j]`. */
  values: RunValue[][];
}

/** The run record file: one record per answer id. */
export type AgentRunFile = Record<string, AgentRunRecord>;

/** The transcript fields that must be set, in the order `agent-answer.mjs` reports them. */
export const TRANSCRIPT_FIELDS = [
  "question",
  "model",
  "date",
  "answer",
  "code",
  "call",
] as const;

/** What a deck says about its agent run: the cell the slide shows, and where its files live. */
export interface AgentQuoteConfig {
  /** The Node major and zone whose value the slide shows. */
  shown: { node: string; zone: string };
  /** Where the transcript is kept, for messages. */
  answerPath: string;
  /** The command that records the run, for messages. */
  runCommand: string;
}

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
      /** The run on the configured Node major and zone. */
      shown: AgentRun;
      /** How many lines the agent's code has. */
      lines: number;
      /** How many different values the runs hold, and how many runs there are. */
      distinct: number;
      runs: number;
      /** How many zones and Node majors the runs cover. */
      zones: number;
      nodes: number;
      /** True when every zone gave each Node major the same value. */
      nodesAgree: boolean;
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

export const sameValue = (a: RunValue, b: RunValue): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Why a run record cannot be read for this code and call, as the end of a sentence that starts
 * "The run record …": missing, not a grid of one value per Node major and zone, or made for other
 * code. `undefined` when it can be read.
 */
export function runProblem(
  run: AgentRunRecord | null | undefined,
  code: string,
  call: string,
): string | undefined {
  if (
    !run ||
    !filled(run.sha256) ||
    !Array.isArray(run.nodes) ||
    !Array.isArray(run.zones) ||
    run.nodes.length === 0 ||
    run.zones.length === 0
  )
    return "is missing";
  if (
    !Array.isArray(run.values) ||
    run.values.length !== run.nodes.length ||
    run.values.some(
      (row) => !Array.isArray(row) || row.length !== run.zones.length,
    )
  )
    return "is not a grid of one value per Node major and zone";
  if (run.sha256 !== hashOf(code, call))
    return "is out of date: the code or the call changed";
  return undefined;
}

export function agentQuote(
  record: AgentQuoteRecord,
  run: AgentRunRecord | null | undefined,
  config: AgentQuoteConfig,
): AgentQuote {
  const { shown: cell, answerPath, runCommand } = config;
  const question = filled(record.question) ? record.question : "";
  const empty = TRANSCRIPT_FIELDS.filter((f) => !filled(record[f]));
  if (empty.length > 0)
    return {
      ready: false,
      why: "transcript",
      question,
      problem: `${answerPath} has empty fields: ${empty.join(", ")}. Fill them from the owner's transcript, then run: ${runCommand}`,
    };

  const stale = (reason: string): AgentQuote => ({
    ready: false,
    why: "run",
    question,
    problem: `The run record for ${answerPath} ${reason}. Run: ${runCommand}`,
  });
  const problem = runProblem(run, record.code, record.call);
  if (problem !== undefined || !run) return stale(problem ?? "is missing");
  const row = run.nodes.findIndex((n) => n.node === cell.node);
  const column = run.zones.indexOf(cell.zone);
  const shown: AgentRun | undefined =
    row < 0 || column < 0
      ? undefined
      : { node: cell.node, zone: cell.zone, value: run.values[row]![column]! };
  if (!shown)
    return stale(
      `is out of date: it has no run on Node ${cell.node} at ${cell.zone}`,
    );
  const shownCode = excerptOf(record.code, record.excerpt);
  if (shownCode === undefined)
    return {
      ready: false,
      why: "transcript",
      question,
      problem: `${answerPath} has an excerpt that is not whole line ranges inside the ${record.code.split("\n").length} lines of the code. Fix it.`,
    };

  const cells = run.values.flat();
  const distinct = cells.reduce<RunValue[]>(
    (seen, value) =>
      seen.some((v) => sameValue(v, value)) ? seen : [...seen, value],
    [],
  ).length;
  return {
    ready: true,
    ...record,
    shownCode,
    shown,
    lines: record.code.split("\n").length,
    distinct,
    runs: cells.length,
    zones: run.zones.length,
    nodes: run.nodes.length,
    nodesAgree: run.zones.every((_, j) =>
      run.values.every((row) => sameValue(row[j]!, run.values[0]![j]!)),
    ),
    instant: run.instant,
    libraries: run.libraries,
  };
}

/**
 * How much the answer moved with the machine's time zone, short enough for a table cell under
 * "Machine time zones": "Same answer in all 11", or "11 different answers in 11".
 */
export function zoneSpread({
  distinct,
  zones,
}: {
  distinct: number;
  zones: number;
}): string {
  return distinct === 1
    ? `Same answer in all ${zones}`
    : `${distinct} different answers in ${zones}`;
}

/** The text of a run's value: the value itself, or what it threw. */
export const valueLabel = (value: RunValue): string =>
  typeof value === "string" ? value : `Threw ${value.threw}`;

/** A transcript that cannot name its answers: the panel and the problem `slides-check` prints. */
function unreadable(
  question: string,
  why: string,
  { answerPath, runCommand }: AgentQuoteConfig,
): AgentQuote {
  return {
    ready: false,
    why: "transcript",
    question,
    problem: `${answerPath} ${why} Fix it, then run: ${runCommand}`,
  };
}

/** Every answer of the transcript, in file order, each with its model and its quote. */
export function agentAnswers(
  transcript: AgentTranscript,
  runs: AgentRunFile | null | undefined,
  config: AgentQuoteConfig,
): { id: string; model: string; quote: AgentQuote }[] {
  const question = filled(transcript.question) ? transcript.question : "";
  const answers = Array.isArray(transcript.answers) ? transcript.answers : [];
  return answers.map(({ id, ...answer }) => {
    const quote = agentQuote({ ...answer, question }, runs?.[id], config);
    return {
      id,
      model: answer.model,
      quote: quote.ready
        ? quote
        : { ...quote, problem: `Answer "${id}": ${quote.problem}` },
    };
  });
}

/** The answer the deck quotes, the one `quoted` names. */
export function quotedAnswer(
  transcript: AgentTranscript,
  runs: AgentRunFile | null | undefined,
  config: AgentQuoteConfig,
): AgentQuote {
  const question = filled(transcript.question) ? transcript.question : "";
  const all = agentAnswers(transcript, runs, config);
  if (all.length === 0) return unreadable(question, "has no answers.", config);
  const quoted = all.find((a) => a.id === transcript.quoted);
  if (!quoted)
    return unreadable(
      question,
      `has quoted ${JSON.stringify(transcript.quoted)}, which names no answer.`,
      config,
    );
  return quoted.quote;
}
