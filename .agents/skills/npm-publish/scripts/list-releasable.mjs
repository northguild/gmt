#!/usr/bin/env node
/**
 * Lists every package tag whose version has not yet reached npm, with the state
 * of its GitHub Release. This is the discovery step of the `/npm-publish` skill.
 *
 * "Releasable" is defined against npm, not against GitHub: a tag counts as
 * unreleased iff its version is absent from the registry. Keying off draft
 * releases instead would miss tags whose draft was deleted, tags created by a
 * local `changeset:publish`, and tags from a tagging run that half-failed.
 *
 * Usage: node .agents/skills/npm-publish/scripts/list-releasable.mjs [--no-fetch]
 * Output: JSON array on stdout. Exit 0 even when empty — an empty list is a
 * valid answer ("nothing to release"), not an error.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const tryRun = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch {
    return null;
  }
};

if (!process.argv.includes("--no-fetch")) {
  // Tags created by CI won't be local yet; without this the list is stale.
  // `--tags --prune` prunes remote-tracking refs only and leaves local-only
  // tags intact (verified); do NOT "tidy" this into `--prune-tags`, which
  // deletes any local tag absent from the remote.
  tryRun("git", ["fetch", "--tags", "--prune", "origin"]);
}

/** npm returns a bare string, not an array, when a package has exactly one version. */
const npmVersions = (name) => {
  const raw = tryRun("npm", ["view", name, "versions", "--json"]);
  if (!raw) return []; // never published, or offline — treat every tag as unreleased
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
};

/** draft | published | none — decides whether we publish, re-run, or create. */
const releaseState = (tag) => {
  const raw = tryRun("gh", ["release", "view", tag, "--json", "isDraft,url"]);
  if (!raw) return { state: "none", url: null };
  const { isDraft, url } = JSON.parse(raw);
  return { state: isDraft ? "draft" : "published", url };
};

const releasable = [];

for (const dir of readdirSync("packages")) {
  const manifestPath = `packages/${dir}/package.json`;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    continue; // not a package directory
  }
  if (manifest.private === true) continue;

  const { name } = manifest;
  const published = new Set(npmVersions(name));
  const tags = (tryRun("git", ["tag", "--list", `${name}@*`]) ?? "")
    .split("\n")
    .filter(Boolean);

  for (const tag of tags) {
    const version = tag.slice(name.length + 1);
    if (published.has(version)) continue;
    releasable.push({
      tag,
      name,
      dir,
      version,
      latestOnNpm: [...published].at(-1) ?? null,
      ...releaseState(tag),
    });
  }
}

process.stdout.write(`${JSON.stringify(releasable, null, 2)}\n`);
