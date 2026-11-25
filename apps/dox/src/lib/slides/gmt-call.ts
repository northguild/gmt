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

/**
 * The widest line of a call. The deck's run panel holds 68 code characters at its code size
 * (`--gmt-deck-text-md`) on any stage, since both scale with the stage, so a call breaks only here.
 */
const CALL_WIDTH = 66;

/** An object or array with something in it: the values a line may open. */
const isBox = (value: unknown): value is object =>
  typeof value === "object" &&
  value !== null &&
  (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);

/** A key as `codeText` writes it: bare when it can be. */
const keyText = (key: string): string =>
  /^[A-Za-z_]\w*$/.test(key) ? key : JSON.stringify(key);

/**
 * A value's lines, as Prettier lays them: whole on the line after `lead` while that line, with
 * `tail` after it, fits `CALL_WIDTH`; else an object or array opens there, puts each entry on a line
 * of its own two spaces in from `indent`, and closes on a line of its own. A string never splits.
 */
const layout = (
  value: unknown,
  lead: string,
  indent: string,
  tail: string,
): string[] => {
  const whole = `${lead}${codeText(value)}${tail}`;
  if (!isBox(value) || whole.length <= CALL_WIDTH) return [whole];
  const inner = `${indent}  `;
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v) => ["", v])
    : Object.entries(value).map(([k, v]) => [`${keyText(k)}: `, v]);
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  return [
    `${lead}${open}`,
    ...entries.flatMap(([key, v], i) =>
      layout(v, `${inner}${key}`, inner, i < entries.length - 1 ? "," : ""),
    ),
    `${indent}${close}${tail}`,
  ];
};

/**
 * The call as a person reads it, laid out as Prettier would: on one line when it fits
 * `CALL_WIDTH`. A wider call whose last argument is an object or array, the others plain, keeps its
 * head and opens that argument there: `diffDateAsDuration("2000-01-01", "2001-01-01", "years", {`,
 * one entry a line, then `})`. One step past Prettier, a first object followed only by plain
 * arguments opens the same way and closes `}, 2027)`, which saves a slide three lines. Any other
 * wide call puts each argument on a line of its own.
 */
export const callText = (name: string, args: readonly unknown[]): string => {
  const plain = (list: readonly unknown[]) => list.map(codeText).join(", ");
  const whole = `${name}(${plain(args)})`;
  if (whole.length <= CALL_WIDTH) return whole;
  const fits = (lines: string[]) => lines.every((l) => l.length <= CALL_WIDTH);
  const [first, ...after] = args;
  const rest = args.slice(0, -1);
  const last = args.at(-1);
  if (isBox(last) && !rest.some(isBox)) {
    const head = `${name}(${rest.map((a) => `${codeText(a)}, `).join("")}`;
    const hugged = layout(last, head, "", ")");
    if (fits(hugged)) return hugged.join("\n");
  }
  if (isBox(first) && after.length > 0 && !after.some(isBox)) {
    const hugged = layout(first, `${name}(`, "", `, ${plain(after)})`);
    if (fits(hugged)) return hugged.join("\n");
  }
  return [
    `${name}(`,
    ...args.flatMap((a, i) =>
      layout(a, "  ", "  ", i < args.length - 1 ? "," : ""),
    ),
    ")",
  ].join("\n");
};

/**
 * The import a run's calls need, as a reader would copy it: one line from the package root, each
 * function once, in the order the calls use them: `import { formatDate } from "@northguild/gmt";`.
 * The root is short enough to keep the line whole on the stage; the call still runs from its
 * module (`callGmt`). A line wider than `CALL_WIDTH` puts its `from` on an indented line of its own.
 */
export const importText = (calls: readonly GmtCall[]): string => {
  const names = [...new Set(calls.map((c) => c.name))];
  const head = `import { ${names.join(", ")} }`;
  const from = `from "@northguild/gmt";`;
  const line = `${head} ${from}`;
  return line.length <= CALL_WIDTH ? line : `${head}\n  ${from}`;
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
