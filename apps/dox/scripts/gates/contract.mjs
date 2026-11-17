/**
 * The page contract every gate script answers (`context/dox/built/tier-2-gates.md`, "Gates"):
 *
 *   --list-pages      print a JSON array of site paths (`/tools/dwell-ledger/`, no `/gmt` prefix)
 *                     and exit 0, without launching a browser;
 *   --pages <a,b,..>  run only those paths; a path the gate does not know is an error (exit 2), so
 *                     a typo never passes as an empty run.
 *
 * and, from a gate whose pages differ a lot in run time (`costs: true` in the registry):
 *
 *   --list-page-costs print a JSON object of each path's measured minutes and exit 0, so the
 *                     runner deals the pages into shards by time rather than by name.
 *
 * `applyPageContract` is awaited once, near the top of a script, with the gate's own page list and,
 * for a costed gate, its costs. It exits for `--list-pages`, `--list-page-costs` and a bad
 * `--pages`; otherwise it returns the requested paths, or null when the flag is absent (the gate
 * then runs its whole list).
 */

/**
 * Resolves once everything written to stdout so far has reached it. A pipe on macOS takes stdout
 * asynchronously, so `process.exit` straight after a long `console.log` cuts the output at the
 * pipe's 64 KiB: the runner reads a page list through a pipe, and `table-fit` lists every page that
 * holds a table. Await it before an exit that follows printed output.
 */
export function stdoutDrained() {
  return new Promise((resolve) => process.stdout.write("", resolve));
}

/** The value after `--name`, or undefined. */
function valueOf(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

/**
 * @param {{ gate: string, pages: string[], costs?: Record<string, number>, argv?: string[] }} options
 * @returns {Promise<string[] | null>}
 */
export async function applyPageContract({
  gate,
  pages,
  costs,
  argv = process.argv.slice(2),
}) {
  if (argv.includes("--list-pages")) {
    console.log(JSON.stringify(pages));
    await stdoutDrained();
    process.exit(0);
  }
  if (argv.includes("--list-page-costs")) {
    if (costs === undefined) {
      console.error(`${gate}: this gate lists no page costs`);
      process.exit(2);
    }
    console.log(JSON.stringify(costs));
    await stdoutDrained();
    process.exit(0);
  }
  const raw = valueOf(argv, "pages");
  if (raw === undefined) {
    if (argv.includes("--pages")) {
      console.error(`${gate}: --pages needs a comma list of site paths`);
      process.exit(2);
    }
    return null;
  }
  const wanted = raw.split(",").filter(Boolean);
  const unknown = wanted.filter((page) => !pages.includes(page));
  if (!wanted.length || raw.startsWith("--") || unknown.length) {
    console.error(
      `${gate}: --pages ${unknown.length ? `"${unknown.join(",")}" is not a page this gate checks` : "needs a comma list of site paths"}; known: ${pages.join(", ")}`,
    );
    process.exit(2);
  }
  return wanted;
}

/**
 * One shard of a list, sorted. The shards of one list cover it exactly once. `shard` is `{ i, n }`
 * with `1 <= i <= n`, or null for the whole sorted list.
 *
 * Without `costs`, shard `i` is every entry whose sorted index is `i - 1` modulo `n`. With `costs`
 * (each entry's measured minutes), the entries are dealt costliest first, ties by name, each to the
 * shard with the least time so far (the lowest-numbered on a tie), so no shard carries the heavy
 * pages together and one added page moves only the pages dealt after it. An entry with no positive
 * cost is an error: a new page must be measured before it can be placed.
 *
 * @param {string[]} list
 * @param {{ i: number, n: number } | null | undefined} shard
 * @param {Record<string, number>} [costs]
 * @returns {string[]}
 */
export function shardOf(list, shard, costs) {
  const sorted = [...list].sort();
  if (!shard) return sorted;
  if (costs === undefined)
    return sorted.filter((_, idx) => idx % shard.n === shard.i - 1);
  const unmeasured = sorted.filter(
    (page) => !Object.hasOwn(costs, page) || !(costs[page] > 0),
  );
  if (unmeasured.length > 0)
    throw new Error(`shardOf: no measured cost for ${unmeasured.join(", ")}`);
  const loads = Array.from({ length: shard.n }, () => 0);
  const mine = new Set();
  for (const page of [...sorted].sort((a, b) => costs[b] - costs[a])) {
    const lightest = loads.indexOf(Math.min(...loads));
    loads[lightest] += costs[page];
    if (lightest === shard.i - 1) mine.add(page);
  }
  return sorted.filter((page) => mine.has(page));
}
