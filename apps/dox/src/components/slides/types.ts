/** Shapes the slide components share, so a deck's content files and the components agree on them. */

/** A split-flap row's end value: who gave it (or the words before the number), and the number as the report writes it. */
export interface CounterEnd {
  label: string;
  value: string;
}

/** How a result reads: the bug a report shows, the right value, or gmt's sentinel for no answer. */
type Outcome = "wrong" | "right" | "lost";

/**
 * One line of code in a recorded run, its result (the lines it printed) and, for a wrong result,
 * the value it should have given: the two lines of a failed assertion.
 */
export interface RunStep {
  code: string;
  out: readonly string[];
  outcome: Outcome;
  /** The right value, shown as Expected beside a result that is not it. */
  want?: string;
  /** What the broken path gives for the same input, shown beside a GMT result. */
  bug?: Bug;
}

/** What a filed bug gives for a call's input: who gives it, and the value or the words its filing uses. */
export interface Bug {
  by: string;
  gives: string;
}

/** A recorded run: what ran it, its prompt and its steps. */
export interface Run {
  /** An engine ("Node 26"), or GMT with the Node and ICU it was built on. */
  runtime: string;
  /** `$` for a shell command, `>` for a JavaScript call. */
  prompt: "$" | ">";
  steps: readonly RunStep[];
}

/** One gmt call: a key of `GMT_MODULES`, the function's name and its arguments as JSON. */
export interface GmtCall {
  module: string;
  name: string;
  args: readonly unknown[];
  /** The value the call should give, from the filing or a cited source; it marks the result right or wrong. */
  want?: unknown;
  /** What the filed bug gives for the same input, from its filing. */
  bug?: Bug;
}
