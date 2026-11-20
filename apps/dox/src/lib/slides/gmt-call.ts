/**
 * The deck's gmt calls, run at build time for `GmtRun.astro`: the code a slide shows and the value
 * it shows come from one source, so neither can drift from the library.
 *
 * `callGmt` loads a module barrel from `GMT_MODULES` (module granularity, never a namespace
 * barrel), calls one of its functions and returns what it gave. gmt returns `""`, `null`, `false`
 * or `[]` for invalid input rather than throwing; `isSentinel` tells the caller, which then shows
 * the signal-lost state. An unknown module or function throws, so a typo fails the build.
 */
import type { GmtCall, RunStep } from "~/components/slides/types";
import { GMT_MODULES } from "~/lib/gmt-modules";

export async function callGmt(
  module: string,
  name: string,
  args: readonly unknown[],
): Promise<unknown> {
  const load = Object.hasOwn(GMT_MODULES, module)
    ? GMT_MODULES[module]
    : undefined;
  if (!load) {
    throw new Error(
      `Unknown gmt module "${module}": use a key of GMT_MODULES (src/lib/gmt-modules.ts)`,
    );
  }
  const loaded = await load();
  const fn = Object.hasOwn(loaded, name) ? loaded[name] : undefined;
  if (typeof fn !== "function") {
    throw new Error(`gmt module "${module}" has no function "${name}"`);
  }
  return (fn as (...a: unknown[]) => unknown)(...args);
}

/** The values gmt gives for invalid input. */
export const isSentinel = (value: unknown): boolean =>
  value === "" ||
  value === null ||
  value === false ||
  (Array.isArray(value) && value.length === 0);

/** A value as code: `"2024-02-29"`, `[]`, `{ type: "year", value: "2024" }`. */
export const codeText = (value: unknown): string =>
  JSON.stringify(value, null, 1)
    .replace(/\n\s*/g, " ")
    .replace(/"([A-Za-z_]\w*)":/g, "$1:");

/** The widest line of a call: what the deck's run panel shows at its code size without wrapping. */
const CALL_WIDTH = 50;

/**
 * The call as a person reads it, in as few lines as fit `CALL_WIDTH`: `addDate("2024-01-31", {
 * months: 1 })` on one line; a wider call fills each line with whole arguments and moves the next
 * argument to an indented line of its own, so a string is never split. An argument wider than a
 * line keeps a line to itself.
 */
export const callText = (name: string, args: readonly unknown[]): string => {
  const lines = [`${name}(`];
  args.map(codeText).forEach((part, i) => {
    const last = lines.length - 1;
    const joined = `${lines[last]}${i === 0 ? "" : " "}${part}`;
    if (i === 0 || joined.length + 1 <= CALL_WIDTH) lines[last] = joined;
    else lines.push(`  ${part}`);
    if (i < args.length - 1) lines[lines.length - 1] += ",";
  });
  lines[lines.length - 1] += ")";
  return lines.join("\n");
};

/**
 * The import lines a run's calls need, one per module in the order the calls use them, as a reader
 * would copy them: `import { formatDate } from "@northguild/gmt/plain/format";`. A line wider than
 * `CALL_WIDTH` puts its `from` on an indented line of its own.
 */
export const importText = (calls: readonly GmtCall[]): string => {
  const names = new Map<string, string[]>();
  for (const c of calls) {
    const list = names.get(c.module) ?? [];
    if (!list.includes(c.name)) list.push(c.name);
    names.set(c.module, list);
  }
  return [...names]
    .map(([module, list]) => {
      const head = `import { ${list.join(", ")} }`;
      const from = `from "@northguild/gmt/${module}";`;
      const line = `${head} ${from}`;
      return line.length <= CALL_WIDTH ? line : `${head}\n  ${from}`;
    })
    .join("\n");
};

/**
 * A value's outcome: the sentinel is lost; a call with a `want` is right only when the value
 * prints the same as it, else wrong; a call without one is right.
 */
const outcomeOf = (value: unknown, want: unknown): RunStep["outcome"] => {
  if (isSentinel(value)) return "lost";
  if (want === undefined) return "right";
  return codeText(value) === codeText(want) ? "right" : "wrong";
};

/** Each call as a run's step: the call, the value it gave, its outcome and the value expected. */
export async function gmtSteps(calls: readonly GmtCall[]): Promise<RunStep[]> {
  return Promise.all(
    calls.map(async (c) => {
      const value = await callGmt(c.module, c.name, c.args);
      return {
        code: callText(c.name, c.args),
        out: [codeText(value)],
        outcome: outcomeOf(value, c.want),
        ...(c.want === undefined ? {} : { want: codeText(c.want) }),
        ...(c.bug === undefined ? {} : { bug: c.bug }),
      };
    }),
  );
}
