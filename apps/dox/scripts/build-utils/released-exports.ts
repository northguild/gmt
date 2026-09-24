/**
 * Which exports are on npm, so the reference can badge the ones that are not.
 *
 * The site deploys from `main` on every merge, but npm only moves when a human
 * merges a release PR. Between the two, `main` documents functions nobody can
 * install. The published set is read from the newest `@northguild/gmt@X.Y.Z`
 * git tag, which the release workflow pushes after a successful publish:
 *
 * - Locally, a branch that has bumped `package.json` but not published sees the
 *   previous release's tag, so its new functions are badged.
 * - In production, a push that publishes must have its tag before this runs,
 *   or the functions it released stay badged until the next deploy. That is
 *   why `deploy-dox.yml` runs after the Release workflow (PR #280).
 * - With no tags at all (a shallow checkout), nothing is badged. A missing
 *   badge is safer than badging every page.
 *
 * Matching is by exported name, because each reference page is one export. A
 * function moved to a new subpath under the same name therefore reads as
 * released, although its import path is new.
 */
import { execFileSync } from "node:child_process";

export const GMT_TAG_PREFIX = "@northguild/gmt@";

export type ReleasedBaseline =
  | { tag: string; version: string; names: Set<string> }
  | { none: "no-tags" | "git-unavailable" };

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Newest stable gmt release tag, by version, or null when there is none. */
export function latestGmtTag(repoRoot: string): string | null {
  const out = git(repoRoot, [
    "tag",
    "--list",
    `${GMT_TAG_PREFIX}*`,
    "--sort=-v:refname",
  ]);
  const stable = out
    .split("\n")
    .map((t) => t.trim())
    // A prerelease is published under its own dist-tag, not as the release.
    .filter((t) => /^@northguild\/gmt@\d+\.\d+\.\d+$/.test(t));
  return stable[0] ?? null;
}

const EXPORT_DECLARATION =
  /^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;

/** Names declared by `export <kind> <name>` lines. Re-exports are skipped. */
export function parseExportNames(grepOutput: string): Set<string> {
  const names = new Set<string>();
  for (const line of grepOutput.split("\n")) {
    const m = EXPORT_DECLARATION.exec(line.trim());
    if (m?.[1]) names.add(m[1]);
  }
  return names;
}

/** Every name the library declared as an export at `tag`. */
export function releasedExportNames(repoRoot: string, tag: string): Set<string> {
  let out = "";
  try {
    out = git(repoRoot, [
      "grep",
      "-h",
      "-I",
      "-E",
      // POSIX ERE: git grep does not understand \s.
      "^export[[:space:]]",
      tag,
      "--",
      "packages/gmt/src",
      ":(exclude)*.test.ts",
    ]);
  } catch {
    // `git grep` exits 1 when nothing matches; an empty set is the answer.
  }
  return parseExportNames(out);
}

/** The published baseline to badge against. Never throws. */
export function releasedBaseline(repoRoot: string): ReleasedBaseline {
  let tag: string | null;
  try {
    tag = latestGmtTag(repoRoot);
  } catch {
    return { none: "git-unavailable" };
  }
  if (tag === null) return { none: "no-tags" };
  return {
    tag,
    version: tag.slice(GMT_TAG_PREFIX.length),
    names: releasedExportNames(repoRoot, tag),
  };
}

/** A stable string for the generator's input hash: a new tag invalidates the cache. */
export function baselineKey(baseline: ReleasedBaseline): string {
  return "tag" in baseline ? baseline.tag : `none:${baseline.none}`;
}

/** Whether `name` is documented but not in the published baseline. */
export function isUnreleased(baseline: ReleasedBaseline, name: string): boolean {
  return "tag" in baseline && !baseline.names.has(name);
}

/** The caution aside at the top of an unreleased reference page. */
export function unreleasedNote(version: string): string {
  return (
    ":::caution[Unreleased]\n" +
    `Not in \`@northguild/gmt\` ${version} on npm yet. It is on \`main\` and ships in the next release.\n` +
    ":::"
  );
}

export const UNRELEASED_BADGE = '{ text: "Unreleased", variant: "caution" }';

/** `mdx` with `block` placed straight after its frontmatter, before the body. */
export function insertAfterFrontmatter(mdx: string, block: string): string {
  const m = /^---\n[\s\S]*?\n---\n/.exec(mdx);
  if (!m) return `${block}\n\n${mdx}`;
  const head = m[0];
  const body = mdx.slice(head.length).replace(/^\n+/, "");
  return `${head}\n${block}\n\n${body}`;
}
