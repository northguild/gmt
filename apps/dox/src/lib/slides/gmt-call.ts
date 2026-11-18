/**
 * The deck's gmt calls, run at build time for `GmtResult.astro`: the code a slide shows and the
 * value it shows come from one source, so neither can drift from the library.
 *
 * `callGmt` loads a module barrel from `GMT_MODULES` (module granularity, never a namespace
 * barrel), calls one of its functions and returns what it gave. gmt returns `""`, `null`, `false`
 * or `[]` for invalid input rather than throwing; `isSentinel` tells the caller, which then shows
 * the signal-lost state. An unknown module or function throws, so a typo fails the build.
 */
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

/** The call as a person reads it: `addDate("2024-01-31", { months: 1 })`. */
export function callText(name: string, args: readonly unknown[]): string {
  return `${name}(${args
    .map((a) =>
      JSON.stringify(a, null, 1)
        .replace(/\n\s*/g, " ")
        .replace(/"([A-Za-z_]\w*)":/g, "$1:"),
    )
    .join(", ")})`;
}

/** The value as the slide prints it: a string as itself, anything else as JSON. */
export const valueText = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value);
