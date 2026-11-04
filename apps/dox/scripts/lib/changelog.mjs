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

/**
 * The page's Markdown, frontmatter included.
 * @param {{
 *   pkgName: string,
 *   title: string,
 *   description: string,
 *   groups: ReturnType<typeof groupReleases>,
 *   formatDate: (stamp: string) => string,
 *   sourceUrl: string,
 *   sourcePath: string,
 *   installLink: string,
 *   lastUpdated?: string,
 * }} input `pkgName` is the full name, `@northguild/gmt`; `installLink` is where the retired
 * scope's plate sends the reader to install it
 */
export function renderPage({
  pkgName,
  title,
  description,
  groups,
  formatDate,
  sourceUrl,
  sourcePath,
  installLink,
  lastUpdated = "",
}) {
  const pkg = pkgName.slice(pkgName.indexOf("/") + 1);

  const headings = [];
  const sections = groups.map((group) => {
    const heading = `${group.scope}/${pkg}`;
    headings.push({ text: heading });
    const intro = group.retired
      ? `${memorialPlate({ scope: group.scope, pkgName, groups, installLink })}\n\n`
      : "";
    const releases = group.releases.map((release) => {
      headings.push({ text: release.version });
      checkRawHtml(release.body);
      const date =
        release.stamp === null
          ? "Not yet released"
          : `Released ${formatDate(release.stamp)}`;
      return `### ${release.version}\n\n${date}\n\n${demoteHeadings(release.body)}\n`;
    });
    return `## ${heading}\n\n${intro}${releases.join("\n")}`;
  });
  checkSlugs(headings);

  // Quoted: a plugin's title holds `: `, which a plain YAML scalar cannot.
  const frontmatter = `---
title: ${JSON.stringify(title)}
description: >
  ${description}
${lastUpdated ? `lastUpdated: ${lastUpdated}\n` : ""}---
`;
  const lead = `Every release of \`${pkgName}\`, newest first, built from [\`${sourcePath}\`](${sourceUrl}).\n`;
  // The wrapper scopes the table CSS (gmt-content-tables.css); `stripMdx` drops the two lone
  // `<div>` lines from the text twin.
  return `${frontmatter}\n${lead}\n<div class="gmt-changelog">\n\n${sections.join("\n")}\n</div>\n`;
}
