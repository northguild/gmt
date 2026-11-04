#!/usr/bin/env node
/**
 * Generate the changelog pages from each package's CHANGELOG.md and the release tags.
 *
 * Emits one page per package that has a CHANGELOG.md: src/content/docs/changelog/index.md for
 * `@northguild/gmt` and changelog/<dir>.md for each other package. The package list is read from
 * the directory, so a new package with a changelog gets a page with no change here (the sidebar
 * test then names the missing link). A version's scope (current or
 * the retired `@burglekitt`) and its release date come from its git tag, read in one call; the
 * transform is in lib/changelog.mjs. This script never writes the CHANGELOG.md files; they are
 * the release record. The emitted page is gitignored.
 *
 * `installLinkFor` picks the page's install link: `@northguild/gmt` links to /install/ and every
 * other package to the linting guide, because today every other package is a lint plugin. A
 * future package that is not a lint plugin needs a change there.
 *
 * Needs a built packages/gmt (the date is formatted by gmt) and the release tags
 * (`git fetch --tags` in a shallow clone).
 *
 * Run as: node apps/dox/scripts/build-changelog.mjs
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGmt } from "../../../scripts/lib/gmt.mjs";
import {
  describePage,
  groupReleases,
  parseChangelog,
  parseTags,
  renderPage,
} from "./lib/changelog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..", "..");
const outDir = resolve(appRoot, "src", "content", "docs", "changelog");

/** Every package with a changelog, sorted, `gmt` first; each writes one page. */
const PACKAGES = readdirSync(resolve(repoRoot, "packages"))
  .filter((dir) =>
    existsSync(resolve(repoRoot, "packages", dir, "CHANGELOG.md")),
  )
  .sort((a, b) => (a === "gmt" ? -1 : b === "gmt" ? 1 : a.localeCompare(b)))
  .map((dir) => ({ dir, out: dir === "gmt" ? "index.md" : `${dir}.md` }));

/** Where a retired-scope plate sends the reader to install: the library, or a plugin's guide. */
const installLinkFor = (dir) =>
  dir === "gmt" ? "/install/" : "/guides/integration/linting/";

const SOURCE_BASE = "https://github.com/northguild/gmt/blob/main";

function git(args, env = process.env) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
  });
}

try {
  const gmt = await loadGmt();
  // Every tag in one call, in UTC so each stamp ends in `Z`.
  const tagOutput = git(
    [
      "for-each-ref",
      "refs/tags",
      "--format=%(refname:short)%09%(*committerdate:iso-strict-local)%(committerdate:iso-strict-local)",
    ],
    { ...process.env, TZ: "UTC" },
  );

  mkdirSync(outDir, { recursive: true });
  for (const { dir, out } of PACKAGES) {
    const sourcePath = `packages/${dir}/CHANGELOG.md`;
    const pkgName = JSON.parse(
      readFileSync(resolve(repoRoot, "packages", dir, "package.json"), "utf8"),
    ).name;
    const currentScope = pkgName.slice(0, pkgName.indexOf("/"));
    const versions = parseChangelog(
      readFileSync(resolve(repoRoot, sourcePath), "utf8"),
    );
    if (versions.length === 0) {
      throw new Error(`changelog: ${sourcePath} has no "## <version>" entry`);
    }
    const groups = groupReleases(
      versions,
      parseTags(tagOutput, dir),
      currentScope,
      dir,
    );

    // The date of the commit that last changed the changelog; none without history.
    let lastUpdated = "";
    try {
      lastUpdated = git(["log", "-1", "--format=%cI", "--", sourcePath]).trim();
    } catch {
      lastUpdated = "";
    }

    const source = renderPage({
      pkgName,
      title: dir === "gmt" ? "Changelog" : `Changelog: ${dir}`,
      description: describePage(pkgName, groups),
      groups,
      formatDate: (stamp) => gmt.parseDateFromUtc(stamp),
      sourceUrl: `${SOURCE_BASE}/${sourcePath}`,
      sourcePath,
      installLink: installLinkFor(dir),
      lastUpdated,
    });

    // Idempotent write: don't bump mtime when nothing changed.
    const outPath = resolve(outDir, out);
    let previous = "";
    try {
      previous = readFileSync(outPath, "utf8");
    } catch {
      previous = "";
    }
    if (previous !== source) writeFileSync(outPath, source);

    const untagged = groups
      .flatMap((group) => group.releases)
      .filter((release) => release.stamp === null).length;
    console.log(
      `changelog: ${dir} ${versions.length} versions, ${groups.length} scopes, ${untagged} untagged (${previous === source ? "unchanged" : "written"})`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
