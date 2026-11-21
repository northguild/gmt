import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import plugin, { recommendedConfig } from "@northguild/gmt-oxlint";

/**
 * Our own lint run over code the deck quotes: oxlint with `@northguild/gmt-oxlint`'s recommended
 * rules, as a user installs them, run when the page is built. Nothing is recorded; a changed rule
 * or a changed answer shows on the next build. The plugin is loaded from its `dist`, so
 * `@northguild/gmt-oxlint` is built before Dox (`build:gmt-oxlint` in `scripts/lib/affected.mjs`).
 */

/** One error the plugin reported: the rule's short name and the 1-based line it points at. */
interface LintFinding {
  rule: string;
  line: number;
}

/** The part of oxlint's `--format=json` report this module reads. */
interface OxlintReport {
  diagnostics: {
    code: string;
    filename: string;
    labels: { span: { line: number } }[];
  }[];
}

const { resolve } = createRequire(import.meta.url);

/** The plugin's entry, which oxlint loads by path: the temporary folder cannot resolve its name. */
const PLUGIN_ENTRY = resolve("@northguild/gmt-oxlint");
const OXLINT_ROOT = dirname(dirname(resolve("oxlint")));

const packageVersion = (root: string): string =>
  (
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;

/** The versions the run used, for the slide's caption. */
export const LINT_VERSIONS = {
  oxlint: packageVersion(OXLINT_ROOT),
  plugin: packageVersion(dirname(dirname(PLUGIN_ENTRY))),
};

/** The plugin's rules, in the order the recommended config lists them, each with its own description. */
export const LINT_RULES: readonly { rule: string; description: string }[] =
  Object.keys(recommendedConfig.rules).map((key) => {
    const rule = key.slice(`${plugin.meta.name}/`.length);
    return { rule, description: plugin.rules[rule]!.meta.docs.description };
  });

/**
 * Each file's findings from oxlint's report, in line order, keeping only the plugin's own rules:
 * oxlint's built-in defaults are not what the slide is about.
 */
export function findingsOf(
  report: OxlintReport,
  files: readonly string[],
): Map<string, LintFinding[]> {
  const pattern = new RegExp(
    `^${plugin.meta.name.replaceAll("/", "\\/")}\\((.+)\\)$`,
  );
  const found = new Map(files.map((file) => [file, [] as LintFinding[]]));
  for (const { code, filename, labels } of report.diagnostics) {
    const rule = pattern.exec(code)?.[1];
    const line = labels[0]?.span.line;
    if (rule === undefined || line === undefined) continue;
    found.get(filename)?.push({ rule, line });
  }
  for (const list of found.values()) list.sort((a, b) => a.line - b.line);
  return found;
}

/** Findings grouped by rule, in the order each rule first appears, with every line it flagged. */
export function byRule(
  findings: readonly LintFinding[],
): { rule: string; lines: number[] }[] {
  const groups = new Map<string, number[]>();
  for (const { rule, line } of findings)
    groups.set(rule, [...(groups.get(rule) ?? []), line]);
  return [...groups].map(([rule, lines]) => ({ rule, lines }));
}

/** Lints each piece of code, by id, and returns its findings; an id with none maps to `[]`. */
export function lintCode(
  sources: readonly { id: string; code: string }[],
): Map<string, LintFinding[]> {
  const dir = mkdtempSync(join(tmpdir(), "gmt-deck-lint-"));
  try {
    const config = join(dir, ".oxlintrc.json");
    writeFileSync(
      config,
      JSON.stringify({ ...recommendedConfig, jsPlugins: [PLUGIN_ENTRY] }),
    );
    const files = sources.map(({ id }) => `${id}.js`);
    sources.forEach(({ code }, i) => writeFileSync(join(dir, files[i]!), code));
    // oxlint exits 1 when it finds an error, and the report is still on stdout.
    let out: string;
    try {
      out = execFileSync(
        process.execPath,
        [
          join(OXLINT_ROOT, "bin/oxlint"),
          "-c",
          config,
          "--format=json",
          ...files,
        ],
        {
          cwd: dir,
          encoding: "utf8",
        },
      );
    } catch (error) {
      const { stdout } = error as { stdout?: string };
      if (!stdout) throw error;
      out = stdout;
    }
    const byFile = findingsOf(JSON.parse(out) as OxlintReport, files);
    return new Map(
      sources.map(({ id }, i) => [id, byFile.get(files[i]!) ?? []]),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
