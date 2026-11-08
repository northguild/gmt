import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { slug } from "github-slugger";
// The package root, as `src/lib/upstream-summary.ts` imports it (see the comment there).
import { parseDateFromUtc } from "@northguild/gmt";
import {
  describePage,
  checkRawHtml,
  checkSlugs,
  demoteHeadings,
  groupReleases,
  MEMORIAL_LOGO,
  parseChangelog,
  parseTags,
  lineOf,
  releaseLines,
  renderIndexPage,
  renderLinePage,
  lineSlug,
  describeLinePage,
} from "./changelog.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..", "..");
const packagesDir = resolve(repoRoot, "packages");
/** Every package with a changelog, `gmt` first, as the generator orders them. */
const changelogPackages = readdirSync(packagesDir)
  .filter((dir) => existsSync(resolve(packagesDir, dir, "CHANGELOG.md")))
  .sort((a, b) => (a === "gmt" ? -1 : b === "gmt" ? 1 : a.localeCompare(b)));

/** Every tag, as `build-changelog.mjs` reads them; empty when git has none (a shallow clone). */
function readTags(): string {
  try {
    return execFileSync(
      "git",
      [
        "for-each-ref",
        "refs/tags",
        "--format=%(refname:short)%09%(*committerdate:iso-strict-local)%(committerdate:iso-strict-local)",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, TZ: "UTC" },
      },
    );
  } catch {
    return "";
  }
}
const tagOutput = readTags();
const hasTags = parseTags(tagOutput, "gmt").size > 0;

const formatDate = (stamp: string): string => parseDateFromUtc(stamp);

describe("parseChangelog", () => {
  it("splits on version headings and keeps the body", () => {
    expect(
      parseChangelog(
        "# pkg\n\n## 1.1.0\n\n### Minor Changes\n\n- a: x\n\n## 1.0.0\n\n- b: y\n",
      ),
    ).toEqual([
      { version: "1.1.0", body: "### Minor Changes\n\n- a: x" },
      { version: "1.0.0", body: "- b: y" },
    ]);
  });

  it("ignores a `## ` line inside a fence, indented or not", () => {
    const text =
      "## 1.0.0\n\n- a:\n\n  ```md\n  ## not a version\n  ```\n\n```\n## nor this\n```\n";
    expect(parseChangelog(text)).toHaveLength(1);
  });

  it("rejects a level-2 heading that is not a version, naming its line", () => {
    expect(() =>
      parseChangelog("# pkg\n\n## 1.0.0\n\n## Unreleased\n"),
    ).toThrow(/line 5.*Unreleased/);
  });
});

describe("parseTags", () => {
  const output = [
    "@burglekitt/gmt@1.0.0\t2026-04-10T17:17:54Z", // annotated: the first date field
    "@northguild/gmt@1.21.0\t2026-11-03T10:48:13Z", // lightweight: the second
    "@northguild/gmt-eslint@1.1.2\t2026-10-01T00:00:00Z",
    "v1.0.0\t",
  ].join("\n");

  it("reads an annotated and a lightweight tag", () => {
    const tags = parseTags(output, "gmt");
    expect(tags.get("1.0.0")).toEqual({
      scope: "@burglekitt",
      stamp: "2026-04-10T17:17:54Z",
    });
    expect(tags.get("1.21.0")).toEqual({
      scope: "@northguild",
      stamp: "2026-11-03T10:48:13Z",
    });
  });

  it("does not read a plugin's tag as gmt's", () => {
    expect(parseTags(output, "gmt").has("1.1.2")).toBe(false);
    expect(parseTags(output, "gmt-eslint").get("1.1.2")?.scope).toBe(
      "@northguild",
    );
  });
});

describe("groupReleases", () => {
  const tag = (scope: string) => ({ scope, stamp: "2026-01-01T00:00:00Z" });
  const v = (version: string) => ({ version, body: `body ${version}` });

  it("puts the current scope first and the retired scope after it", () => {
    const groups = groupReleases(
      [v("1.1.0"), v("1.0.0")],
      new Map([
        ["1.1.0", tag("@northguild")],
        ["1.0.0", tag("@burglekitt")],
      ]),
      "@northguild",
      "gmt",
    );
    expect(groups.map((g) => [g.scope, g.retired])).toEqual([
      ["@northguild", false],
      ["@burglekitt", true],
    ]);
  });

  it("lets only the newest version lack a tag", () => {
    const tags = new Map([["1.0.0", tag("@northguild")]]);
    const [group] = groupReleases(
      [v("1.1.0"), v("1.0.0")],
      tags,
      "@northguild",
    );
    expect(group.releases[0]).toMatchObject({ version: "1.1.0", stamp: null });
  });

  it("stops the build on an older untagged version", () => {
    const tags = new Map([["1.1.0", tag("@northguild")]]);
    expect(() =>
      groupReleases([v("1.1.0"), v("1.0.0")], tags, "@northguild", "gmt"),
    ).toThrow(
      /gmt 1\.0\.0 has no tag @northguild\/gmt@1\.0\.0.*git fetch --tags/,
    );
  });

  it("rejects scopes that are not contiguous, naming both versions", () => {
    const tags = new Map([
      ["1.2.0", tag("@northguild")],
      ["1.1.0", tag("@burglekitt")],
      ["1.0.0", tag("@northguild")],
    ]);
    expect(() =>
      groupReleases([v("1.2.0"), v("1.1.0"), v("1.0.0")], tags, "@northguild"),
    ).toThrow(/1\.0\.0.*1\.1\.0|1\.1\.0.*1\.0\.0/);
  });

  it("rejects a retired version above a current one, naming both", () => {
    const tags = new Map([
      ["1.1.0", tag("@burglekitt")],
      ["1.0.0", tag("@northguild")],
    ]);
    expect(() =>
      groupReleases([v("1.1.0"), v("1.0.0")], tags, "@northguild"),
    ).toThrow(/1\.1\.0.*1\.0\.0/);
  });
});

describe("demoteHeadings", () => {
  it("moves column-0 ### to ####, and any indented heading to #####", () => {
    const body = [
      "### Minor Changes",
      "  ### Deep",
      "  ## @northguild/gmt",
      "  # Title",
    ].join("\n");
    expect(demoteHeadings(body)).toBe(
      [
        "#### Minor Changes",
        "  ##### Deep",
        "  ##### @northguild/gmt",
        "  ##### Title",
      ].join("\n"),
    );
  });

  it("leaves a `#` line inside a fence, indented or not", () => {
    const body = [
      "```sh",
      "### a comment",
      "```",
      "  ```sh",
      "  ### another",
      "  ```",
      "  ~~~~",
      "  ## tilde",
      "  ~~~~",
    ].join("\n");
    expect(demoteHeadings(body)).toBe(body);
  });

  it("closes a fence only on a run as long as its opening", () => {
    const body = ["````md", "```", "### still inside", "```", "````"].join(
      "\n",
    );
    expect(demoteHeadings(body)).toBe(body);
  });
});

describe("checkSlugs", () => {
  it("passes distinct versions", () => {
    expect(() =>
      checkSlugs([{ text: "1.2.0" }, { text: "1.21.0" }]),
    ).not.toThrow();
  });

  it("names both headings when two slug alike", () => {
    expect(() => checkSlugs([{ text: "1.21.0" }, { text: "1.2.10" }])).toThrow(
      /"1\.21\.0" and "1\.2\.10"/,
    );
  });
});

describe("checkRawHtml", () => {
  it("rejects a tag in prose", () => {
    expect(() => checkRawHtml("- a: use <div> here")).toThrow(/raw HTML/);
  });

  it("allows `<` in a code span, a fence and an autolink", () => {
    expect(() =>
      checkRawHtml(
        [
          "- a: `Array<string>` and ``a <b> c``",
          "",
          "  ```ts",
          "  const x: Array<string> = [];",
          "  ```",
          "",
          "  See <https://example.com/a>. And 1 < 2.",
        ].join("\n"),
      ),
    ).not.toThrow();
  });
});

/** Two lines (1.1 with a patch, 1.0) over a current and a retired scope. */
const fixtureGroups = () => [
  {
    scope: "@northguild",
    retired: false,
    releases: [
      {
        version: "1.1.1",
        stamp: "2026-11-05T10:00:00Z",
        body: "### Patch Changes\n\n- p1: fix",
      },
      {
        version: "1.1.0",
        stamp: "2026-11-03T10:48:13Z",
        body: "### Minor Changes\n\n- a1: new\n\n  ### Notes\n\n  text",
      },
    ],
  },
  {
    scope: "@burglekitt",
    retired: true,
    releases: [
      {
        version: "1.0.0",
        stamp: "2026-04-10T17:17:54Z",
        body: "- b2: old",
      },
    ],
  },
];

const pageInput = {
  pkgName: "@northguild/gmt",
  installLink: "/install/",
  formatDate,
  sourceUrl: "https://example.test/CHANGELOG.md",
  sourcePath: "packages/gmt/CHANGELOG.md",
  route: "/changelog/",
};

describe("releaseLines", () => {
  it("splits each scope by major.minor, newest first", () => {
    const lines = releaseLines(fixtureGroups());
    expect(lines.map((g) => [g.scope, g.lines.map((l) => l.line)])).toEqual([
      ["@northguild", ["1.1"]],
      ["@burglekitt", ["1.0"]],
    ]);
    expect(lines[0].lines[0].releases.map((r) => r.version)).toEqual([
      "1.1.1",
      "1.1.0",
    ]);
  });

  it("keeps a line with only a patch release", () => {
    const [group] = releaseLines([
      {
        scope: "@northguild",
        retired: false,
        releases: [
          { version: "1.2.3", stamp: null, body: "- a: x" },
          { version: "1.1.0", stamp: "2026-01-01T00:00:00Z", body: "- a: x" },
        ],
      },
    ]);
    expect(group.lines.map((l) => l.line)).toEqual(["1.2", "1.1"]);
  });

  it("lists a line under both scopes when it changed scope part way", () => {
    const groups = [
      {
        scope: "@northguild",
        retired: false,
        releases: [
          { version: "1.14.2", stamp: "2026-02-01T00:00:00Z", body: "- a: x" },
        ],
      },
      {
        scope: "@burglekitt",
        retired: true,
        releases: [
          { version: "1.14.1", stamp: "2026-01-01T00:00:00Z", body: "- a: x" },
        ],
      },
    ];
    expect(releaseLines(groups).map((g) => g.lines[0].line)).toEqual([
      "1.14",
      "1.14",
    ]);
    const page = renderLinePage({
      ...pageInput,
      title: "Changelog 1.14",
      indexTitle: "Changelog",
      line: "1.14",
      groups,
    });
    expect(page).toContain("## @northguild/gmt");
    expect(page).toContain("## @burglekitt/gmt");
    expect(page).toContain("### 1.14.2");
    expect(page).toContain("### 1.14.1");
  });

  it("turns the dot into a hyphen for the path", () => {
    expect(lineSlug("1.21")).toBe("1-21");
  });
});

describe("renderIndexPage", () => {
  const page = renderIndexPage({
    ...pageInput,
    title: "Changelog",
    description: "A description.",
    groups: fixtureGroups(),
    lastUpdated: "2026-11-03T09:00:00Z",
  });

  it("links every line with its versions and dates", () => {
    expect(page).toContain(`---
title: "Changelog"
description: >
  A description.
industries: [core]
lastUpdated: 2026-11-03T09:00:00Z
---
`);
    expect(page).toContain(
      "- [Release line 1.1](/changelog/1-1/)\n  - 1.1.1: Released 2026-11-05\n  - 1.1.0: Released 2026-11-03\n",
    );
    expect(page).toContain(
      "- [Release line 1.0](/changelog/1-0/)\n  - 1.0.0: Released 2026-04-10\n",
    );
    expect(page.indexOf("## @northguild/gmt")).toBeLessThan(
      page.indexOf("## @burglekitt/gmt"),
    );
  });

  it("repeats no release note and keeps the plate under the retired scope", () => {
    expect(page).not.toContain("a1: new");
    expect(page).not.toContain("b2: old");
    expect(page).not.toContain("### ");
    expect(page).toContain(
      '## @burglekitt/gmt\n\n<div class="gmt-changelog-memorial">',
    );
  });

  it("says a newest version with no tag is not yet released", () => {
    const unreleased = renderIndexPage({
      ...pageInput,
      title: "Changelog",
      description: "d",
      groups: [
        {
          scope: "@northguild",
          retired: false,
          releases: [{ version: "1.1.0", stamp: null, body: "- a: x" }],
        },
      ],
    });
    expect(unreleased).toContain("  - 1.1.0: Not yet released\n");
    expect(unreleased).not.toContain("lastUpdated");
    expect(unreleased).not.toContain("retired");
  });

  it("links a plugin's lines under its own route and quotes its title", () => {
    const plugin = renderIndexPage({
      ...pageInput,
      pkgName: "@northguild/gmt-eslint",
      title: "Changelog: gmt-eslint",
      description: "d",
      installLink: "/guides/integration/linting/",
      route: "/changelog/gmt-eslint/",
      sourcePath: "packages/gmt-eslint/CHANGELOG.md",
      groups: fixtureGroups(),
    });
    expect(plugin).toContain('title: "Changelog: gmt-eslint"');
    expect(plugin).toContain("(/changelog/gmt-eslint/1-1/)");
    expect(plugin).toContain(
      "[install @northguild/gmt-eslint](/guides/integration/linting/)",
    );
  });
});

describe("renderLinePage", () => {
  const render = (line: string) =>
    renderLinePage({
      ...pageInput,
      title: `Changelog ${line}`,
      indexTitle: "Changelog",
      line,
      groups: fixtureGroups(),
    });

  it("holds the line's releases with demoted headings and a link back", () => {
    expect(render("1.1")).toBe(`---
title: "Changelog 1.1"
description: >
  Release notes of @northguild/gmt 1.1.0 to 1.1.1, with the date of each release.
industries: [core]
lastUpdated: 2026-11-05T10:00:00Z
---

Release notes of \`@northguild/gmt\` 1.1.0 to 1.1.1, newest first, built from [\`packages/gmt/CHANGELOG.md\`](https://example.test/CHANGELOG.md). Back to [Changelog](/changelog/).

<div class="gmt-changelog">

## @northguild/gmt

### 1.1.1

Released 2026-11-05

#### Patch Changes

- p1: fix

### 1.1.0

Released 2026-11-03

#### Minor Changes

- a1: new

  ##### Notes

  text

</div>
`);
  });

  it("carries the plate on a retired line and none on a current one", () => {
    const retired = render("1.0");
    expect(retired).toContain('<div class="gmt-changelog-memorial">');
    expect(retired).toContain("### 1.0.0\n\nReleased 2026-04-10");
    expect(retired).not.toContain("### 1.1.0");
    expect(render("1.1")).not.toContain("gmt-changelog-memorial");
  });

  it("names the version of a one-release line plainly and gives each line its own description", () => {
    const groups = fixtureGroups();
    expect(describeLinePage("@northguild/gmt", "1.0", groups)).toBe(
      "Release notes of @northguild/gmt 1.0.0, with the date of each release.",
    );
    expect(describeLinePage("@northguild/gmt", "1.1", groups)).not.toBe(
      describeLinePage("@northguild/gmt", "1.0", groups),
    );
  });

  it("leaves lastUpdated out while the line holds only an unreleased version", () => {
    const page = renderLinePage({
      ...pageInput,
      title: "Changelog 1.2",
      indexTitle: "Changelog",
      line: "1.2",
      groups: [
        {
          scope: "@northguild",
          retired: false,
          releases: [{ version: "1.2.0", stamp: null, body: "- a: x" }],
        },
      ],
    });
    expect(page).not.toContain("lastUpdated");
    expect(page).toContain("### 1.2.0\n\nNot yet released\n");
  });

  it("fails for a line with no release", () => {
    expect(() => render("9.9")).toThrow(/no release in line 9\.9/);
  });
});

describe("the memorial plate", () => {
  const current = {
    scope: "@northguild",
    retired: false,
    releases: [
      { version: "1.3.0", stamp: null, body: "- a: x" },
      { version: "1.2.0", stamp: "2026-05-01T00:00:00Z", body: "- a: x" },
    ],
  };
  const retired = {
    scope: "@burglekitt",
    retired: true,
    releases: [
      { version: "1.1.0", stamp: "2026-04-10T17:17:54Z", body: "- b: y" },
      { version: "1.0.0", stamp: "2026-04-01T00:00:00Z", body: "- b: z" },
    ],
  };
  const render = (groups: (typeof current)[], line = "1.1") =>
    renderLinePage({
      ...pageInput,
      title: "t",
      indexTitle: "i",
      line,
      groups,
    });

  it("sits right under the retired heading, before its first release, and names the oldest current version and the install link", () => {
    const page = render([current, retired]);
    expect(page.match(/gmt-changelog-memorial/g)).toHaveLength(1);
    const oldest = current.releases.at(-1)!.version;
    const at = page.indexOf(
      '## @burglekitt/gmt\n\n<div class="gmt-changelog-memorial">\n\n',
    );
    expect(at).toBeGreaterThan(0);
    expect(page.indexOf("gmt-changelog-memorial")).toBeLessThan(
      page.indexOf(`### ${retired.releases[0].version}`),
    );
    expect(page).toContain(
      `\n\n![The @burglekitt organization logo](/burglekitt-logo.png)\n\n**In memoriam: @burglekitt.** `,
    );
    expect(page).toContain(
      `The package continues as \`@northguild/gmt\` from ${oldest}; [install @northguild/gmt](/install/).\n\n</div>\n\n### `,
    );
  });

  it("is absent when every group is current", () => {
    expect(render([current], "1.3")).not.toContain("gmt-changelog-memorial");
  });

  it("fails loudly when a retired group has no current group to continue it", () => {
    expect(() => render([retired])).toThrow(/@burglekitt.*no current/s);
  });

  it("points at a logo file that ships in public/", () => {
    expect(
      existsSync(resolve(repoRoot, "apps/dox/public", `.${MEMORIAL_LOGO}`)),
    ).toBe(true);
  });
});

describe("describePage", () => {
  it("names the retired scope only when there is one", () => {
    const current = [{ scope: "@northguild", retired: false, releases: [] }];
    expect(describePage("@northguild/gmt", current)).toBe(
      "Every release of @northguild/gmt, newest first, with its date.",
    );
    expect(
      describePage("@northguild/gmt", [
        ...current,
        { scope: "@burglekitt", retired: true, releases: [] },
      ]),
    ).toBe(
      "Every release of @northguild/gmt, newest first, with its date, including the releases published under the retired @burglekitt scope.",
    );
  });
});

describe("the sidebar", () => {
  it("links exactly the generated changelog routes, the library first", () => {
    const config = readFileSync(
      resolve(repoRoot, "apps/dox/astro.config.mjs"),
      "utf8",
    );
    const group = /label: "Changelog",\s*items: \[([\s\S]*?)\],\s*\}/.exec(
      config,
    );
    expect(group, "a Changelog sidebar group").not.toBeNull();
    const slugs = [...group![1].matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
    // The sidebar orders the plugins by hand; the set must match the generated pages.
    const routes = changelogPackages.map((dir) =>
      dir === "gmt" ? "changelog" : `changelog/${dir}`,
    );
    // The order is the spec's: the library, then the plugins as listed, so two cannot swap silently.
    expect(slugs).toEqual([
      "changelog",
      "changelog/gmt-eslint",
      "changelog/gmt-oxlint",
      "changelog/gmt-biome",
    ]);
    expect([...slugs].sort()).toEqual([...routes].sort());
  });
});

describe.each(changelogPackages)("the real changelog of packages/%s", (dir) => {
  const pkgName = (
    JSON.parse(
      readFileSync(resolve(packagesDir, dir, "package.json"), "utf8"),
    ) as { name: string }
  ).name;
  const scope = pkgName.split("/")[0];
  const tags = parseTags(tagOutput, dir);
  // Built on first use, so a clone without tags never reaches the guards.
  const versions = hasTags
    ? parseChangelog(
        readFileSync(resolve(packagesDir, dir, "CHANGELOG.md"), "utf8"),
      )
    : [];
  const groups = (): ReturnType<typeof groupReleases> =>
    groupReleases(versions, tags, scope, dir);
  /** The line pages in order, one string each. */
  const linePages = (): string[] => {
    const all = groups();
    const lines = [
      ...new Set(
        releaseLines(all).flatMap((group) => group.lines.map((l) => l.line)),
      ),
    ];
    return lines.map((line) =>
      renderLinePage({
        pkgName,
        title: `t ${line}`,
        indexTitle: "t",
        line,
        groups: all,
        installLink: "/install/",
        formatDate,
        sourceUrl: "https://example.test/CHANGELOG.md",
        sourcePath: `packages/${dir}/CHANGELOG.md`,
        route: "/changelog/",
      }),
    );
  };
  /** Every line page joined, so the guards read the whole file as one text. */
  const page = (): string => linePages().join("\n");

  it("fits every line page and the index in 1 MB, each with its own description", () => {
    if (!hasTags) return; // a shallow clone has no tags
    const all = groups();
    const index = renderIndexPage({
      pkgName,
      title: "t",
      description: describePage(pkgName, all),
      groups: all,
      installLink: "/install/",
      formatDate,
      sourceUrl: "u",
      sourcePath: `packages/${dir}/CHANGELOG.md`,
      route: "/changelog/",
    });
    const pages = [index, ...linePages()];
    for (const text of pages) {
      expect(Buffer.byteLength(text)).toBeLessThan(1_048_576);
    }
    const descriptions = pages.map(
      (text) => /^description: >\n {2}(.+)$/m.exec(text)![1],
    );
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("shows every version of the file as an h3, in order, with a unique anchor", () => {
    if (!hasTags) return; // a shallow clone has no tags
    const h3 = [...page().matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    expect(h3).toEqual(versions.map((v) => v.version));
    const anchors = h3.map((heading) => slug(heading));
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("tags every version but the first, and the first is tagged or not yet released", () => {
    if (!hasTags) return; // a shallow clone has no tags
    for (const { version } of versions.slice(1)) {
      expect(tags.has(version), `${version} has a tag`).toBe(true);
    }
    const [first] = versions;
    const text = page();
    const heading = text.indexOf(`### ${first.version}\n`);
    const line = text.slice(heading).split("\n")[2];
    if (tags.has(first.version)) {
      expect(line).toMatch(/^Released \d{4}-\d{2}-\d{2}$/);
    } else {
      expect(line).toBe("Not yet released");
    }
  });

  it("puts every @burglekitt-tagged version under the retired heading and a memorial plate on each page that holds one", () => {
    if (!hasTags) return; // a shallow clone has no tags
    const retired = versions.filter(
      (v) => tags.get(v.version)?.scope === "@burglekitt",
    );
    expect(retired.length).toBeGreaterThan(0);
    const text = page();
    const start = text.indexOf(`## @burglekitt/${dir}\n`);
    expect(start).toBeGreaterThan(0);
    const section = text.slice(start);
    const groups = groupReleases(versions, tags, scope, dir);
    const oldest = groups.find((g) => !g.retired)!.releases.at(-1)!.version;
    // One plate per page that holds retired releases.
    const retiredLines = new Set(retired.map((v) => lineOf(v.version)));
    expect(text.match(/class="gmt-changelog-memorial"/g)).toHaveLength(
      retiredLines.size,
    );
    expect(section.indexOf("gmt-changelog-memorial")).toBeLessThan(
      section.indexOf("### "),
    );
    expect(section).toContain(
      `The package continues as \`${pkgName}\` from ${oldest}; [install ${pkgName}](`,
    );
    for (const { version } of retired) {
      expect(section).toContain(`### ${version}\n`);
    }
    // Nothing newer than the retired scope's last release sits below its heading.
    for (const { version } of versions.filter(
      (v) => tags.get(v.version)?.scope !== "@burglekitt",
    )) {
      expect(section).not.toContain(`### ${version}\n`);
    }
  });
});
