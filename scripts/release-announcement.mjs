#!/usr/bin/env node
/**
 * Print the Discord announcement for a set of published package versions.
 *
 * Run as: PUBLISHED='[{"name":"@northguild/gmt","version":"1.16.0"}]' node scripts/release-announcement.mjs
 *
 * PUBLISHED is the `published-packages` output of changesets/action/publish.
 */

const pkgs = JSON.parse(process.env.PUBLISHED ?? "[]");
const repo = process.env.GITHUB_REPOSITORY ?? "northguild/gmt";

if (pkgs.length === 0) {
  console.error("PUBLISHED names no packages.");
  process.exit(1);
}

const blocks = pkgs.map((p) => {
  const tag = `${p.name}@${p.version}`;
  const url = `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
  // Name the dist-tag only when it is not `latest`; Changesets publishes
  // pre-mode versions under their pre-tag.
  const pre = p.version.includes("-")
    ? p.version.split("-")[1].split(".")[0]
    : null;
  const where = pre ? ` under the \`${pre}\` tag` : "";
  // The URL goes out bare on its own line: Discord unfurls it into the release
  // card carrying the changelog. Wrapping it in <> would suppress that card.
  return [`🚀 Version \`${tag}\` is now live on npm${where}!`, url].join("\n");
});

process.stdout.write(blocks.join("\n\n"));
