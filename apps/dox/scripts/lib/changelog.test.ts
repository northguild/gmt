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
  renderPage,
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

describe("renderPage", () => {
  it("renders a two-version, two-scope fixture", () => {
    const page = renderPage({
      pkgName: "@northguild/gmt",
      title: "Changelog",
      description: "A description.",
      installLink: "/install/",
      groups: [
        {
          scope: "@northguild",
          retired: false,
          releases: [
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
      ],
      formatDate,
      sourceUrl: "https://example.test/CHANGELOG.md",
      sourcePath: "packages/gmt/CHANGELOG.md",
      lastUpdated: "2026-11-03T09:00:00Z",
    });
    expect(page).toBe(`---
title: "Changelog"
description: >
  A description.
industries: [core]
lastUpdated: 2026-11-03T09:00:00Z
---

Every release of \`@northguild/gmt\`, newest first, built from [\`packages/gmt/CHANGELOG.md\`](https://example.test/CHANGELOG.md).

<div class="gmt-changelog">

## @northguild/gmt

### 1.1.0

Released 2026-11-03

#### Minor Changes

- a1: new

  ##### Notes

  text

## @burglekitt/gmt

<div class="gmt-changelog-memorial">

![The @burglekitt organization logo](/burglekitt-logo.png)

**In memoriam: @burglekitt.** These releases were published under the retired \`@burglekitt\` npm scope. The package continues as \`@northguild/gmt\` from 1.1.0; [install @northguild/gmt](/install/).

</div>

### 1.0.0

Released 2026-04-10

- b2: old

</div>
`);
  });

  it("says a newest version with no tag is not yet released", () => {
    const page = renderPage({
      pkgName: "@northguild/gmt",
      title: "Changelog",
      description: "d",
      installLink: "/install/",
      groups: [
        {
          scope: "@northguild",
          retired: false,
          releases: [{ version: "1.1.0", stamp: null, body: "- a: x" }],
        },
      ],
      formatDate,
      sourceUrl: "u",
      sourcePath: "p",
    });
    expect(page).toContain("### 1.1.0\n\nNot yet released\n");
    expect(page).not.toContain("lastUpdated");
    expect(page).not.toContain("retired");
  });
});

describe("a plugin page", () => {
  it("quotes its title and sends the retired line to the linting guide", () => {
    const groups = [
      {
        scope: "@northguild",
        retired: false,
        releases: [{ version: "1.1.0", stamp: null, body: "- a: x" }],
      },
      {
        scope: "@burglekitt",
        retired: true,
        releases: [
          { version: "1.0.0", stamp: "2026-04-10T17:17:54Z", body: "- b: y" },
        ],
      },
    ];
    const page = renderPage({
      pkgName: "@northguild/gmt-eslint",
      title: "Changelog: gmt-eslint",
      description: describePage("@northguild/gmt-eslint", groups),
      installLink: "/guides/integration/linting/",
      groups,
      formatDate,
      sourceUrl: "u",
      sourcePath: "packages/gmt-eslint/CHANGELOG.md",
    });
    expect(page).toContain('title: "Changelog: gmt-eslint"');
    expect(page).toContain(
      "The package continues as `@northguild/gmt-eslint` from 1.1.0; [install @northguild/gmt-eslint](/guides/integration/linting/).",
    );
    expect(page).toContain("## @burglekitt/gmt-eslint\n");
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
  const render = (groups: (typeof current)[]) =>
    renderPage({
      pkgName: "@northguild/gmt",
      title: "t",
      description: "d",
      installLink: "/install/",
      groups,
      formatDate,
      sourceUrl: "u",
      sourcePath: "p",
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
    expect(render([current])).not.toContain("gmt-changelog-memorial");
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
  const page = (): string =>
    renderPage({
      pkgName,
      title: "t",
      description: "d",
      installLink: "/install/",
      groups: groupReleases(versions, tags, scope, dir),
      formatDate,
      sourceUrl: "https://example.test/CHANGELOG.md",
      sourcePath: `packages/${dir}/CHANGELOG.md`,
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

  it("puts every @burglekitt-tagged version under the retired heading and one memorial plate", () => {
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
    expect(text.match(/class="gmt-changelog-memorial"/g)).toHaveLength(1);
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
