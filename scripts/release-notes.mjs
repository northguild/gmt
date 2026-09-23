#!/usr/bin/env node
/**
 * Print the GitHub Release body for one published package version.
 *
 * Run as: node scripts/release-notes.mjs <package-name> <version>
 *
 * The body is the package's CHANGELOG.md section for that version. GitHub
 * rejects a release body over 125,000 characters, so a longer section is cut
 * to its headings and the first line of each entry, with a link to the full
 * changelog at the released commit.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GITHUB_RELEASE_BODY_LIMIT = 125_000;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [name, version] = process.argv.slice(2);

if (!name || !version) {
  console.error(
    "Usage: node scripts/release-notes.mjs <package-name> <version>",
  );
  process.exit(1);
}

const dir = readdirSync(resolve(root, "packages")).find((entry) => {
  try {
    const manifest = readFileSync(
      resolve(root, "packages", entry, "package.json"),
      "utf-8",
    );
    return JSON.parse(manifest).name === name;
  } catch {
    return false;
  }
});

if (!dir) {
  console.error(`No package under packages/ is named ${name}.`);
  process.exit(1);
}

const lines = readFileSync(
  resolve(root, "packages", dir, "CHANGELOG.md"),
  "utf-8",
).split("\n");
const start = lines.indexOf(`## ${version}`);

if (start === -1) {
  console.error(`packages/${dir}/CHANGELOG.md has no "## ${version}" section.`);
  process.exit(1);
}

const next = lines.findIndex((line, i) => i > start && line.startsWith("## "));
const section = lines.slice(start + 1, next === -1 ? lines.length : next);
const full = section.join("\n").trim();

if (full.length <= GITHUB_RELEASE_BODY_LIMIT) {
  process.stdout.write(full);
  process.exit(0);
}

const repo = process.env.GITHUB_REPOSITORY ?? "northguild/gmt";
// Not the tag: its `/` makes a blob URL ambiguous between ref and path.
const ref = process.env.GITHUB_SHA ?? "main";
const header = [
  "These release notes are longer than a GitHub Release can hold, so each change is listed by its first line. The full text is in the changelog.",
  "",
  `**Full changelog:** https://github.com/${repo}/blob/${ref}/packages/${dir}/CHANGELOG.md`,
  "",
].join("\n");

const summary = section.filter(
  (line) => line.startsWith("### ") || line.startsWith("- "),
);

// Dropped from the end one line at a time, so even a release with thousands
// of entries yields a body GitHub accepts.
let body = `${header}\n${summary.join("\n")}`;
while (body.length > GITHUB_RELEASE_BODY_LIMIT) {
  summary.pop();
  body = `${header}\n${summary.join("\n")}\n\n…and more; see the full changelog.`;
}

process.stdout.write(body);
