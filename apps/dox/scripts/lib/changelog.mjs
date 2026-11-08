/**
 * The pure half of the changelog generator: no I/O, no clock.
 *
 * `build-changelog.mjs` reads `packages/<pkg>/CHANGELOG.md` and the release tags, and hands them
 * to these functions. Everything here takes strings and returns values, so the guards can be
 * tested on fixtures. The date is formatted by a function the caller passes in (the shell passes
 * gmt's `parseDateFromUtc`), so this module needs no `Date` and no built library.
 *
 * Authority: CommonMark 0.31.2 (§4.2 ATX headings, §4.5 fenced code, §5.2 list items); the entry
 * shape is `@changesets/cli`'s, through `scripts/changelog.mjs`; scope and date come from the
 * release tags.
 */
import { slug } from "github-slugger";

const VERSION_HEADING = /^## (\d+\.\d+\.\d+)$/;
const TAG_REF = /^(@[^/]+)\/([^@]+)@(\d+\.\d+\.\d+)$/;

/**
 * Tracks fenced code by its opening run (CommonMark §4.5). The fence may be indented, because
 * changeset entries indent code by two spaces inside a list item.
 */
function fenceTracker() {
  let open = null;
  return {
    /** True when `line` is a fence line or sits inside a fence. */
    inside(line) {
      const match = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
      if (open === null) {
        // A backtick fence's info string holds no backtick (§4.5).
        if (match && !(match[1][0] === "`" && match[2].includes("`"))) {
          open = match[1];
          return true;
        }
        return false;
      }
      if (
        match &&
        match[1][0] === open[0] &&
        match[1].length >= open.length &&
        match[2].trim() === ""
      ) {
        open = null;
      }
      return true;
    },
  };
}

/**
 * Split a changelog into its releases.
 * @param {string} text
 * @returns {{ version: string, body: string }[]}
 */
export function parseChangelog(text) {
  const lines = text.split(/\r?\n/);
  const releases = [];
  const fence = fenceTracker();
  let current = null;
  lines.forEach((line, index) => {
    if (fence.inside(line)) {
      current?.lines.push(line);
      return;
    }
    const version = VERSION_HEADING.exec(line);
    if (version) {
      current = { version: version[1], lines: [] };
      releases.push(current);
      return;
    }
    if (line.startsWith("## ")) {
      throw new Error(
        `changelog: line ${index + 1} is a level-2 heading that is not a version: ${line}`,
      );
    }
    current?.lines.push(line);
  });
  return releases.map(({ version, lines: body }) => ({
    version,
    body: body.join("\n").replace(/^\n+|\s+$/g, ""),
  }));
}

/**
 * Read the output of
 * `git for-each-ref refs/tags --format='%(refname:short)%09%(*committerdate:iso-strict-local)%(committerdate:iso-strict-local)'`
 * (run with `TZ=UTC`). An annotated tag fills the first date field and a lightweight one the
 * second, so the two fields joined hold exactly one stamp.
 * @param {string} output
 * @param {string} pkg the package's directory name, `gmt` for `@northguild/gmt`
 * @returns {Map<string, { scope: string, stamp: string }>}
 */
export function parseTags(output, pkg) {
  const tags = new Map();
  for (const row of output.split(/\r?\n/)) {
    const [ref, stamp = ""] = row.split("\t");
    const match = TAG_REF.exec(ref ?? "");
    if (!match || match[2] !== pkg) continue;
    const [, scope, , version] = match;
    const earlier = tags.get(version);
    if (earlier && earlier.scope !== scope) {
      throw new Error(
        `changelog: ${pkg} ${version} is tagged under both ${earlier.scope} and ${scope}`,
      );
    }
    tags.set(version, { scope, stamp: stamp.trim() });
  }
  return tags;
}

/**
 * Group the releases by the scope that published them.
 * @param {{ version: string, body: string }[]} versions newest first, as the file has them
 * @param {Map<string, { scope: string, stamp: string }>} tags
 * @param {string} currentScope the scope of the package's `name`
 * @param {string} [pkg] the package directory, for messages
 * @returns {{ scope: string, retired: boolean, releases: { version: string, stamp: string | null, body: string }[] }[]}
 */
export function groupReleases(versions, tags, currentScope, pkg = "package") {
  const placed = versions.map(({ version, body }, index) => {
    const tag = tags.get(version);
    if (!tag) {
      if (index === 0) {
        // A release PR adds the newest heading before Release creates its tag.
        return { version, body, scope: currentScope, stamp: null };
      }
      throw new Error(
        `changelog: ${pkg} ${version} has no tag ${currentScope}/${pkg}@${version}; run git fetch --tags (a shallow clone has none)`,
      );
    }
    return { version, body, scope: tag.scope, stamp: tag.stamp };
  });

  const groups = [];
  for (const release of placed) {
    const last = groups.at(-1);
    if (last && last.scope === release.scope) {
      last.releases.push(release);
      continue;
    }
    const earlier = groups.find((group) => group.scope === release.scope);
    if (earlier) {
      throw new Error(
        `changelog: ${pkg} ${release.version} (${release.scope}) comes after ${groups.at(-1).releases.at(-1).version} (${groups.at(-1).scope}) but ${earlier.releases[0].version} is also ${release.scope}; each scope's versions must form one unbroken run`,
      );
    }
    groups.push({ scope: release.scope, releases: [release] });
  }

  const current = groups.find((group) => group.scope === currentScope);
  if (current && groups[0] !== current) {
    throw new Error(
      `changelog: ${pkg} ${groups[0].releases[0].version} (${groups[0].scope}) sits above ${current.releases[0].version} (${currentScope}); the current scope must hold the newest versions`,
    );
  }

  return groups.map(({ scope, releases }) => ({
    scope,
    retired: scope !== currentScope,
    releases: releases.map(({ version, stamp, body }) => ({
      version,
      stamp,
      body,
    })),
  }));
}

/**
 * Push every heading in an entry down so the page's own outline stays intact: a column-0 `###`
 * (changesets' change-type heading) becomes `####`, and any indented heading becomes `#####`.
 * Fenced code is left alone.
 * @param {string} body
 */
export function demoteHeadings(body) {
  const fence = fenceTracker();
  return body
    .split("\n")
    .map((line) => {
      if (fence.inside(line)) return line;
      if (line.startsWith("### ")) return `#${line}`;
      const indented = /^(\s+)#{1,6}([ \t].*)$/.exec(line);
      return indented ? `${indented[1]}#####${indented[2]}` : line;
    })
    .join("\n");
}

/**
 * Fail when two h2/h3 headings share an anchor, naming both.
 * @param {{ text: string }[]} headings
 */
export function checkSlugs(headings) {
  const seen = new Map();
  for (const { text } of headings) {
    const anchor = slug(text);
    const earlier = seen.get(anchor);
    if (earlier !== undefined) {
      throw new Error(
        `changelog: "${earlier}" and "${text}" both slug to #${anchor}`,
      );
    }
    seen.set(anchor, text);
  }
}

/**
 * Fail on a `<` that opens an HTML tag outside code spans and fences. The page is Markdown, and
 * its text twin and the search index would carry the tag as text.
 * @param {string} body
 */
export function checkRawHtml(body) {
  const fence = fenceTracker();
  const prose = body
    .split("\n")
    .filter((line) => !fence.inside(line))
    .join("\n")
    // A code span: a backtick run closed by a run of the same length (§6.1).
    .replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, "")
    // An autolink, `<https://example.com>`, is Markdown and not HTML (§6.5).
    .replace(/<[A-Za-z][A-Za-z0-9+.-]*:[^\s<>]*>/g, "");
  const tag = /<[A-Za-z/!]/.exec(prose);
  if (tag) {
    const at = prose.slice(tag.index, tag.index + 40).split("\n")[0];
    throw new Error(
      `changelog: raw HTML outside code in an entry, near "${at}"; put it in a code span`,
    );
  }
}

/**
 * The page's one-sentence description.
 * @param {string} pkgName the full name, `@northguild/gmt`
 * @param {ReturnType<typeof groupReleases>} groups
 */
export function describePage(pkgName, groups) {
  const retired = groups.find((group) => group.retired);
  return `Every release of ${pkgName}, newest first, with its date${
    retired
      ? `, including the releases published under the retired ${retired.scope} scope`
      : ""
  }.`;
}

/** Where the plate's logo is served from, a root-absolute path the site's base is put in front of. */
export const MEMORIAL_LOGO = "/burglekitt-logo.png";

/**
 * The plate under a retired group's heading: the scope's logo and one sentence saying where the
 * package went. Every figure comes from the groups: the scope from the group, the version from
 * the current group's oldest release. The blank lines inside the `<div>` are required: without
 * them the HTML block (CommonMark §4.6, type 6) swallows the image and the text as raw text.
 * Throws when the page has no current group, because the "continues as" clause could not be built.
 * @param {{ scope: string, pkgName: string, groups: ReturnType<typeof groupReleases>, installLink: string }} input
 */
export function memorialPlate({ scope, pkgName, groups, installLink }) {
  const current = groups.find((group) => !group.retired);
  const first = current?.releases.at(-1);
  if (!first) {
    throw new Error(
      `changelog: ${pkgName} has releases under the retired ${scope} scope but no current group, so the plate cannot say where the package continues`,
    );
  }
  return `<div class="gmt-changelog-memorial">

![The ${scope} organization logo](${MEMORIAL_LOGO})

**In memoriam: ${scope}.** These releases were published under the retired \`${scope}\` npm scope. The package continues as \`${pkgName}\` from ${first.version}; [install ${pkgName}](${installLink}).

</div>`;
}

/** The `major.minor` release line of a version: `1.21.3` is line `1.21`. */
export function lineOf(version) {
  return version.split(".").slice(0, 2).join(".");
}

/**
 * The path segment of a line's page. Starlight slugs drop dots, so `1.21` becomes `1-21`.
 * @param {string} line
 */
export function lineSlug(line) {
  return line.replace(".", "-");
}

/**
 * Split each scope's releases by `major.minor`, newest first. A line that changed scope part way
 * (the retired scope's last patches and the current scope's first) appears under both scopes.
 * @param {ReturnType<typeof groupReleases>} groups
 * @returns {{ scope: string, retired: boolean, lines: { line: string, releases: ReturnType<typeof groupReleases>[number]["releases"] }[] }[]}
 */
export function releaseLines(groups) {
  return groups.map(({ scope, retired, releases }) => {
    const lines = [];
    for (const release of releases) {
      const line = lineOf(release.version);
      const last = lines.at(-1);
      if (last && last.line === line) last.releases.push(release);
      else lines.push({ line, releases: [release] });
    }
    return { scope, retired, lines };
  });
}

/** `Released YYYY-MM-DD`, or `Not yet released` for a version without a tag. */
function releaseDate(release, formatDate) {
  return release.stamp === null
    ? "Not yet released"
    : `Released ${formatDate(release.stamp)}`;
}

/** `1.21.0`, or `1.21.0 to 1.21.3` when the line has patches (oldest first). */
function versionRange(releases) {
  const newest = releases[0].version;
  const oldest = releases.at(-1).version;
  return newest === oldest ? oldest : `${oldest} to ${newest}`;
}

/**
 * The description of one line's page: the package and the versions it holds, unique per page.
 * @param {string} pkgName
 * @param {string} line
 * @param {ReturnType<typeof groupReleases>} groups
 */
export function describeLinePage(pkgName, line, groups) {
  const releases = groups
    .flatMap((group) => group.releases)
    .filter((release) => lineOf(release.version) === line);
  return `Release notes of ${pkgName} ${versionRange(releases)}, with the date of each release.`;
}

/**
 * The index page's Markdown: the scope groups (`##` per scope, the plate under a retired one),
 * and under each scope its release lines newest first, with the versions and dates of each. It
 * repeats no release note, so no text is shared with a line page.
 * @param {{
 *   pkgName: string,
 *   title: string,
 *   description: string,
 *   groups: ReturnType<typeof groupReleases>,
 *   formatDate: (stamp: string) => string,
 *   sourceUrl: string,
 *   sourcePath: string,
 *   installLink: string,
 *   route: string,
 *   lastUpdated?: string,
 * }} input `route` is the index page's path with both slashes, `/changelog/`
 */
export function renderIndexPage({
  pkgName,
  title,
  description,
  groups,
  formatDate,
  sourceUrl,
  sourcePath,
  installLink,
  route,
  lastUpdated = "",
}) {
  const pkg = pkgName.slice(pkgName.indexOf("/") + 1);
  const headings = [];
  const sections = releaseLines(groups).map((group) => {
    const heading = `${group.scope}/${pkg}`;
    headings.push({ text: heading });
    const intro = group.retired
      ? `${memorialPlate({ scope: group.scope, pkgName, groups, installLink })}\n\n`
      : "";
    const lines = group.lines.map(({ line, releases }) => {
      const versions = releases.map(
        (release) =>
          `  - ${release.version}: ${releaseDate(release, formatDate)}`,
      );
      return `- [Release line ${line}](${route}${lineSlug(line)}/)\n${versions.join("\n")}`;
    });
    return `## ${heading}\n\n${intro}${lines.join("\n")}\n`;
  });
  checkSlugs(headings);

  const lead = `Every release of \`${pkgName}\`, newest first, grouped by release line. Each line's page holds its release notes, built from [\`${sourcePath}\`](${sourceUrl}).\n`;
  return `${frontmatter({ title, description, lastUpdated })}\n${lead}\n<div class="gmt-changelog">\n\n${sections.join("\n")}\n</div>\n`;
}

/**
 * The frontmatter block. The title is quoted: a plugin's title holds `: `, which a plain YAML
 * scalar cannot. Each page records the whole package, so its industry is Core.
 */
function frontmatter({ title, description, lastUpdated }) {
  return `---
title: ${JSON.stringify(title)}
description: >
  ${description}
industries: [core]
${lastUpdated ? `lastUpdated: ${lastUpdated}\n` : ""}---
`;
}

/**
 * One release line's page: its releases newest first under each scope that published them, the
 * plate under a retired scope's heading, and a link back to the index.
 * @param {{
 *   pkgName: string,
 *   title: string,
 *   indexTitle: string,
 *   line: string,
 *   groups: ReturnType<typeof groupReleases>,
 *   formatDate: (stamp: string) => string,
 *   sourceUrl: string,
 *   sourcePath: string,
 *   installLink: string,
 *   route: string,
 * }} input `groups` are all of the package's groups; the page keeps the releases of `line`.
 * `route` is the index page's path with both slashes; `indexTitle` is that page's title
 */
export function renderLinePage({
  pkgName,
  title,
  indexTitle,
  line,
  groups,
  formatDate,
  sourceUrl,
  sourcePath,
  installLink,
  route,
}) {
  const pkg = pkgName.slice(pkgName.indexOf("/") + 1);
  const headings = [];
  const sections = [];
  const held = [];
  for (const group of releaseLines(groups)) {
    const found = group.lines.find((entry) => entry.line === line);
    if (!found) continue;
    held.push(...found.releases);
    const heading = `${group.scope}/${pkg}`;
    headings.push({ text: heading });
    const intro = group.retired
      ? `${memorialPlate({ scope: group.scope, pkgName, groups, installLink })}\n\n`
      : "";
    const releases = found.releases.map((release) => {
      headings.push({ text: release.version });
      checkRawHtml(release.body);
      return `### ${release.version}\n\n${releaseDate(release, formatDate)}\n\n${demoteHeadings(release.body)}\n`;
    });
    sections.push(`## ${heading}\n\n${intro}${releases.join("\n")}`);
  }
  if (held.length === 0) {
    throw new Error(`changelog: ${pkgName} has no release in line ${line}`);
  }
  checkSlugs(headings);

  // The newest release with a tag; none while the line holds only an unreleased version.
  const stamps = held.map((release) => release.stamp).filter(Boolean);
  const lastUpdated = stamps.sort().at(-1) ?? "";
  const description = describeLinePage(pkgName, line, groups);
  const lead = `Release notes of \`${pkgName}\` ${versionRange(held)}, newest first, built from [\`${sourcePath}\`](${sourceUrl}). Back to [${indexTitle}](${route}).\n`;
  return `${frontmatter({ title, description, lastUpdated })}\n${lead}\n<div class="gmt-changelog">\n\n${sections.join("\n")}\n</div>\n`;
}
