/**
 * The page contract every gate script answers (built.md, "Gates"):
 *
 *   --list-pages      print a JSON array of site paths (`/tools/dwell-ledger/`, no `/gmt` prefix)
 *                     and exit 0, without launching a browser;
 *   --pages <a,b,..>  run only those paths; a path the gate does not know is an error (exit 2), so
 *                     a typo never passes as an empty run.
 *
 * `applyPageContract` is called once, near the top of a script, with the gate's own page list. It
 * exits for `--list-pages` and for a bad `--pages`; otherwise it returns the requested paths, or
 * null when the flag is absent (the gate then runs its whole list).
 */

/** The value after `--name`, or undefined. */
function valueOf(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

/**
 * @param {{ gate: string, pages: string[], argv?: string[] }} options
 * @returns {string[] | null}
 */
export function applyPageContract({
  gate,
  pages,
  argv = process.argv.slice(2),
}) {
  if (argv.includes("--list-pages")) {
    console.log(JSON.stringify(pages));
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
